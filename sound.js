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

const CreateChannel = () => ({
    sampleData: null,
    sampleLen: 0,
    sampleLoopPos: 0,
    sampleLoopLen: 0,
    volume: 0,
    pos: new Frac()
})

class SfxPlayer {
    _delay = 0
    _resNum = 0
    _sfxMod = CreateSfxMod()
	_playing = false
	_rate = 0
	_samplesLeft = 0
    _channels = new Array(4).fill(null)

    // new
    _audioContext = null
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
            // const filterNode = this._audioContext.createBiquadFilter()
            // filterNode.frequency.value = 22050
    
            this._sfxPlayerWorklet = new AudioWorkletNode(this._audioContext, 'sfxplayer-processor', {
                outputChannelCount: [1],
                numberOfInputs: 0,
                numberOfOutputs: 1
            });
            this._sfxPlayerWorklet.port.onmessage = this.onSFXPlayerProcessorMessage.bind(this)
            this._sfxPlayerWorklet.port.start()        

			// this._sfxPlayerWorklet.connect(filterNode)
			// filterNode.connect(this._audioContext.destination)
            this._sfxPlayerWorklet.connect(this._audioContext.destination)

			this.postMessageToSFXPlayerProcessor({
				message: 'init',
				mixingRate: this._rate,
			})

        } catch(e) {
            console.error(`Error during initAudio: ${e}`)
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

    postMessageToSFXPlayerProcessor(message) {
		if (this._sfxPlayerWorklet) {
			this._sfxPlayerWorklet.port.postMessage(message)
		} else {
			console.warn('Cannot send message to sfx player processor: not available')
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
                this._delay = read_be_uint16(buf)
            } else {
                this._delay = delay
            }
            this._delay = (this._delay * 60 / 7050) >> 0
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

    start() {
        // console.log("SfxPlayer::start()")
        // this._sfxMod.curPos = 0
        this.postMessageToSFXPlayerProcessor({
            message: 'start'
        })
    }
    
    stop() {
        this.postMessageToSFXPlayerProcessor({
            message: 'stop'
        })
        // console.log("SfxPlayer::stop()")
        // this._playing = false
        // this._resNum = 0
    }

    play(rate) {
        // this._playing = true
        // this._rate = rate
        // this._samplesLeft = 0
        // // memset(_channels, 0, sizeof(_channels));
        // this._channels = this._channels.map(() => CreateChannel())
        this.postMessageToSFXPlayerProcessor({
            message: 'play',
            mixingRate: rate
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
            this._sfx.play(44100)
            // return this._impl.playSfxMusic(this._sfx)
        }
    }

    stopSfxMusic() {
        if (this._sfx) {
            this._sfx.stop()
            // no need to call _impl->stopSfxMusic()
            // because sfx.stop will cause the mixing to stop
        }
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