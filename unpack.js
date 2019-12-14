var decrunch = {

	m_in     : null,
	m_inptr  : 0,
	m_out    : null,
	m_outptr : 0,

	m_size : 0,
	m_bits : 0,
	m_crc  : 0,

	readWord : function( data, offset ) {
		var value = data.charCodeAt( offset )  << 24;
		value |= data.charCodeAt( offset + 1 ) << 16;
		value |= data.charCodeAt( offset + 2 ) <<  8;
		value |= data.charCodeAt( offset + 3 );
		return value;
	},

	nextBit : function( ) {
		var bit = this.m_bits & 1;
		this.m_bits >>>= 1;
		if ( this.m_bits == 0 ) {
			this.m_bits = this.readWord( this.m_in, this.m_inptr ); this.m_inptr -= 4;
			this.m_crc ^= this.m_bits;
			bit = this.m_bits & 1;
			this.m_bits = ( 1 << 31 ) | ( this.m_bits >>> 1 );
		}
		return bit;
	},

	readBits : function( count ) {
		var value = 0;
		for ( var i = 0; i < count; i += 1 ) {
			value <<= 1;
			if ( this.nextBit( ) ) {
				value += 1;
			}
		}
		return value;
	},

	copyLiteral : function( bits, len ) {
		const count = this.readBits( bits ) + len + 1;
		for ( var i = 0; i < count; i += 1 ) {
			this.m_out[ this.m_outptr ] = this.readBits( 8 );
			this.m_outptr -= 1;
		}
		this.m_size -= count;
	},

	copyReference : function( bits, count ) {
		const offset = this.readBits( bits );
		for ( var i = 0; i < count; i += 1 ) {
			this.m_out[ this.m_outptr ] = this.m_out[ this.m_outptr + offset ];
			this.m_outptr -= 1;
		}
		this.m_size -= count;
	},

	uncompress : function( data ) {
		this.m_in    = data;
		this.m_inptr = data.length - 4;

		this.m_size = this.readWord( this.m_in, this.m_inptr ); this.m_inptr -= 4;
		this.m_crc  = this.readWord( this.m_in, this.m_inptr ); this.m_inptr -= 4;
		this.m_bits = this.readWord( this.m_in, this.m_inptr ); this.m_inptr -= 4;

		this.m_crc ^= this.m_bits;

		this.m_out = new Uint8Array( this.m_size );
		this.m_outptr = this.m_size - 1;

		while ( this.m_size > 0 ) {
			if ( !this.nextBit( ) ) {
				if ( !this.nextBit( ) ) {
					this.copyLiteral( 3, 0 );
				} else {
					this.copyReference( 8, 2 );
				}
			} else {
				switch ( this.readBits( 2 ) ) {
				case 3:
					this.copyLiteral( 8, 8 );
					break;
				case 2:
					this.copyReference( 12, this.readBits( 8 ) + 1 );
					break;
				case 1:
					this.copyReference( 10, 4 );
					break;
				case 0:
					this.copyReference( 9, 3 );
					break;
				}
			}
		}
		console.assert( this.m_crc == 0 );
		return this.m_out;
	}
}
