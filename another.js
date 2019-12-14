
const KEY_UP     = 1;
const KEY_RIGHT  = 2;
const KEY_DOWN   = 3;
const KEY_LEFT   = 4;
const KEY_ACTION = 5;
const KEY_ESC    = 6;

var keyboard = new Array( 8 );

function is_key_pressed( code ) {
	return keyboard[ code ];
}

function set_key_pressed( jcode, state ) {
	if ( jcode == 37 ) {
		keyboard[ KEY_LEFT ] = state;
	} else if ( jcode == 38 ) {
		keyboard[ KEY_UP ] = state;
	} else if ( jcode == 39 ) {
		keyboard[ KEY_RIGHT ] = state;
	} else if ( jcode == 40 ) {
		keyboard[ KEY_DOWN ] = state;
	} else if ( jcode == 32 || jcode == 13 ) {
		keyboard[ KEY_ACTION ] = state;
	} else if ( jcode == 27 ) {
		keyboard[ KEY_ESC ] = state;
	}
}

const VAR_SCROLL_Y             = 0xf9;
const VAR_HERO_ACTION          = 0xfa;
const VAR_HERO_POS_JUMP_DOWN   = 0xfb;
const VAR_HERO_POS_LEFT_RIGHT  = 0xfc;
const VAR_HERO_POS_MASK        = 0xfd;
const VAR_HERO_ACTION_POS_MASK = 0xfe;
const VAR_PAUSE_SLICES         = 0xff;

var vars = new Array( 256 );
var tasks = new Array( 64 );

var bytecode;
var palette;
var polygons1;
var polygons2;

var bytecode_offset;
var task_num;
var task_paused;

var next_part;

var delay = 0;
var timestamp;

function read_byte( ) {
	const value = bytecode[ bytecode_offset ];
	bytecode_offset += 1;
	return value;
}

function read_word( ) {
	const value = ( bytecode[ bytecode_offset ] << 8) | bytecode[ bytecode_offset + 1 ];
	bytecode_offset += 2;
	return value;
}

function to_signed( value, bits ) {
	const mask = 1 << ( bits - 1 );
	return value - ( ( value & mask ) << 1 );
}

