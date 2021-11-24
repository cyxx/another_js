const CreateSfxMod = () => ({
    orderTable: new Array(0x80),
    curOrder: 0,
    numOrder: 0,
    curPos: 0,
    data: null,
    samples: new Array(15).fill(null).map(() => ({
        data: null,
        volume: 0
    }))
})

const createSfx = () => ({
    sample: null,
    volume: 0,
    loops: 0,
    loop: 0
})

class SfxPlayer {
    _delay = 0
    _resNum = 0
    _sfxMod = CreateSfxMod()
	_rate = 0
    _channels = new Array(4).fill(null)

    // new
    _audioContext = null
    _sfxRawWorklet = null
    _sfxPlayerWorklet = null

    constructor() {
        console.log('SfxPlayer::contructor')
		this._audioContext = new window.AudioContext()
		this.resumeAudio()
    }

    async init() {
        console.log('SfxPlayer::init')
        await this.initAudio()
        this.initEvents()
    }

    async initAudio() {
        try {
            console.log('SfxPlayer::initAudio')
            this._rate = this._audioContext.sampleRate
    
            await this._audioContext.audioWorklet.addModule('sfxplayer-processor.js')
            await this._audioContext.audioWorklet.addModule('sfxraw-processor.js')
            // const filterNode = this._audioContext.createBiquadFilter()
            // filterNode.frequency.value = 22050
            this._sfxRawWorklet = new AudioWorkletNode(this._audioContext, 'sfxraw-processor', {
                outputChannelCount: [1],
                numberOfInputs: 0,
                numberOfOutputs: 1
            })

            this._sfxRawWorklet.port.onmessage = this.onSFXRawProcessorMessage.bind(this)
            this._sfxRawWorklet.port.start()

            this._sfxPlayerWorklet = new AudioWorkletNode(this._audioContext, 'sfxplayer-processor', {
                outputChannelCount: [2],
                numberOfInputs: 0,
                numberOfOutputs: 1
            });
            this._sfxPlayerWorklet.port.onmessage = this.onSFXPlayerProcessorMessage.bind(this)
            this._sfxPlayerWorklet.port.start()

            this._sfxRawWorklet.connect(this._audioContext.destination)
            this._sfxPlayerWorklet.connect(this._audioContext.destination)
            //this._sfxRawWorklet.connect(this._audioContext.destination)

			this.postMessageToSFXPlayerProcessor({
				message: 'init',
				mixingRate: this._rate,
			})

			this.postMessageToSFXRawProcessor({
				message: 'init',
				mixingRate: this._rate,
			})            

        } catch(e) {
            console.error(`Error during initAudio: ${e} ${e.stack}`)
        }
    }

    initEvents() {
	    document.addEventListener('click', () => this.resumeAudio())
    }

    resumeAudio() {
        if (this._audioContext && this._audioContext.state === 'suspended') {
			this._audioContext.resume()
		}
    }

    setEventsDelay(delay, shouldSend = false) {
        this._delay = (delay * 60 / 7050) >> 0
        if (shouldSend) {
            this.postMessageToSFXPlayerProcessor({
                message: 'setEventsDelay',
                delay: this._delay
            })            
        }
    }

	onSFXPlayerProcessorMessage(event) {
		// console.log('Message from sfplayer processor', event)
        const data = event.data
		switch(data.message) {
            case 'syncVar':
                const { variable, value } = data
                vars[variable] = value
                break
        }
	}

	onSFXRawProcessorMessage(event) {
		// console.log('Message from sfplayer processor', event)
        const data = event.data
        debugger
		// switch(data.message) {
        //     case 'syncVar':
        //         const { variable, value } = data
        //         vars[variable] = value
        //         break
        // }
	}    

    postMessageToSFXPlayerProcessor(message) {
		if (this._sfxPlayerWorklet) {
			this._sfxPlayerWorklet.port.postMessage(message)
		} else {
			console.warn('Cannot send message to sfx player processor: not available')
		}
    }

    postMessageToSFXRawProcessor(message) {
		if (this._sfxRawWorklet) {
			this._sfxRawWorklet.port.postMessage(message)
		} else {
			console.warn('Cannot send message to raw player processor: not available')
		}
	}

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
                delay = read_be_uint16(buf)
            }
            
            this.setEventsDelay(delay)
            this._sfxMod.data = new Uint8Array(buf.buffer,  0xC0)
            console.log(`SfxPlayer::loadSfxModule() eventDelay = ${this._delay} ms`)
            this.prepareInstruments(new Uint8Array(buf.buffer, 2))
            this.postMessageToSFXPlayerProcessor({
                message: 'load',
                sfxMod: this._sfxMod,
                delay: this._delay
            })
        } else {
            debugger
        }
    }

    prepareInstruments(p) {
        let offset = 0
        for (let i = 0; i < 15; ++i) {
            const ins = this._sfxMod.samples[i]
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

    startMusic() {
        this.postMessageToSFXPlayerProcessor({
            message: 'start'
        })
    }
    
    stopMusic() {
        this.postMessageToSFXPlayerProcessor({
            message: 'stop'
        })
    }

    playMusic() {
        this.stopMusic()
        this.postMessageToSFXPlayerProcessor({
            message: 'play',
            mixingRate: this._rate
        })
    }

    playSoundRaw(channel, data, freq, volume) {
		let len = read_be_uint16(data) * 2
		const loopLen = read_be_uint16(data, 2) * 2
		if (loopLen !== 0) {
			len = loopLen
		}
        const sample = new Int8Array(data.buffer, 8, len || (data.byteLength - 8))
        // convert signed 8bit mono freq hz to host/stereo/host_freq
		if (sample) {
            const sfx = createSfx()
            sfx.loops = (loopLen !== 0) ? -1 : 0
            sfx.volume = volume
            sfx.freq = freq
            sfx.sample = sample
            this.postMessageToSFXRawProcessor({
                message: 'play',
                sound: sfx,
                channel
            })
		}        
    }

    stopSound(channel) {
        this.postMessageToSFXRawProcessor({
            message: 'stop',
            channel
        })
    }
}
