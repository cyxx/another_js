import * as Res from './ootwdemo-data'
import { SfxPlayer } from './sound'
import pako from 'pako'
import nipplejs from 'nipplejs';
import './main.css'

const KEY_UP     = 1;
const KEY_RIGHT  = 2;
const KEY_DOWN   = 3;
const KEY_LEFT   = 4;
const KEY_ACTION = 5;

function onPauseClick( ) {
    if ( pause( ) ) {
        pauseButton.value = "Play";
    } else {
        pauseButton.value = "Pause";
    }
}
function onResetClick( ) {
    reset( );
}
function onRewindClick( ) {
    rewind( );
}
function onLanguageChange( e ) {
    change_language( e.currentTarget.selectedIndex );
}
function onPaletteChange( e ) {
    change_palette( e.currentTarget.selectedIndex );
}
function onPartChange( e ) {
    change_part( e.currentTarget.selectedIndex );
}
function onLowResolutionClick( e ) {
    set_1991_resolution( e.currentTarget.checked );
}

function getFullscreenSize() {
	const width = screen.width
	const height = screen.height
	const isFirefox = navigator.userAgent.match(/Firefox/)
	const ratio = width / height
	let newWidth = width
	let newHeight = width * ratio
	if (ratio > 0) {
		newHeight = height
		newWidth = newHeight * ratio
	}
	return {
		width: newWidth,
		height: newHeight,
		top: isFirefox ? (height - newHeight) / 2 : 0,
		left: isFirefox ? (width - newWidth) / 2 : 0
	}
}

function onFullscreenChange(isFullscreen) {
	if (isFullscreen) {
		const {
			width,
			height,
			top,
			left
		} = getFullscreenSize()
		let style = game.style
		style.width = `${width}px`
		style.height = `${height}px`

		style = canvas.style
		style.top = `${top}px`
		style.left = `${left}px`
		style.width = `${width}px`
		style.height = `${height}px`
	} else {
		let style = game.style
		style.removeProperty('width')
		style.removeProperty('height')

		style = canvas.style
		style.removeProperty('top')
		style.removeProperty('left')
		style.removeProperty('width')
		style.removeProperty('height')
	}
}

function bind_events() {
	document.onkeydown = function( e ) { set_key_pressed( e, 1 ); }
	document.onkeyup   = function( e ) { set_key_pressed( e, 0 ); }
	pauseButton.onclick = onPauseClick
	resetButton.onclick = onResetClick
	rewindButton.onclick = onRewindClick
	languageSelect.onchange = onLanguageChange
	paletteSelect.onchange = onPaletteChange
	partSelect.onchange = onPartChange
	resolutionCheckbox.onclick = onLowResolutionClick
	document.onfullscreenchange = () => {
		if (!document.fullscreenElement) {
			document.exitFullscreen()
			onFullscreenChange(false)
		}
	}
	game.ondblclick = () => {
		if (document.fullscreenElement) {
			document.exitFullscreen()
			onFullscreenChange(false)
		} else {
			game.requestFullscreen()
			onFullscreenChange(true)
		}
	}

	touch_manager = nipplejs.create({
		zone: document.getElementsByClassName('square')[0],
		mode: 'static',
		position: {
			left: '50%',
			top: '50%'
		},
	});

	touch_manager.on('dir:right', function (evt, data) {
		// console.log(evt.type, data.direction)
		console.log('right')
		keyboard[ KEY_LEFT ] = 0;
		keyboard[ KEY_UP ] = 0;
		keyboard[ KEY_DOWN ] = 0;
		keyboard[ KEY_RIGHT ] = 1;
	}).on('dir:left', (evt, data) => {
		console.log('left')
		keyboard[ KEY_LEFT ] = 1;
		keyboard[ KEY_UP ] = 0;
		keyboard[ KEY_DOWN ] = 0;
		keyboard[ KEY_RIGHT ] = 0;		
	}).on('dir:up', (evt, data) => {
		console.log('up')
		keyboard[ KEY_LEFT ] = 0;
		keyboard[ KEY_UP ] = 1;
		keyboard[ KEY_DOWN ] = 0;
		keyboard[ KEY_RIGHT ] = 0;		
	}).on('dir:down', (evt, data) => {
		console.log('down')
		keyboard[ KEY_LEFT ] = 0;
		keyboard[ KEY_UP ] = 0;
		keyboard[ KEY_DOWN ] = 1;
		keyboard[ KEY_RIGHT ] = 0;		
	}).on('end', () => {
		console.log('end joystick')
		keyboard[ KEY_LEFT ] = 0;
		keyboard[ KEY_UP ] = 0;
		keyboard[ KEY_DOWN ] = 0;
		keyboard[ KEY_RIGHT ] = 0;
	})

	let button = nipplejs.create({
		zone: document.getElementsByClassName('square2')[0],
		threshold: 0,
		mode: 'static',
		lockX: true,
		lockY: true,
		position: {
			left: '50%',
			top: '50%'
		},
	});

	button.on('start end', (evt) => {
		let id = 0
		if (evt.type === 'start') {
			if (id) {
				clearTimeout(id)
				id = 0
			}
			keyboard[ KEY_ACTION ] = 1;
		} else {
			id = setTimeout(() => {
				keyboard[ KEY_ACTION ] = 0;
			}, 5)
			// skip intro
			if (!next_part && current_part !== 16002) {
				change_part(1)
			}			
		}
	})
}

