var decrunch = {

	m_src        : null,
	m_src_offset : 0,
	m_dst        : null,
	m_dst_offset : 0,

	m_size : 0,
	m_bits : 0,
	m_crc  : 0,

	read_dword : function( data, offset ) {
		var value = data.charCodeAt( offset )  << 24;
		value |= data.charCodeAt( offset + 1 ) << 16;
		value |= data.charCodeAt( offset + 2 ) <<  8;
		value |= data.charCodeAt( offset + 3 );
		return value;
	},

	next_bit : function( ) {
		var bit = this.m_bits & 1;
		this.m_bits >>>= 1;
		if ( this.m_bits == 0 ) {
			this.m_bits = this.read_dword( this.m_src, this.m_src_offset ); this.m_src_offset -= 4;
			this.m_crc ^= this.m_bits;
			bit = this.m_bits & 1;
			this.m_bits = ( 1 << 31 ) | ( this.m_bits >>> 1 );
		}
		return bit;
	},

	read_bits : function( count ) {
		var value = 0;
		for ( var i = 0; i < count; i += 1 ) {
			value |= this.next_bit( ) << (count - 1 - i);
		}
		return value;
	},

	copy_literal : function( bits, len ) {
		const count = this.read_bits( bits ) + len + 1;
		for ( var i = 0; i < count; i += 1 ) {
			this.m_dst[ this.m_dst_offset ] = this.read_bits( 8 );
			this.m_dst_offset -= 1;
		}
		this.m_size -= count;
	},

	copy_reference : function( bits, count ) {
		const offset = this.read_bits( bits );
		for ( var i = 0; i < count; i += 1 ) {
			this.m_dst[ this.m_dst_offset ] = this.m_dst[ this.m_dst_offset + offset ];
			this.m_dst_offset -= 1;
		}
		this.m_size -= count;
	},

	uncompress : function( data ) {
		this.m_src        = data;
		this.m_src_offset = data.length - 4;

		this.m_size = this.read_dword( this.m_src, this.m_src_offset ); this.m_src_offset -= 4;

		this.m_crc  = this.read_dword( this.m_src, this.m_src_offset ); this.m_src_offset -= 4;
		this.m_bits = this.read_dword( this.m_src, this.m_src_offset ); this.m_src_offset -= 4;
		this.m_crc ^= this.m_bits;

		this.m_dst = new Uint8Array( this.m_size );
		this.m_dst_offset = this.m_size - 1;

		while ( this.m_size > 0 ) {
			if ( !this.next_bit( ) ) {
				if ( !this.next_bit( ) ) {
					this.copy_literal( 3, 0 );
				} else {
					this.copy_reference( 8, 2 );
				}
			} else {
				switch ( this.read_bits( 2 ) ) {
				case 3:
					this.copy_literal( 8, 8 );
					break;
				case 2:
					this.copy_reference( 12, this.read_bits( 8 ) + 1 );
					break;
				case 1:
					this.copy_reference( 10, 4 );
					break;
				case 0:
					this.copy_reference( 9, 3 );
					break;
				}
			}
		}
		console.assert( this.m_crc == 0 );
		return this.m_dst;
	}
}
