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
        // console.log("SfxPlayer::start()")
        // this._sfxMod.curPos = 0
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
        this.postMessageToSFXPlayerProcessor({
            message: 'play',
            mixingRate: this._rate
        })
    }

    playSoundRaw(sample, channel) {
        this.postMessageToSFXRawProcessor({
            message: 'play',
            sample,
            channel
        })
    }

    stopSound(channel) {
        this.postMessageToSFXRawProcessor({
            message: 'stop',
            channel
        })
    }
}

class Mixer {
    constructor(sfx) {
        this._sfx = sfx
    }

    init() {
        // this._impl = new Mixer_impl()
        // this._impl.init()
    }

    playSfxMusic(num) {
        console.log(`Mixer::playSfxMusic(${num}`)
        if (/*this._impl && */this._sfx) {
            this.stopSfxMusic()
            this._sfx.playMusic()
            // return this._impl.playSfxMusic(this._sfx)
        }
    }

    stopSfxMusic() {
        if (this._sfx) {
            this._sfx.stopMusic()
            // no need to call _impl->stopSfxMusic()
            // because sfx.stop will cause the mixing to stop
        }
    }

    playSoundRaw(channel, data, freq, volume) {
        // todo
		let len = read_be_uint16(data) * 2
		const loopLen = read_be_uint16(data, 2) * 2
		if (loopLen !== 0) {
			len = loopLen
		}
        const sample = new Int8Array(data.buffer, 8, len || (data.byteLength - 8))
        // convert signed 8bit mono freq hz to host/stereo/host_freq
		// uint8_t *sample = convertMono8(&_cvt, data + 8, freq, len, &sampleLen);
		if (sample) {
            const raw = createSfx()
            raw.loops = (loopLen !== 0) ? -1 : 0
            raw.volume = volume
            raw.freq = freq
            raw.sample = sample

            this._sfx.playSoundRaw(raw, channel)
            // create sample:
            // send play event
			// Mix_Chunk *chunk = Mix_QuickLoad_RAW(sample, sampleLen);
			// playSound(channel, volume, chunk, (loopLen != 0) ? -1 : 0);
			// _samples[channel] = sample;

		}        
    }

    stopSound(channel) {
        this._sfx.stopSound(channel)
        // Mix_HaltChannel(channel);
		// freeSound(channel);
    }
}

// typedef struct Mix_Chunk {
// 	int allocated;
// 	Uint8 *abuf;
// 	Uint32 alen;
// 	Uint8 volume;		/* Per-sample volume, 0-128 */
// } Mix_Chunk;

// class Mixer_impl {
//     static kMixFreq = 44100
// 	static kMixBufSize = 4096
// 	static kMixChannels = 4

// 	// Mix_Chunk *_sounds[kMixChannels];
//     _sounds = new Array(Mixer_impl.kMixChannels)
//     _samples = new Array(Mixer_impl.kMixChannels)
// 	// Mix_Music *_music;
// 	// uint8_t *_samples[kMixChannels];
// 	// SDL_AudioCVT _cvt;

//     init() {
// 		// memset(_sounds, 0, sizeof(_sounds));
// 		this._music = null
// 		// memset(_samples, 0, sizeof(_samples));

// 		// Mix_Init(MIX_INIT_OGG | MIX_INIT_FLUIDSYNTH);
// 		// if (Mix_OpenAudio(kMixFreq, AUDIO_S16SYS, 2, kMixBufSize) < 0) {
// 		// 	warning("Mix_OpenAudio failed: %s", Mix_GetError());
// 		// }
// 		// Mix_AllocateChannels(kMixChannels);
// 		// memset(&_cvt, 0, sizeof(_cvt));
// 		// if (SDL_BuildAudioCVT(&_cvt, AUDIO_S8, 1, 11025, AUDIO_S16SYS, 2, kMixFreq) < 0) {
// 		// 	warning("SDL_BuildAudioCVT failed: %s", SDL_GetError());
// 		// }
// 	}

//     stopSfxMusic() {
//         // Mix_HookMusic(0, 0);
//     }

// 	playSfxMusic(sfx) {
//         debugger
// 		// Mix_HookMusic(mixSfxPlayer, sfx);
//         // sfx.
// 	}

// 	// static void mixSfxPlayer(void *data, uint8_t *s16buf, int len) {
// 	// 	len /= 2;
// 	// 	int8_t *s8buf = (int8_t *)alloca(len);
// 	// 	memset(s8buf, 0, len);
// 	// 	((SfxPlayer *)data)->readSamples(s8buf, len / 2);
// 	// 	for (int i = 0; i < len; ++i) {
// 	// 		*(int16_t *)&s16buf[i * 2] = 256 * (int16_t)s8buf[i];
// 	// 	}
// 	// }    
// }