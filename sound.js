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
        const mem = modules[resNum]
        const buf = load(mem[0], mem[1])
        if (buf) {
            this._resNum = resNum
            this._sfxMod = CreateSfxMod()
            this._sfxMod.curOrder = pos
            this._sfxMod.numOrder = read_uint16(buf, 0x3E)
            console.log(`SfxPlayer::loadSfxModule() curOrder = 0x${this._sfxMod.curOrder.toString(16)} numOrder = 0x${this._sfxMod.numOrder.toString(16)}`)
            debugger
            for (let i = 0; i < 0x80; ++i) {
                this._sfxMod.orderTable[i] = buf[0x40 + i]
            }
            if (delay === 0) {
                this._delay = read_uint16(buf)
            } else {
                this._delay = delay
            }
            this._delay = (this._delay * 60 / 7050) >> 0
            this._sfxMod.data = new Uint8Array(buf.buffer,  0xC0)
            console.log(`SfxPlayer::loadSfxModule() eventDelay = ${this._delay} ms`)
            this.prepareInstruments(new Uint8Array(buf.buffer, 2))
        } else {
            debugger
        }
    }

    prepareInstruments() {
        debugger
        // memset(_sfxMod.samples, 0, sizeof(_sfxMod.samples));
        // for (int i = 0; i < 15; ++i) {
        //     SfxInstrument *ins = &_sfxMod.samples[i];
        //     uint16_t resNum = READ_BE_UINT16(p); p += 2;
        //     if (resNum != 0) {
        //         ins->volume = READ_BE_UINT16(p);
        //         MemEntry *me = &_res->_memList[resNum];
        //         if (me->status == Resource::STATUS_LOADED && me->type == 0) {
        //             ins->data = me->bufPtr;
        //             debug(DBG_SND, "Loaded instrument 0x%X n=%d volume=%d", resNum, i, ins->volume);
        //         } else {
        //             error("Error loading instrument 0x%X", resNum);
        //         }
        //     }
        //     p += 2; // skip volume
        // }
    }
}