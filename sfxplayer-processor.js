class Frac {
	static BITS = 16;
	static MASK = (1 << Frac.BITS) - 1
	inc = 0
	offset = 0

	reset(n, d) {
		this.inc = ((n << Frac.BITS) / d) >> 0
		this.offset = 0
	}

	getInt() {
		return this.offset >> Frac.BITS
	}
	getFrac() {
		return offset & Frac.MASK
	}
	interpolate(sample1, sample2) {
		const fp = this.getFrac()
		return ((sample1 * (Frac.MASK - fp) + sample2 * fp) >> Frac.BITS) >> 0
	}
}

function nr(inp, len, out) {
	const prevL = 0
	const prevR = 0
    let inOffset = 0
    let outOffset = 0
	for (let i = 0; i < len; ++i) {
		const sL = inp[inOffset] >> 1
        inOffset++
		out[outOffset] = sL + prevL
        outOffset++
		prevL = sL
		const sR = inp[inOffset] >> 1
        inOffset++
		out[outOffset] = sR + prevR
        outOffset++
		prevR = sR
	}
}

const CreateChannel = () => ({
    sampleData: null,
    sampleLen: 0,
    sampleLoopPos: 0,
    sampleLoopLen: 0,
    volume: 0,
    pos: new Frac()
})

const CreateSfxPattern = () => ({
	note_1: 0,
	note_2: 0,
	sampleStart: 0,
	sampleBuffer: null,
	sampleLen: 0,
	loopPos: 0,
	loopLen: 0,
	sampleVolume: 0
})

class SfxPlayerProcessor extends AudioWorkletProcessor {
    _ready = false
    _delay = 0
    _resNum = 0
    _sfxMod = null
	_playing = false
	_rate = 0
	_samplesLeft = 0
    _channels = new Array(4).fill(null)
    _syncVar = 0

    constructor() {
        super()
        this.port.onmessage = this.handleMessage.bind(this)
    }

    handleMessage(event) {
        switch(event.data.message) {
            case 'init':
                console.log('[soundProcessor] setting mixingRate to', event.data.mixingRate)
                // this._mixingRate = event.data.mixingRate
                this._ready = true
                break

            case 'play':
                const { mixingRate } = event.data
                this.play(mixingRate)
                break

            case 'load':
                const { sfxMod } = event.data
                this.load(sfxMod)
                break

            case 'stop':
                this.stop()
                break

            case 'start':
                this.start()
                break

            case 'setEventsDelay':
                this._delay = (delay * 60 / 7050) >> 0
                break
        }
    }

    postMessage(message) {
        this.port.postMessage(message)
    }

    load(sfxMod) {
        this._sfxMod = sfxMod
    }

    start() {
        this._sfxMod.curPos = 0        
    }

    stop() {
        this._playing = false
        this._resNum = 0        
    }

    play(rate) {
        this._playing = true
        this._rate = rate
        this._samplesLeft = 0
        // memset(_channels, 0, sizeof(_channels));
        this._channels = this._channels.map(() => CreateChannel())        
    }

    // void *data, uint8_t *s16buf, int len
    mixSfxPlayer(inp, out, len) {
		len /= 2
		const s8buf = new Int8Array(len)
		// memset(s8buf, 0, len);
		this.readSamples(s8buf, len / 2)
		for (let i = 0; i < len; ++i) {
			out[i * 2] = 256 * s8buf[i]
		}
	}

    readSamples(buf, len) {
        if (this._delay === 0) {
            // memset(buf, 0, len * 2);
            buf.fill(0, 0, len * 2)
        } else {
            // int8_t *bufin = (int8_t *)alloca(len * 2);
            const bufin = new Int8Array(len * 2)
            this.mixSamples(bufin, len)
            nr(bufin, len, buf)
        }
    }

    mixSamples(buf, len) {
        // memset(buf, 0, len * 2);
        buf.fill(0, 0, len * 2)
        const samplesPerTick = (this._rate / (1000 / this._delay)) >> 0
        while (len !== 0) {
            if (this._samplesLeft === 0) {
                this.handleEvents()
                this._samplesLeft = samplesPerTick
            }
            let count = this._samplesLeft
            if (count > len) {
                count = len
            }
            this._samplesLeft -= count
            len -= count
            let offset = buf.buffer.offset
            for (let i = 0; i < count; ++i) {
                buf[offset] = this.mixChannel(buf[offset], this._channels[0])
                buf[offset] = this.mixChannel(buf[offset], this._channels[3])
                offset++
                buf[offset] = this.mixChannel(buf[offset], this._channels[1])
                buf[offset] = this.mixChannel(buf[offset], this._channels[2])
                offset++
            }
        }
    }

    mixChannel(s, ch) {
        if (ch.sampleLen === 0) {
            return s
        }
        const pos1 = (ch.pos.offset >> Frac.BITS) >> 0
        ch.pos.offset += ch.pos.inc
        let pos2 = pos1 + 1
        if (ch.sampleLoopLen !== 0) {
            if (pos1 === ch.sampleLoopPos + ch.sampleLoopLen - 1) {
                pos2 = ch.sampleLoopPos
                ch.pos.offset = (pos2 << Frac.BITS) >> 0
            }
        } else {
            if (pos1 === ch.sampleLen - 1) {
                ch.sampleLen = 0
                return s
            }
        }
        const sample = ch.pos.interpolate(ch.sampleData[pos1] << 24 >> 24, ch.sampleData[pos2]<< 24 >> 24)
        sample = (s + sample * ch.volume / 64) >> 0
        if (sample < -128) {
            sample = -128
        } else if (sample > 127) {
            sample = 127
        }
        return sample
    }