var opcodes = {
	0x00 : function( ) {
		const num = read_byte( );
		const imm = to_signed( read_word( ), 16 );
		vars[ num ] = imm;
	},
	0x01 : function( ) {
		const dst = read_byte( );
		const src = read_byte( );
		vars[ dst ] = vars[ src ];
	},
	0x02 : function( ) {
		const dst = read_byte( );
		const src = read_byte( );
		vars[ dst ] += vars[ src ];
	},
	0x03 : function( ) {
		const num = read_byte( );
		const imm = to_signed( read_word( ), 16 );
		vars[ num ] += imm;
	},
	0x04 : function( ) { // call
		const addr = read_word( );
		tasks[ task_num ].stack.push( bytecode_offset );
		bytecode_offset = addr;
	},
	0x05 : function( ) { // ret
		bytecode_offset = tasks[ task_num ].stack.pop( );
	},
	0x06 : function( ) { // yield
		task_paused = true;
	},
	0x07 : function( ) { // jmp
		bytecode_offset = read_word( );
	},
	0x08 : function( ) { // install_task
		const num  = read_byte( );
		const addr = read_word( );
		tasks[ num ].next_offset = addr;
	},
	0x09 : function( ) { // jmp_nz
		const num = read_byte( );
		vars[ num ] -= 1;
		const addr = read_word( );
		if ( vars[ num ] != 0 ) {
			bytecode_offset = addr;
		}
	},
	0x0a : function( ) { // jmp_cond
		const op = read_byte( );
		const b = vars[ read_byte( ) ];
		var a;
		if ( op & 0x80 ) {
			a = vars[ read_byte( ) ];
		} else if ( op & 0x40 ) {
			a = to_signed( read_word( ), 16 );
		} else {
			a = read_byte( );
		}
		const addr = read_word( );
		switch ( op & 7 ) {
		case 0:
			if ( b == a ) {
				bytecode_offset = addr;
			}
			break;
		case 1:
			if ( b != a ) {
				bytecode_offset = addr;
			}
			break;
		case 2:
			if ( b > a ) {
				bytecode_offset = addr;
			}
			break;
		case 3:
			if ( b >= a ) {
				bytecode_offset = addr;
			}
			break;
		case 4:
			if ( b < a ) {
				bytecode_offset = addr;
			}
			break;
		case 5:
			if ( b <= a ) {
				bytecode_offset = addr;
			}
			break;
		}
	},
	0x0b : function( ) { // set_palette
		next_palette = read_word( ) >> 8;
	},
	0x0c : function( ) { // change_tasks_state
		const start = read_byte( );
		const end   = read_byte( );
		const state = read_byte( );
		if ( state == 2 ) {
			for ( var i = start; i <= end; ++i ) {
				tasks[ i ].next_offset = -2;
			}
		} else {
			console.assert( state == 0 || state == 1 );
			for ( var i = start; i <= end; ++i ) {
				tasks[ i ].next_state = state;
			}
		}
	},
	0x0d : function( ) { // select_page
		select_page( read_byte( ) );
	},
	0x0e : function( ) { // fill_page
		const num   = read_byte( );
		const color = read_byte( );
		fill_page( num, color );
	},
	0x0f : function( ) { // copy_page
		const src = read_byte( );
		const dst = read_byte( );
		copy_page( src, dst, vars[ VAR_SCROLL_Y ] );
	},
	0x10 : function( ) { // update_display
		const num = read_byte( );
		delay += vars[ VAR_PAUSE_SLICES ] * 1000 / 50;
		//console.log( 'delay:' + delay );
		vars[ 0xf7 ] = 0;
		update_display( num );
	},
	0x11 : function( ) { // remove_task
		bytecode_offset = -1;
		task_paused = true;
	},
	0x12 : function( ) { // draw_string
		const num   = read_word( );
		const x     = read_byte( );
		const y     = read_byte( );
		const color = read_byte( );
		draw_string( num, color, x, y );
	},
	0x13 : function( ) { // sub
		const dst = read_byte( );
		const src = read_byte( );
		vars[ dst ] -= vars[ src ];
	},
	0x14 : function( ) { // and
		const num = read_byte( );
		const imm = read_word( );
		vars[ num ] = to_signed( ( vars[ num ] & imm ) & 0xffff, 16 );
	},
	0x15 : function( ) { // or
		const num = read_byte( );
		const imm = read_word( );
		vars[ num ] = to_signed( ( vars[ num ] | imm ) & 0xffff, 16 );
	},
	0x16 : function( ) { // shl
		const num = read_byte( );
		const imm = read_word( ) & 15;
		vars[ num ] = to_signed( ( vars[ num ] << imm ) & 0xffff, 16 );
	},
	0x17 : function( ) { // shr
		const num = read_byte( );
		const imm = read_word( ) & 15;
		vars[ num ] = to_signed( ( vars[ num ] & 0xffff ) >> imm, 16 );
	},
	0x18 : function( ) { // play_sound
		const num     = read_word( );
		const freq    = read_byte( );
		const volume  = read_byte( );
		const channel = read_byte( );
	},
	0x19 : function( ) { // load_resource
		const num = read_word( );
		if ( num > 16000 ) {
			next_part = num;
		}
		console.log(' load num:' + num );
	},
	0x1a : function( ) { // play_music
		const num      = read_word( );
		const period   = read_word( );
		const position = read_byte( );
	}
};

