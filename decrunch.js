var decrunch = {

	m_in     : null,
	m_inptr  : 0,
	m_out    : null,
	m_outptr : 0,

	m_size : 0,
	m_bits : 0,
	m_crc  : 0,
	m_code : 0,

	readWord : function( data, offset ) {
		var value = 0;
		for( var i = 0; i < 4; i += 1 ) {
			value *= 256;
			value += data.charCodeAt( offset + i );
		}
		return value;
	},

	getBit : function( flag ) {
		var bit = this.m_bits & 1;
		this.m_bits >>>= 1;
		if ( flag ) {
			this.m_bits |= 1 << 31;
		}
		return bit;
	},

	nextBit : function( ) {
		var bit = this.getBit( 0 );
		if ( this.m_bits == 0 ) {
			this.m_bits = this.readWord( this.m_in, this.m_inptr ); this.m_inptr -= 4;
			this.m_crc ^= this.m_bits;
			bit = this.getBit( 1 );
		}
		return bit;
	},

	readBits : function( count ) {
		var value = 0;
		for ( var i = 0; i < count; i += 1 ) {
			value *= 2;
			if ( this.nextBit( ) ) {
				value += 1;
			}
		}
		return value;
	},

	copyLiteral : function( bits, len ) {
		var count = this.readBits( bits ) + len + 1;
		for ( var i = 0; i < count; i += 1 ) {
			this.m_out[ this.m_outptr ] = this.readBits( 8 );
			this.m_outptr -= 1;
		}
		this.m_size -= count;
	},

	copyReference : function( bits ) {
		var offset = this.readBits( bits );
		var count = this.m_code + 1;
		for ( var i = 0; i < count; i += 1 ) {
			this.m_out[ this.m_outptr ] = this.m_out[ this.m_outptr + offset ];
			this.m_outptr -= 1;
		}
		this.m_size -= count;
	},

	uncompress : function( data ) {
		this.m_in   = data;
		this.m_inptr = data.length - 4;

		this.m_size = this.readWord( this.m_in, this.m_inptr ); this.m_inptr -= 4;
		this.m_crc  = this.readWord( this.m_in, this.m_inptr ); this.m_inptr -= 4;
		this.m_bits = this.readWord( this.m_in, this.m_inptr ); this.m_inptr -= 4;

		this.m_crc ^= this.m_bits;

		this.m_out = Array( this.m_size );
		this.m_outptr = this.m_size - 1;

		while ( this.m_size > 0 ) {
			if ( !this.nextBit( ) ) {
				this.m_code = 1;
				if ( !this.nextBit( ) ) {
					this.copyLiteral( 3, 0 );
				} else {
					this.copyReference( 8 );
				}
			} else {
				var code = this.readBits( 2 );
				switch ( code ) {
				case 3:
					this.copyLiteral( 8, 8 );
					break;
				case 2:
					this.m_code = this.readBits( 8 );
					this.copyReference( 12 );
					break;
				default:
					this.m_code = code + 2;
					this.copyReference( code + 9 );
					break;
				}
			}
		}
		console.assert( this.m_crc == 0 );
		return this.m_out;
	}
}