var keyboard = new Array( 6 );

function is_key_pressed( code ) {
	return keyboard[ code ];
}

function set_key_pressed( e, state ) {
	const jcode = e.keyCode

	if ( jcode == 37 ) {
		keyboard[ KEY_LEFT ] = state;
	} else if ( jcode == 38 ) {
		keyboard[ KEY_UP ] = state;
	} else if ( jcode == 39 ) {
		keyboard[ KEY_RIGHT ] = state;
	} else if ( jcode == 40 ) {
		keyboard[ KEY_DOWN ] = state;
	} else if ( jcode == 32 || jcode == 13 ) {
		e.preventDefault();
		keyboard[ KEY_ACTION ] = state;
	} else if (jcode === 8 || jcode === 9) {
		change_part(1);
	}
}

const _freqTable = [
	0x0CFF, 0x0DC3, 0x0E91, 0x0F6F, 0x1056, 0x114E, 0x1259, 0x136C, 
	0x149F, 0x15D9, 0x1726, 0x1888, 0x19FD, 0x1B86, 0x1D21, 0x1EDE, 
	0x20AB, 0x229C, 0x24B3, 0x26D7, 0x293F, 0x2BB2, 0x2E4C, 0x3110, 
	0x33FB, 0x370D, 0x3A43, 0x3DDF, 0x4157, 0x4538, 0x4998, 0x4DAE, 
	0x5240, 0x5764, 0x5C9A, 0x61C8, 0x6793, 0x6E19, 0x7485, 0x7BBD
]

const VAR_HERO_POS_UP_DOWN     = 0xe5;
const VAR_SCROLL_Y             = 0xf9;
const VAR_HERO_ACTION          = 0xfa;
const VAR_HERO_POS_JUMP_DOWN   = 0xfb;
const VAR_HERO_POS_LEFT_RIGHT  = 0xfc;
const VAR_HERO_POS_MASK        = 0xfd;
const VAR_HERO_ACTION_POS_MASK = 0xfe;
const VAR_PAUSE_SLICES         = 0xff;
const VAR_MUSIC_SYNC           = 0xf4;

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
var current_part = 0;

var delay = 0;
var timestamp;
var touch_manager = null;

function read_byte( ) {
	const value = bytecode[ bytecode_offset ];
	bytecode_offset += 1;
	return value;
}

function read_be_uint16(buf, offset) {
	return ( buf[ offset ] << 8) | buf[ offset + 1 ];
}