function execute_task( ) {
	while ( !task_paused ) {
		const opcode = read_byte( );
		if ( opcode & 0x80 ) {
			const offset = ( ( ( opcode << 8 ) | read_byte() ) << 1 ) & 0xfffe;
			var x = read_byte( );
			var y = read_byte( );
			var h = y - 199;
			if ( h > 0 ) {
				y = 199;
				x += h;
			}
			draw_shape( polygons1, offset, 0xff, 64, x, y );
		} else if ( opcode & 0x40 ) {
			const offset = ( read_word( ) << 1) & 0xfffe;
			var x = read_byte( );
			if ( ( opcode & 0x20 ) == 0 ) {
				if ( ( opcode & 0x10 ) == 0 ) {
					x = ( x << 8 ) | read_byte( );
				} else {
					x = vars[ x ];
				}
			} else {
				if ( opcode & 0x10 ) {
					x += 256;
				}
			}
			var y = read_byte( );
			if ( ( opcode & 8 ) == 0 ) {
				if ( ( opcode & 4 ) == 0 ) {
					y = ( y << 8 ) | read_byte( );
				} else {
					y = vars[ y ];
				}
                        }
			var polygons = polygons1;
			var zoom = read_byte( );
			if ( ( opcode & 2 ) == 0 ) {
				if ( ( opcode & 1 ) == 0 ) {
					bytecode_offset -= 1;
					zoom = 64;
				} else {
					zoom = vars[ zoom ];
				}
			} else {
				if ( opcode & 1 ) {
					polygons = polygons2;
					bytecode_offset -= 1;
					zoom = 64;
				}
			}
			draw_shape( polygons, offset, 0xff, zoom, x, y );
		} else {
			//console.log( 'task_num:' + task_num + ' bytecode_offset:' + bytecode_offset + ' opcode:' + opcode );
			console.assert( opcode <= 0x1a );
			opcodes[ opcode ]( );
		}
	}
}

function update_input( ) {
	var mask = 0;
	if ( is_key_pressed( KEY_RIGHT ) ) {
		vars[ VAR_HERO_POS_LEFT_RIGHT ] = 1;
		mask |= 1;
	} else if ( is_key_pressed( KEY_LEFT ) ) {
		vars[ VAR_HERO_POS_LEFT_RIGHT ] = -1;
		mask |= 2;
	} else {
		vars[ VAR_HERO_POS_LEFT_RIGHT ] = 0;
	}
	if ( is_key_pressed( KEY_DOWN ) ) {
		vars[ VAR_HERO_POS_JUMP_DOWN ] = 1;
		mask |= 4;
	} else if ( is_key_pressed( KEY_UP ) ) {
		vars[ VAR_HERO_POS_JUMP_DOWN ] = -1;
		mask |= 8;
	} else {
		vars[ VAR_HERO_POS_JUMP_DOWN ] = 0;
	}
	vars[ VAR_HERO_POS_MASK ] = mask;
	if ( is_key_pressed( KEY_ACTION ) ) {
		vars[ VAR_HERO_ACTION ] = 1;
		mask |= 0x80;
	} else {
		vars[ VAR_HERO_ACTION ] = 0;
	}
	vars[ VAR_HERO_ACTION_POS_MASK ] = mask;
}

function run_tasks( ) {
	if ( next_part != 0 ) {
		restart( next_part );
		next_part = 0;
	}
	for ( var i = 0; i < tasks.length; ++i ) {
		tasks[ i ].state = tasks[ i ].next_state;
		const offset = tasks[ i ].next_offset;
		if ( offset != -1 ) {
			tasks[ i ].offset = ( offset == -2 ) ? -1 : offset;
			tasks[ i ].next_offset = -1;
		}
	}
	update_input( );
	for ( var i = 0; i < tasks.length; ++i ) {
		if ( tasks[ i ].state == 0 ) {
			const offset = tasks[ i ].offset;
			if ( offset != -1 ) {
				bytecode_offset = offset;
				tasks[ i ].stack.length = 0;
				task_num = i;
				task_paused = false;
				execute_task( );
				tasks[ i ].offset = bytecode_offset;
			}
		}
	}
}

function load( data, size ) {
	data = atob( data );
	if ( data.length != size ) {
		var buf = decrunch.uncompress( data );
		console.assert( buf.length == size );
		return buf;
	}
	var buf = new Array( size );
	for ( var i = 0; i < data.length; ++i ) {
		buf[ i ] = data.charCodeAt( data[ i ] ) & 0xff;
	}
	return buf;
}