    handleEvents() {
        let order = this._sfxMod.orderTable[this._sfxMod.curOrder]
        let offset = this._sfxMod.data.offset + this._sfxMod.curPos + order * 1024
        for (let ch = 0; ch < 4; ++ch) {
            this.handlePattern(ch, new DataView(this._sfxMod.data.buffer, offset))
            // patternData += 4
            offset += 4
        }
        this._sfxMod.curPos += 4 * 4
        console.log(`SfxPlayer::handleEvents() order = 0x${order.toString(16)} curPos = 0x${this._sfxMod.curPos.toString(16)}`)
        if (this._sfxMod.curPos >= 1024) {
            this._sfxMod.curPos = 0
            order = this._sfxMod.curOrder + 1
            if (order === this._sfxMod.numOrder) {
                this._resNum = 0
                this._playing = false
            }
            this._sfxMod.curOrder = order
        }
    }
    
    handlePattern(channel, data) {
        // let SfxPattern pat;
        // memset(&pat, 0, sizeof(SfxPattern));
        const pat = CreateSfxPattern()
        // pat.note_1 = READ_BE_UINT16(data + 0);
        // pat.note_2 = READ_BE_UINT16(data + 2);
        pat.note_1 = data.getUint16()
        pat.note_2 = data.getUint16(2)        
        if (pat.note_1 !== 0xFFFD) {
            const sample = ((pat.note_2 & 0xF000) >> 12) >> 0
            if (sample !== 0) {
                const ptr = this._sfxMod.samples[sample - 1].data
                if (ptr !== null) {
                    console.log(`SfxPlayer::handlePattern() preparing sample ${sample}`)
                    pat.sampleVolume = this._sfxMod.samples[sample - 1].volume
                    pat.sampleStart = 8
                    pat.sampleBuffer = ptr
                    // pat.sampleLen = READ_BE_UINT16(ptr) * 2;
                    // uint16_t loopLen = READ_BE_UINT16(ptr + 2) * 2;                    
                    pat.sampleLen = new DataView(ptr.buffer).getUint16() * 2
                    const loopLen = new DataView(ptr.buffer).getUint16(2) * 2
                    if (loopLen !== 0) {
                        pat.loopPos = pat.sampleLen
                        pat.loopLen = loopLen
                    } else {
                        pat.loopPos = 0
                        pat.loopLen = 0
                    }
                    let m = pat.sampleVolume
                    const effect = ((pat.note_2 & 0x0F00) >> 8) >> 0
                    if (effect === 5) { // volume up
                        const volume = (pat.note_2 & 0xFF) >> 0
                        m += volume
                        if (m > 0x3F) {
                            m = 0x3F
                        }
                    } else if (effect === 6) { // volume down
                        const volume = (pat.note_2 & 0xFF) >> 0
                        m -= volume
                        if (m < 0) {
                            m = 0
                        }
                    }
                    this._channels[channel].volume = m
                    pat.sampleVolume = m
                }
            }
        }
        if (pat.note_1 === 0xFFFD) {
            console.log(`SfxPlayer::handlePattern() _scriptVars[0xF4] = 0x${pat.note_2.toString(16)}`)
            // *_syncVar = pat.note_2;
            this._syncVar = pat.note_2
        } else if (pat.note_1 !== 0) {
            if (pat.note_1 === 0xFFFE) {
                this._channels[channel].sampleLen = 0
            } else if (pat.sampleBuffer !== null) {
                // assert(pat.note_1 >= 0x37 && pat.note_1 < 0x1000);
                if (pat.note_1 < 0x37 || pat.note_1 >= 0x1000) {
                    console.error(`Assertion failed: ${pat.note_1.toString(16)} >= 0x37 && ${pat.note_1.toString(16)} < 0x1000`)
                }
                // convert amiga period value to hz
                const freq = (7159092 / (pat.note_1 * 2)) >> 0
                console.log(`SfxPlayer::handlePattern() adding sample freq = 0x${freq.toString(16)}`)
                const ch = this._channels[channel]
                ch.sampleData = new UInt8Array(pat.sampleBuffer.buffer, pat.sampleBuffer.buffer.offset + pat.sampleStart)
                ch.sampleLen = pat.sampleLen
                ch.sampleLoopPos = pat.loopPos
                ch.sampleLoopLen = pat.loopLen
                ch.volume = pat.sampleVolume
                ch.pos.offset = 0
                ch.pos.inc = ((freq << Frac.BITS) / this._rate) >> 0
            }
        }
    }

    process(inputs, outputs, params) {
        if (this._ready && this._playing) {
            this.mixSfxPlayer(inputs[0][0], outputs[0][0], outputs[0][0].length)
        }

        return true
    }    
}

registerProcessor('sfxplayer-processor', SfxPlayerProcessor)
