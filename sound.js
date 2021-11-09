const CreateSfxMod = () => ({
    orderTable: new Array(0x80),
    curOrder: 0,
    numOrder: 0,
    curPos: 0,
    _data: null,
    _samples: new Array(15).fill(null).map(() => ({
        _data: null,
        volume: 0
    }))
})

class SfxPlayer {
    _delay = 0
    _resNum = 0
    _sfxMod = CreateSfxMod()
	_playing = false
	_rate = 0
	_samplesLeft = 0

    loadSfxModule(resNum, delay, pos) {
        const [data, size] = modules[resNum]
        const buf = load(data, size)
        if (buf) {
            this._resNum = resNum
            this._sfxMod = CreateSfxMod()
            this._sfxMod.curOrder = pos
            this._sfxMod.numOrder = read_be_uint16(buf, 0x3E)
            console.log(`SfxPlayer::loadSfxModule() curOrder = 0x${this._sfxMod.curOrder.toString(16)} numOrder = 0x${this._sfxMod.numOrder.toString(16)}`)
            for (let i = 0; i < 0x80; ++i) {
                this._sfxMod.orderTable[i] = buf[0x40 + i]
            }
            if (delay === 0) {
                this._delay = read_be_uint16(buf)
            } else {
                this._delay = delay
            }
            this._delay = (this._delay * 60 / 7050) >> 0
            this._sfxMod.data = new Uint8Array(buf.buffer,  0xC0)
            console.log(`SfxPlayer::loadSfxModule() eventDelay = ${this._delay} ms`)
            this.prepareInstruments(new Uint8Array(buf.buffer, 2))
            debugger
        } else {
            debugger
        }
    }

    prepareInstruments(p) {
        let offset = 0
        for (let i = 0; i < 15; ++i) {
            const ins = this._sfxMod._samples[i]
            const resNum = read_be_uint16(p, offset)
            console.log(`prepareInstruments() resNum=${resNum}`)
            offset += 2
            if (resNum !== 0) {
                ins.volume = read_be_uint16(p, offset)
                const mem = sounds[resNum]
                if (mem && mem[2]) {
                    ins.data = mem[2]
                    console.log(`Loaded instrument 0x${resNum.toString(16)} n=${i} volume=${ins.volume} -> [${ins.data[0].toString(16)}, ${ins.data[1].toString(16)}, ${ins.data[2].toString(16)}]`)
                } else {
                    console.error(`Error loading instrument 0x${resNum.toString(16)}`)
                }
            }
            offset += 2 // skip volume
        }
    }
}