function read_word() {
	// const value = ( bytecode[ bytecode_offset ] << 8) | bytecode[ bytecode_offset + 1 ];
	const value = read_be_uint16(bytecode, bytecode_offset)
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
		// console.log(`Script::op_movConst(0x%${num.toString(16)}, ${imm})`)
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
		// gun sound workaround to do
		if (current_part === 16006) {
			debugger
			// snd_playSound(0x5B, 1, 64, 1);
		}

	},
	0x04 : function( ) { // call
		const addr = read_word( );
		// console.log(`Script::op_call(0x${addr.toString(16)})`);
		tasks[ task_num ].stack.push( bytecode_offset );
		bytecode_offset = addr;
	},
	0x05 : function( ) { // ret
		// console.log(`Script::op_ret()`)
		bytecode_offset = tasks[ task_num ].stack.pop( );
	},
	0x06 : function( ) { // yield
		// console.log(`Script::op_yieldTask()`)
		task_paused = true;
	},
	0x07 : function( ) { // jmp
		bytecode_offset = read_word( );
	},
	0x08 : function( ) { // install_task
		const num  = read_byte( );
		const addr = read_word( );
		// console.log(`Script::op_installTask(0x${num.toString(16)}, 0x${addr.toString(16)})`)		
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
		play_sound(num, freq, volume, channel)
	},
	0x19 : function( ) { // load_resource
		const num = read_word( );
		if ( num > 16000 ) {
			next_part = num;
		} else if ( num in Res.bitmaps ) {
			if ( num >= 3000 ) {
				// should also load t3%d.bmp files for transparency (color 0x10)
				set_palette_bmp( load( Res.bitmaps[ num ][ 0 ], 256 * 3 ) );
				buffer8.set( load( Res.bitmaps[ num ][ 1 ], SCREEN_W * SCREEN_H ) );
			} else {
				draw_bitmap( num );
			}
		}
	},
	0x1a : function( ) { // play_music
		const num      = read_word( );
		const period   = read_word( );
		const position = read_byte( );
		console.log(`Script::op_playMusic(0x${num.toString(16)}, ${period}, ${position})`)
		play_music(num, period, position)
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
			var zoom = 64;
			if ( ( opcode & 2 ) == 0 ) {
				if ( opcode & 1 ) {
					zoom = vars[ read_byte( ) ];
				}
			} else {
				if ( opcode & 1 ) {
					polygons = polygons2;
				} else {
					zoom = read_byte( );
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
		vars[ VAR_HERO_POS_UP_DOWN ] = 1;
		mask |= 4;
	} else if ( is_key_pressed( KEY_UP ) ) {
		vars[ VAR_HERO_POS_JUMP_DOWN ] = -1;
		vars[ VAR_HERO_POS_UP_DOWN ] = -1;
		mask |= 8;
	} else {
		vars[ VAR_HERO_POS_JUMP_DOWN ] = 0;
		vars[ VAR_HERO_POS_UP_DOWN ] = 0;
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
		current_part = next_part;
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
		var len = data.length;
		var bytes = new Uint8Array(len);
		for (var i = 0; i < len; i++) {
			bytes[i] = data.charCodeAt(i);
		}
		var buf = pako.inflate( bytes );
		console.assert( buf.length == size );
		return buf;
	}
	var buf = new Uint8Array( size );
	for ( var i = 0; i < data.length; ++i ) {
		buf[ i ] = data.charCodeAt( i ) & 0xff;
	}
	return buf;
}

function restart( part ) {
	if ( part == 16000 ) { // protection
		palette   = load( Res.data14, Res.size14 );
		bytecode  = load( Res.data15, Res.size15 );
		polygons1 = load( Res.data16, Res.size16 );
		polygons2 = null;
	} else if ( part == 16001 ) { // introduction
		palette   = load( Res.data17, Res.size17 );
		bytecode  = load( Res.data18, Res.size18 );
		polygons1 = load( Res.data19, Res.size19 );
		polygons2 = null;
	} else if ( part == 16002 ) { // water
		palette   = load( Res.data1a, Res.size1a );
		bytecode  = load( Res.data1b, Res.size1b );
		polygons1 = load( Res.data1c, Res.size1c );
		polygons2 = load( Res.data11, Res.size11 );
	} else if ( part == 16003 ) { // jail
		palette   = load( Res.data1d, Res.size1d );
		bytecode  = load( Res.data1e, Res.size1e );
		polygons1 = load( Res.data1f, Res.size1f );
		polygons2 = load( Res.data11, Res.size11 );
	} else if ( part == 16004 ) { // 'cite'
		palette   = load( Res.data20, Res.size20 );
		bytecode  = load( Res.data21, Res.size21 );
		polygons1 = load( Res.data22, Res.size22 );
		polygons2 = load( Res.data11, Res.size11 );
	} else if ( part == 16005 ) { // 'arene'
		palette   = load( Res.data23, Res.size23 );
		bytecode  = load( Res.data24, Res.size24 );
		polygons1 = load( Res.data25, Res.size25 );
		polygons2 = load( Res.data11, Res.size11 );
	} else if ( part == 16006 ) { // 'luxe'
		palette   = load( Res.data26, Res.size26 );
		bytecode  = load( Res.data27, Res.size27 );
		polygons1 = load( Res.data28, Res.size28 );
		polygons2 = load( Res.data11, Res.size11 );
	} else if ( part == 16007 ) { // 'final'
		palette   = load( Res.data29, Res.size29 );
		bytecode  = load( Res.data2a, Res.size2a );
		polygons1 = load( Res.data2b, Res.size2b );
		polygons2 = load( Res.data11, Res.size11 );
	} else if ( part == 16008 ) { // password screen
		palette   = load( Res.data7d, Res.size7d );
		bytecode  = load( Res.data7e, Res.size7e );
		polygons1 = load( Res.data7f, Res.size7f );
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

var is_1991; // 320x200

var palette_bmp = new Uint32Array( 256 * 3 ); // 15th edition backgrounds

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
	// console.log(`Script::op_selectPage(${num})`)
	current_page0 = get_page( num );
}

function fill_page( num, color ) {
	// console.log(`Script::op_fillPage(${num}, ${color})`)
	num = get_page( num );
	buffer8.fill( color, num * PAGE_SIZE, ( num + 1 ) * PAGE_SIZE );
}

function copy_page( src, dst, vscroll ) {
	dst = get_page( dst );
	if ( src >= 0xfe ) {
		src = get_page( src );
		buffer8.set( buffer8.subarray( src * PAGE_SIZE, ( src + 1 ) * PAGE_SIZE ), dst * PAGE_SIZE );
	} else {
		if ( ( src & 0x80 ) == 0 ) {
			vscroll = 0;
		}
		src = get_page( src & 3 );
		if ( dst == src ) {
			return;
		}
		const dst_offset = dst * PAGE_SIZE;
		const src_offset = src * PAGE_SIZE;
		if ( vscroll == 0 ) {
			buffer8.set( buffer8.subarray( src_offset, src_offset + PAGE_SIZE ), dst_offset );
		} else {
			//console.log( 'vscroll:' + vscroll );
			vscroll *= SCALE;
			if ( vscroll > -SCREEN_W && vscroll < SCREEN_W ) {
				const h = vscroll * SCREEN_W;
				if ( vscroll < 0 ) {
					buffer8.set( buffer8.subarray( src_offset - h, src_offset + PAGE_SIZE ), dst_offset );
				} else {
					buffer8.set( buffer8.subarray( src_offset, src_offset + PAGE_SIZE - h ), dst_offset + h );
				}
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
		console.assert( page != 0 );
		buffer8[ offset ] = buffer8[ y * SCREEN_W + x ];
	} else if ( color == 0x10 ) {
		buffer8[ offset ] |= 8;
	} else {
		console.assert( color < 0x10 );
		buffer8[ offset ] = color;
	}
}

function draw_line( page, color, y, x1, x2 ) {
	if ( x1 > x2 ) {
		const tmp = x1;
		x1 = x2;
		x2 = tmp;
	}
	if ( x1 >= SCREEN_W || x2 < 0 ) {
		return;
	}
	if ( x1 < 0 ) {
		x1 = 0;
	}
	if ( x2 >= SCREEN_W ) {
		x2 = SCREEN_W - 1;
	}
	const offset = page * PAGE_SIZE + y * SCREEN_W;
	if ( color == 0x11 ) {
		console.assert( page != 0 );
		buffer8.set( buffer8.subarray( y * SCREEN_W + x1, y * SCREEN_W + x2 + 1 ), offset + x1 );
	} else if ( color == 0x10 ) {
		for ( var i = x1; i <= x2; ++i ) {
			buffer8[ offset + i ] |= 8;
		}
	} else {
		console.assert( color < 0x10 );
		buffer8.fill( color, offset + x1, offset + x2 + 1);
	}
}

function draw_polygon( page, color, vertices ) {
	// scanline fill
	var i = 0;
	var j = vertices.length - 1;
	var scanline = Math.min( vertices[ i ].y, vertices[ j ].y );
	var f2 = vertices[ i++ ].x << 16;
	var f1 = vertices[ j-- ].x << 16;
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
					draw_line( page, color, scanline, f1 >> 16, f2 >> 16 );
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
	const w = ( data[ offset++ ] * zoom / 64 ) >> 0;
	const h = ( data[ offset++ ] * zoom / 64 ) >> 0;
	const x1 = ( x * SCALE - w * SCALE / 2 ) >> 0;
	const x2 = ( x * SCALE + w * SCALE / 2 ) >> 0;
	const y1 = ( y * SCALE - h * SCALE / 2 ) >> 0;
	const y2 = ( y * SCALE + h * SCALE / 2 ) >> 0;
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
		draw_point( current_page0, color, x1, y1 );
        } else {
		draw_polygon( current_page0, color, vertices );
	}
}

function draw_shape_parts( data, offset, zoom, x, y ) {
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
			draw_shape_parts( data, offset, zoom, x, y );
		}
	}
}

function put_pixel( page, x, y, color ) {
	var offset = page * PAGE_SIZE + ( y * SCREEN_W + x ) * SCALE;
	for ( var j = 0; j < SCALE; ++j ) {
		buffer8.fill( color, offset, offset + SCALE );
		offset += SCREEN_W;
	}
}

function draw_char( page, chr, color, x, y ) {
	if ( x < ( 320 / 8 ) && y < ( 200 - 8 ) ) {
		for ( var j = 0; j < 8; ++j ) {
			const mask = Res.font[ ( chr - 32 ) * 8 + j ];
			for ( var i = 0; i < 8; ++i ) {
				if ( ( mask & ( 1 << ( 7 - i ) ) ) != 0 ) {
					put_pixel( page, x * 8 + i, y + j, color );
				}
			}
		}
	}
}

const STRINGS_LANGUAGE_EN = 0;
const STRINGS_LANGUAGE_FR = 1;

var strings_language = STRINGS_LANGUAGE_EN;

function draw_string( num, color, x, y ) {
	var strings = Res.strings_en;
	if ( strings_language == STRINGS_LANGUAGE_FR && ( num in Res.strings_fr ) ) {
		strings = Res.strings_fr;
	}
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

function draw_bitmap( num ) {
	const size = Res.bitmaps[ num ][ 1 ];
	console.assert( size == 32000 );
	const buf = load( Res.bitmaps[ num ][ 0 ], size );
	var offset = 0;
	for ( var y = 0; y < 200; ++y ) {
		for ( var x = 0; x < 320; x += 8 ) {
			for ( var b = 0; b < 8; ++b ) {
				const mask = 1 << ( 7 - b );
				var color = 0;
				for ( var p = 0; p < 4; ++p ) {
					if ( buf[ offset + p * 8000 ] & mask ) {
						color |= 1 << p;
					}
				}
				put_pixel( 0, x + b, y, color );
			}
			offset += 1;
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

function set_palette_bmp( data ) {
	var color = 0;
	for ( var i = 0; i < 256; ++i ) {
		palette_bmp[ i ] = 0xff000000 | ( data[ color + 2 ] << 16 ) | ( data[ color + 1 ] << 8 ) | data[ color ];
		color += 3;
	}
}

function update_display( num ) {
	// console.log(`Script::op_updateDisplay(${num})`)
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

const REWIND_SIZE = 10;
const REWIND_INTERVAL = 5000;
var rewind_buffer = new Array( );
var rewind_timestamp;

function save_state( ) {
	return { vars: vars.slice( ), tasks: JSON.parse( JSON.stringify( tasks ) ), buffer8: buffer8.slice( ), palette32: palette32.slice( ) }
}

function load_state( state ) {
	vars = state.vars;
	tasks = state.tasks;
	buffer8 = state.buffer8;
	palette32 = state.palette32;
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
	timestamp = rewind_timestamp = Date.now( );
	rewind_buffer.length = 0;
	player.stopMusic();
}

function tick( ) {
	const current = Date.now( );
	delay -= current - timestamp;
	while ( delay <= 0 ) {
		run_tasks( );
	}
	timestamp = current;

	if ( rewind_timestamp + REWIND_INTERVAL < current ) {
		if ( rewind_buffer.length == REWIND_SIZE ) {
			rewind_buffer.shift( );
		}
		rewind_buffer.push( save_state( ) );
		rewind_timestamp = current;
	}
}

const INTERVAL = 50;
var canvas;
var timer;
var player;

start.onclick = function () {
	start.style.display = 'none'
	init('screen')
}

async function init( name ) {
	canvas = document.getElementById( name );
	player = new SfxPlayer((variable, value) => {
		vars[variable] = value
	})
	await player.init()
	bind_events()
	load_modules()
	load_sounds()
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

function rewind( ) {
	if ( rewind_buffer.length != 0 ) {
		// console.log( 'rewind pos:' + rewind_buffer.length );
		var state = rewind_buffer.pop( );
		load_state( state );
	}
}

function change_palette( num ) {
	palette_type = num;
}

function change_part( num ) {
	reset( );
	next_part = 16001 + num;
	// console.log( 'next_part:' + next_part );
}

function change_language( num ) {
	strings_language = num;
}

function set_1991_resolution( low ) {
	is_1991 = low;
}

function update_screen( offset ) {
	var context = canvas.getContext( '2d' );
	var data = context.getImageData( 0, 0, SCREEN_W, SCREEN_H );
	var rgba = new Uint32Array( data.data.buffer );
	if ( is_1991 ) {
		var rgba_offset = 0;
		for ( var y = 0; y < SCREEN_H; y += SCALE ) {
			for ( var x = 0; x < SCREEN_W; x += SCALE ) {
				const color = palette32[ palette_type * 16 + buffer8[ offset + x ] ];
				for ( var j = 0; j < SCALE; ++j ) {
					rgba.fill( color, rgba_offset + j * SCREEN_W + x, rgba_offset + j * SCREEN_W + x + SCALE );
				}
			}
			rgba_offset += SCREEN_W * SCALE;
			offset += SCREEN_W * SCALE;
		}
	} else {
		for ( var i = 0; i < SCREEN_W * SCREEN_H; ++i ) {
			const color = buffer8[ offset + i ];
			if ( color < 16 ) {
				rgba[ i ] = palette32[ palette_type * 16 + color ];
			} else {
				rgba[ i ] = palette_bmp[ color - 16 ];
			}
		}
	}
	context.putImageData( data, 0, 0 );
}

function play_music(resNum, delay, pos) {
	if (resNum !== 0) {
		// _ply->loadSfxModule(resNum, delay, pos);
		player.loadSfxModule(resNum, delay, pos, Res)
		player.startMusic()
		player.playMusic(resNum)
	} else if (delay !== 0) {
		player.setEventsDelay(delay, true)
	} else {
		player.stopMusic()
	}
}

function play_sound(resNum, freq, vol, channel) {
	if (vol === 0) {
		player.stopSound(channel)
		return
	}
	if (vol > 63) {
		vol = 63
	}
	try {
		if (Res.sounds[resNum]) {
			const [,,me] = Res.sounds[resNum]
			if (me) {
				// assert(freq < 40);
				if (freq >= 40) {
					console.error(`Assertion failed: $({freq} < 40`)
				}
				player.playSoundRaw(channel & 3, me, _freqTable[freq], vol)
			}
		}
	} catch(e) {
		console.error(`Could not play raw sound ${resNum}`)
		debugger
	}
}

function load_modules() {
	Object.entries(Res.modules).forEach(([,module]) => {
		const [data, size] = module
		module.push(load(data, size))
	})
}

function load_sounds() {
	Object.entries(Res.sounds).forEach(([,sound]) => {
		const [data, size] = sound
		sound.push(load(data, size))
	})
}