function restart( part ) {
	if ( part == 16001 ) { // introduction
		palette   = load( data17, size17 );
		bytecode  = load( data18, size18 );
		polygons1 = load( data19, size19 );
		polygons2 = null;
	} else if ( part == 16002 ) { // water
		palette   = load( data1a, size1a );
		bytecode  = load( data1b, size1b );
		polygons1 = load( data1c, size1c );
		polygons2 = load( data11, size11 );
	} else if ( part == 16003 ) { // jail
		palette   = load( data1d, size1d );
		bytecode  = load( data1e, size1e );
		polygons1 = load( data1f, size1f );
		polygons2 = load( data11, size11 );
	} else if ( part == 16004 ) { // 'cite'
		palette   = load( data20, size20 );
		bytecode  = load( data21, size21 );
		polygons1 = load( data22, size22 );
		polygons2 = load( data11, size11 );
	} else if ( part == 16005 ) { // 'arene'
		palette   = load( data23, size23 );
		bytecode  = load( data24, size24 );
		polygons1 = load( data25, size25 );
		polygons2 = load( data11, size11 );
	} else if ( part == 16006 ) { // 'luxe'
		palette   = load( data26, size26 );
		bytecode  = load( data27, size27 );
		polygons1 = load( data28, size28 );
		polygons2 = load( data11, size11 );
	} else if ( part == 16007 ) { // 'final'
		palette   = load( data29, size29 );
		bytecode  = load( data2a, size2a );
		polygons1 = load( data2b, size2b );
		polygons2 = load( data11, size11 );
	} else if ( part == 16008 ) { // password screen
		palette   = load( data7d, size7d );
		bytecode  = load( data7e, size7d );
		polygons1 = load( data7f, size7f );
		polygons2 = null;
	}
	for ( var i = 0; i < tasks.length; ++i ) {
		tasks[ i ] = { state : 0, next_state : 0, offset : -1, next_offset : -1 };
		tasks[ i ].stack = new Array( );
	}
	tasks[ 0 ].offset = 0;
}

const SCALE = 2;
const SCREEN_W = 320 * SCALE;
const SCREEN_H = 200 * SCALE;
const PAGE_SIZE = SCREEN_W * SCREEN_H;

var buffer8 = new Uint8Array( 4 * PAGE_SIZE );
var palette32 = new Uint32Array( 16 * 3 ); // Amiga, EGA, VGA
var current_page0; // current
var current_page1; // front
var current_page2; // back
var next_palette = -1;

const PALETTE_TYPE_AMIGA = 0;
const PALETTE_TYPE_EGA = 1;
const PALETTE_TYPE_VGA = 2;

var palette_type = PALETTE_TYPE_AMIGA;

function get_page( num ) {
	if ( num == 0xff ) {
		return current_page2;
	} else if ( num == 0xfe ) {
		return current_page1;
	} else {
		console.assert( num < 4 );
		return num;
	}
}

function select_page( num ) {
	current_page0 = get_page( num );
}

function fill_page( num, color ) {
	num = get_page( num );
	buffer8.fill( color, num * PAGE_SIZE, ( num + 1 ) * PAGE_SIZE );
}

function copy_page( src, dst, vscroll ) {
	dst = get_page( dst );
	if ( src >= 0xfe ) {
		src = get_page( src );
		buffer8.set( buffer8.subarray( src * PAGE_SIZE, ( src + 1 ) * PAGE_SIZE ), dst * PAGE_SIZE );
	} else {
		src = get_page( src & 3 );
		if ( dst == src ) {
			return;
		}
		vscroll *= SCALE;
		vscroll = 0;
		if ( vscroll == 0 ) {
			buffer8.set( buffer8.subarray( src * PAGE_SIZE, ( src + 1 ) * PAGE_SIZE ), dst * PAGE_SIZE );
		} else if ( vscroll > -SCREEN_W && vscroll < SCREEN_W ) {
			if ( vscroll < 0 ) {
				buffer8.set( buffer8.subarray( src * PAGE_SIZE - vscroll * SCREEN_W, src * PAGE_SIZE ), dst * PAGE_SIZE );
			} else {
				buffer8.set( buffer8.subarray( src * PAGE_SIZE, src * PAGE_SIZE + ( SCREEN_H - vscroll ) * SCREEN_W ), dst * PAGE_SIZE + vscroll * SCREEN_W );
			}
		}
	}
}

