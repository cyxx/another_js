class Frac {
	static BITS = 16;
	static MASK = (1 << Frac.BITS) - 1
	inc = 0
	offset = 0

	reset(n, d) {
		this.inc = Math.floor((n << Frac.BITS) / d)
		this.offset = 0
	}

	getInt() {
		return this.offset >> Frac.BITS
	}
	getFrac() {
		return this.offset & Frac.MASK
	}
	interpolate(sample1, sample2, dbg) {
		const fp = this.getFrac()
		if (dbg) {
			console.log(`fp=${fp} MASK=${Frac.MASK} n1=${(sample1 * (Frac.MASK - fp) + sample2 * fp)}, n2=${(sample1 * (Frac.MASK - fp) + sample2 * fp) >> Frac.BITS}`)
		}        
		return ((sample1 * (Frac.MASK - fp) + sample2 * fp) >> Frac.BITS)
	}
}

let prevL = 0
let prevR = 0
let toto = 0
let hasSound = false
let sounds = 0
let samples = ""
let filled = 0

function nr(inp, len, out) {
    let inOffset = 0
    let outOffset = 0
	for (let i = 0; i < len; ++i) {
		const sL = inp[inOffset] >> 1
        inOffset++
		out[outOffset] = sL + prevL
        if (out[outOffset] > 128 || out[outOffset] < -127) {
            debugger
        }
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

const F32Max = (input) => {
    if (input > 1.0) {
        return 1.0
    } else if (input < -1.0) {
        return -1.0
    }
    return input
}

class SfxPlayerProcessor extends AudioWorkletProcessor {
    _ready = false
    _delay = 0
    _resNum = 0
    _sfxMod = null
	_playing = false
	_rate = 0
	_samplesLeft = 0
    _channels = new Array(4).fill(null)

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

            case 'load': {
                const { sfxMod, delay } = event.data
                this._delay = delay
                this.load(sfxMod)
                break
            }

            case 'stop':
                this.stop()
                break

            case 'start':
                this.start()
                break

            case 'setEventsDelay': {
                const { delay } = event.data
                this._delay = delay
                break
            }
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
		// len /= 2
		const s8buf = new Int8Array(len * 2).fill(0)
		this.readSamples(s8buf, len)
        // console.log('***notes end')
		for (let i = 0; i < len; ++i) {
            // left
            out[0][i] = F32Max((s8buf[2*i] / 128.0) + inp[0][i])
            // right
            out[1][i] = F32Max((s8buf[(2*i) + 1] / 128.0) + inp[1][i])
		}
	}

    readSamples(buf, len) {
        if (this._delay === 0) {
            // memset(buf, 0, len * 2);
            debugger
            buf.fill(0, 0, len * 2)
        } else {
            // int8_t *bufin = (int8_t *)alloca(len * 2);
            const bufin = new Int8Array(len * 2)
            this.mixSamples(bufin, len)
            nr(bufin, len, buf)
        }
    }

    mixSamples(buf, len) {
        hasSound = false
        // memset(buf, 0, len * 2); 44100 -> 1000ms
        //                                   133ms  
        buf.fill(0, 0, len * 2)
        const samplesPerTick = Math.floor(this._rate / Math.floor(1000 / this._delay))
        // console.log('len=', len, "notes")
        // console.log('mixSamples() len=${len}')
        let offset = 0
        while (len !== 0) {
            // console.log('len=', len, "notes")
            if (this._samplesLeft === 0) {
                // console.log('** no samples left (notes)')
                this.handleEvents()
                this._samplesLeft = samplesPerTick
                // console.log('samplesLeft', this._samplesLeft, "notes")
            }
            let count = this._samplesLeft
            if (count > len) {
                count = len
            }
            this._samplesLeft -= count
            len -= count
            for (let i = 0; i < count; ++i) {
                buf[offset] = this.mixChannel(buf[offset], this._channels[0], filled >= 409500 && filled < 409520)
                if (filled >= 409500 && filled < 409520) {
                    samples += ` ${buf[offset]}`
                }
                buf[offset] = this.mixChannel(buf[offset], this._channels[3])
                filled++
                offset++

                buf[offset] = this.mixChannel(buf[offset], this._channels[1])
                buf[offset] = this.mixChannel(buf[offset], this._channels[2])
                offset++
            }
        }
        if (hasSound) {
            sounds++
            // if (sounds++ <= 336)
            // for (let i = 0; i < 128; ++i) {
                // console.log('buf', buf[i*2])
            // }            
            // if (sounds === 336) {
                // debugger
            // }
        }
    }

    mixChannel(s, ch, dbg) {
        if (ch.sampleLen === 0) {
            return s
        } else {
            // console.log('filled', filled)
            // debugger
        }
        const pos1 = (ch.pos.offset >> Frac.BITS) >> 0
        ch.pos.offset += ch.pos.inc
        let pos2 = pos1 + 1
        if (dbg) {
            console.log(`pos1=${pos1}, pos2=${pos2} vol=${ch.volume} pos.offset=${ch.pos.offset} (notes)`)
        }
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
        if (dbg) {
            console.log(`(int8_t) sampleData[pos1]=${ch.sampleData[pos1] << 24 >> 24} sampleData[pos2]=${ch.sampleData[pos2] << 24 >> 24}`)
        }
        let sample = ch.pos.interpolate(ch.sampleData[pos1] << 24 >> 24, ch.sampleData[pos2] << 24 >> 24, dbg)
        if (dbg)
            console.log(`=> s=${s}`)
        if (dbg)
            console.log(`=> sample=${sample}`)
        sample = s + (((sample * ch.volume) / 64) >> 0)
        if (dbg)
            console.log(`=> sample=${sample}`)        
        if (sample < -128) {
            sample = -128
        } else if (sample > 127) {
            sample = 127
        }
        hasSound = true
        // if (sample!== 0)
            // debugger
        if (dbg)
            console.log(`=> sample=${sample}`)            
        return sample
    }

    handleEvents() {
        let order = this._sfxMod.orderTable[this._sfxMod.curOrder]
        // console.log('data=', order, this._sfxMod.curPos, this._sfxMod.data.byteOffset)
        let offset = this._sfxMod.data.byteOffset + this._sfxMod.curPos + order * 1024
        // console.log("data=", this._sfxMod.data[0], this._sfxMod.data[1], this._sfxMod.data[2], this._sfxMod.data[3], this._sfxMod.data[4], this._sfxMod.data[5], this._sfxMod.data[6], this._sfxMod.data[7], "offset", offset)
        for (let ch = 0; ch < 4; ++ch) {
            this.handlePattern(ch, new DataView(this._sfxMod.data.buffer, offset))
            // patternData += 4
            offset += 4
        }
        this._sfxMod.curPos += 4 * 4
        console.log(`SfxPlayer::handleEvents() order = 0x${order.toString(16)} curPos = 0x${this._sfxMod.curPos.toString(16)} filled=${filled}`)
        // if (order === 0x1 && this._sfxMod.curPos === 0x310) {
            // console.log(samples)
            // debugger
        // }
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
        // console.log(`SfxPlayer::handlePattern() notes=${pat.note_1}, ${pat.note_2} (pos=${this._sfxMod.curPos + this._sfxMod.orderTable[this._sfxMod.curOrder]})`)
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
                    pat.sampleLen = new DataView(ptr.buffer, ptr.byteOffset).getUint16() * 2
                    const loopLen = new DataView(ptr.buffer, ptr.byteOffset).getUint16(2) * 2
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
                        debugger
                        const volume = (pat.note_2 & 0xFF) >> 0
                        m += volume
                        if (m > 0x3F) {
                            m = 0x3F
                        }
                    } else if (effect === 6) { // volume down
                        const volume = (pat.note_2 & 0xFF)
                        if (volume > 255) {
                            debugger
                        }
                        m -= volume
                        if (m < 0) {
                            m = 0
                        }
                    }
                    this._channels[channel].volume = m
                    pat.sampleVolume = m
                    console.log(`SfxPlayer::handlePattern() vol=${pat.sampleVolume} start=${pat.sampleStart} buf=[0x${pat.sampleBuffer[0].toString(16)},0x${pat.sampleBuffer[1].toString(16)},0x${pat.sampleBuffer[2].toString(16)},0x${pat.sampleBuffer[3].toString(16)},...] len=${pat.sampleLen} loopPos=${pat.loopPos} loopLen=${pat.loopLen} notes`)
                }
            } else {
                // console.log('sample else')
                // debugger
            }
        } else {
            // console.log('else 1')
            // debugger
        }

        if (pat.note_1 === 0xFFFD) {
            console.log(`SfxPlayer::handlePattern() _scriptVars[0xF4] = 0x${pat.note_2.toString(16)}`)
            // *_syncVar = pat.note_2;
            // this._syncVar = pat.note_2
            this.postMessage({
                message: 'syncVar',
                variable: 0xf4,
                value: pat.note_2
            })
        } else if (pat.note_1 !== 0) {
            if (pat.note_1 === 0xFFFE) {
                // console.log('0 :)')
                console.log(`SfxPlayer::handlePattern() channel[${channel}].sampleLen = 0`)
                this._channels[channel].sampleLen = 0
            } else if (pat.sampleBuffer !== null) {
                // assert(pat.note_1 >= 0x37 && pat.note_1 < 0x1000);
                if (pat.note_1 < 0x37 || pat.note_1 >= 0x1000) {
                    console.error(`Assertion failed: ${pat.note_1.toString(16)} >= 0x37 && ${pat.note_1.toString(16)} < 0x1000`)
                }
                // convert amiga period value to hz
                const freq = Math.floor(7159092 / (pat.note_1 * 2))
                console.log(`SfxPlayer::handlePattern() adding sample freq = 0x${freq.toString(16)}`)
                const ch = this._channels[channel]
                ch.sampleData = new Uint8Array(pat.sampleBuffer.buffer, pat.sampleBuffer.byteOffset + pat.sampleStart)
                ch.sampleLen = pat.sampleLen
                ch.sampleLoopPos = pat.loopPos
                ch.sampleLoopLen = pat.loopLen
                ch.volume = pat.sampleVolume
                ch.pos.offset = 0
                ch.pos.inc = Math.floor((freq << Frac.BITS) / this._rate)
                console.log(`SfxPlayer::handlePattern() ch.sampleData = [0x${ch.sampleData[0].toString(16)}, 0x${ch.sampleData[1].toString(16)}, 0x${ch.sampleData[2].toString(16)}, 0x${ch.sampleData[3].toString(16)}, ...]`)
                console.log(`SfxPlayer::handlePattern() ch.sampleLen = 0x${ch.sampleLen.toString(16)}`)
                console.log(`SfxPlayer::handlePattern() ch.sampleLoopPos = 0x${ch.sampleLoopPos.toString(16)}`)
                console.log(`SfxPlayer::handlePattern() ch.sampleLoopLen = 0x${ch.sampleLoopLen.toString(16)}`)
                console.log(`SfxPlayer::handlePattern() ch.volume = 0x${ch.volume.toString(16)}`)
                console.log(`SfxPlayer::handlePattern() ch.pos.inc = 0x${ch.pos.inc.toString(16)}`)
            }
        } else {
            // console.log('else 2')
            // debugger
        }
    }

    process(inputs, outputs) {
        if (this._ready && this._playing) {
            this.mixSfxPlayer(inputs[0], outputs[0], outputs[0][0].length)
        }

        return true
    }
}

registerProcessor('sfxplayer-processor', SfxPlayerProcessor)