function draw_point( page, color, x, y ) {
	if ( x < 0 || x >= SCREEN_W || y < 0 || y >= SCREEN_H ) {
		return;
	}
	const offset = page * PAGE_SIZE + y * SCREEN_W + x;
	if ( color == 0x11 ) {
		console.log( page != 0 );
		buffer8[ offset ] = buffer8[ y * SCREEN_W + x ];
	} else if ( color == 0x10 ) {
		buffer8[ offset ] |= 8;
	} else {
		console.assert( color < 0x10 );
		buffer8[ offset ] = color;
	}
}

function draw_line( page, color, y, x1, x2 ) {
	var start = Math.min( x1, x2 );
	var end   = Math.max( x1, x2 );
	if ( start >= SCREEN_W || end < 0 ) {
		return;
	}
	if ( start < 0 ) {
		start = 0;
	}
	if ( end >= SCREEN_W ) {
		end = SCREEN_W - 1;
	}
	const offset = page * PAGE_SIZE + y * SCREEN_W;
	if ( color == 0x11 ) {
		console.assert( page != 0 );
		buffer8.set( buffer8.subarray( y * SCREEN_W + start, y * SCREEN_W + end + 1 ), offset + start );
	} else if ( color == 0x10 ) {
		for ( var i = start; i <= end; ++i ) {
			buffer8[ offset + i ] |= 8;
		}
	} else {
		console.assert( color < 0x10 );
		buffer8.fill( color, offset + start, offset + end + 1);
	}
}

function draw_polygon( page, color, vertices ) {
	// scanline fill
	var i = 0;
	var j = vertices.length - 1;
	var scanline = Math.min( vertices[ i ].y, vertices[ j ].y );
	var x2 = vertices[ i++ ].x;
	var x1 = vertices[ j-- ].x;
	var f1 = x1 << 16;
	var f2 = x2 << 16;
	var count = vertices.length;
	for ( count -= 2; count != 0; count -= 2 ) {
		const h1 = vertices[ j ].y - vertices[ j + 1 ].y;
		const step1 = ( ( ( vertices[ j ].x - vertices[ j + 1 ].x ) << 16 ) / ( h1 == 0 ? 1 : h1 ) ) >> 0;
		j -= 1;
		const h2 = vertices[ i ].y - vertices[ i - 1 ].y;
		const step2 = ( ( ( vertices[ i ].x - vertices[ i - 1 ].x ) << 16 ) / ( h2 == 0 ? 1 : h2 ) ) >> 0;
		i += 1;
		f1 = ( f1 & 0xffff0000 ) | 0x7fff;
		f2 = ( f2 & 0xffff0000 ) | 0x8000;
		if ( h2 == 0 ) {
			f1 += step1;
			f2 += step2;
		} else {
			for ( var k = 0; k < h2; ++k ) {
				if ( scanline >= 0 ) {
					x1 = f1 >> 16;
					x2 = f2 >> 16;
					draw_line( page, color, scanline, x1, x2 );
				}
				f1 += step1;
				f2 += step2;
				scanline += 1;
				if ( scanline >= SCREEN_H ) {
					return;
				}
			}
		}
	}
}

function fill_polygon( data, offset, color, zoom, x, y ) {
	const w = ( ( data[ offset++ ] * zoom / 64 ) >> 0 ) * SCALE;
	const h = ( ( data[ offset++ ] * zoom / 64 ) >> 0 ) * SCALE;
	const x1 = ( x * SCALE - w / 2 ) >> 0;
	const x2 = ( x * SCALE + w / 2 ) >> 0;
	const y1 = ( y * SCALE - h / 2 ) >> 0;
	const y2 = ( y * SCALE + h / 2 ) >> 0;
	if ( x1 >= SCREEN_W || x2 < 0 || y1 >= SCREEN_H || y2 < 0 ) {
		return;
	}
	const count = data[ offset++ ];
	console.assert( ( count & 1 ) == 0 );
	var vertices = new Array( );
	for ( var i = 0; i < count; ++i ) {
		const vx = x1 + ( ( data[ offset++ ] * zoom / 64 ) >> 0 ) * SCALE;
		const vy = y1 + ( ( data[ offset++ ] * zoom / 64 ) >> 0 ) * SCALE;
		vertices.push( { x : vx, y : vy } );
	}
	if ( count == 4 && w == 0 && h <= 1 ) {
		draw_point( current_page0, color, x, y );
        } else {
		draw_polygon( current_page0, color, vertices );
	}
}

function draw_shape_parts( data, offset, color, zoom, x, y ) {
	const x0 = x - ( data[ offset++ ] * zoom / 64 ) >> 0;
	const y0 = y - ( data[ offset++ ] * zoom / 64 ) >> 0;
	const count = data[ offset++ ];
	for ( var i = 0; i <= count; ++i ) {
		const addr = ( data[ offset ] << 8 ) | data[ offset + 1 ]; offset += 2;
		const x1 = x0 + ( data[ offset++ ] * zoom / 64 ) >> 0;
		const y1 = y0 + ( data[ offset++ ] * zoom / 64 ) >> 0;
		var color = 0xff;
		if ( addr & 0x8000 ) {
			color = data[ offset ] & 0x7f; offset += 2;
		}
		draw_shape( data, ( ( addr << 1 ) & 0xfffe ), color, zoom, x1, y1 );
	}
}

function draw_shape( data, offset, color, zoom, x, y ) {
	const code = data[ offset++ ];
	if ( code >= 0xc0 ) {
		if ( color & 0x80 ) {
			color = code & 0x3f;
		}
		fill_polygon( data, offset, color, zoom, x, y );
	} else {
		if ( ( code & 0x3f ) == 2 ) {
			draw_shape_parts( data, offset, color, zoom, x, y );
		}
	}
}

function draw_char( page, chr, color, x, y ) {
	if ( x < 40 * SCALE && y < 192 * SCALE ) {
		var offset = page * PAGE_SIZE + ( x * 8 + y * SCREEN_W ) * SCALE;
		for ( var y = 0; y < 8; ++y ) {
			const mask = font[ ( chr - 32 ) * 8 + y ];
			for ( var x = 0; x < 8; ++x ) {
				if ( ( mask & ( 1 << ( 7 - x ) ) ) != 0 ) {
					for ( var j = 0; j < SCALE; ++j ) {
						for ( var i = 0; i < SCALE; ++i ) {
							buffer8[ offset + j * SCREEN_W + x * SCALE + i ] = color;
						}
					}
				}
			}
			offset += SCREEN_W * SCALE;
		}
	}
}

function draw_string( num, color, x, y ) {
	if ( num in strings ) {
		const x0 = x;
		const str = strings[ num ];
		for ( var i = 0; i < str.length; ++i ) {
			const chr = str.charCodeAt( i );
			if ( chr == 10 ) {
				y += 8;
				x = x0;
			} else {
				draw_char( current_page0, chr, color, x, y );
				x += 1;
			}
		}
	}
}

const PALETTE_EGA = [
	0x00, 0x00, 0x00,
	0x00, 0x00, 0xaa,
	0x00, 0xaa, 0x00,
	0x00, 0xaa, 0xaa,
	0xaa, 0x00, 0x00,
	0xaa, 0x00, 0xaa,
	0xaa, 0x55, 0x00,
	0xaa, 0xaa, 0xaa,
	0x55, 0x55, 0x55,
	0x55, 0x55, 0xff,
	0x55, 0xff, 0x55,
	0x55, 0xff, 0xff,
	0xff, 0x55, 0x55,
	0xff, 0x55, 0xff,
	0xff, 0xff, 0x55,
	0xff, 0xff, 0xff,
];

function set_palette_ega( offset ) {
	for ( var i = 0; i < 16; ++i ) {
		var color = ( palette[ offset + i * 2 ] << 8 ) | palette[ offset + i * 2 + 1 ];
		color = (( color >> 12 ) & 15 ) * 3;
		palette32[ PALETTE_TYPE_EGA * 16 + i ] = 0xff000000 | ( PALETTE_EGA[ color + 2 ] << 16 ) | ( PALETTE_EGA[ color + 1 ] << 8 ) | PALETTE_EGA[ color ];
	}
}

function set_palette_444( offset, type ) {
	for ( var i = 0; i < 16; ++i ) {
		const color = ( palette[ offset + i * 2 ] << 8 ) | palette[ offset + i * 2 + 1 ];
		var r = ( color >> 8 ) & 15;
		r = ( r << 4 ) | r;
		var g = ( color >> 4 ) & 15;
		g = ( g << 4 ) | g;
		var b = color & 15;
		b = ( b << 4 ) | b;
		palette32[ type * 16 + i ] = 0xff000000 | ( b << 16 ) | ( g << 8 ) | r;
	}
}

function update_display( num ) {
	if ( num != 0xfe ) {
		if ( num == 0xff ) {
			const tmp = current_page1;
			current_page1 = current_page2;
			current_page2 = tmp;
		} else {
			current_page1 = get_page( num );
		}
	}
	if ( next_palette != -1 ) {
		const offset = next_palette * 32;
		set_palette_444( offset, PALETTE_TYPE_AMIGA );
		set_palette_ega( offset + 1024 );
		set_palette_444( offset + 1024, PALETTE_TYPE_VGA );
		next_palette = -1;
	}
	update_screen( current_page1 * PAGE_SIZE );
}

function reset( ) {
	current_page2 = 1;
	current_page1 = 2;
	current_page0 = get_page( 0xfe );
	buffer8.fill( 0 );
	next_palette = -1;
	vars.fill( 0 );
	vars[ 0xbc ] = 0x10;
	vars[ 0xc6 ] = 0x80;
	vars[ 0xf2 ] = 6000; // 4000 for Amiga bytecode
	vars[ 0xdc ] = 33;
	vars[ 0xe4 ] = 20;
	next_part = 16001;
	timestamp = Date.now();
}

function tick( ) {
	const current = Date.now();
	delay -= current - timestamp;
	while ( delay <= 0 ) {
		run_tasks( );
	}
	timestamp = current;
}

const INTERVAL = 50;
var canvas;
var timer;

function init( name ) {
	canvas = document.getElementById( name );
	document.onkeydown = function( e ) { set_key_pressed( e.keyCode, 1 ); }
	document.onkeyup   = function( e ) { set_key_pressed( e.keyCode, 0 ); }
	reset( );
	if ( timer ) {
		clearInterval( timer );
	}
	timer = setInterval( tick, INTERVAL );
}

function pause( ) {
	if ( timer ) {
		clearInterval( timer );
		timer = null;
		return true;
	}
	timer = setInterval( tick, INTERVAL );
	return false;
}

function mute( ) {
}

function change_palette( num ) {
	palette_type = num;
}

function update_screen( offset ) {
	var context = canvas.getContext( '2d' );
	var data = context.getImageData( 0, 0, SCREEN_W, SCREEN_H );
	var rgba = new Uint32Array( data.data.buffer );
	for ( var i = 0; i < SCREEN_W * SCREEN_H; ++i ) {
		const color = buffer8[ offset + i ];
		rgba[ i ] = palette32[ palette_type * 16 + color ];
	}
	context.putImageData( data, 0, 0 );
}
