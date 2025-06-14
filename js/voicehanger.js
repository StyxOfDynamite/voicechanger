class VoiceChanger {
    constructor() {
        this.audioContext = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.recordedBuffer = null;
        this.isRecording = false;
        this.startTime = 0;
        this.maxDuration = 30; // 30 seconds
        this.masterVolume = 0.7;
        this.animationId = null;
        this.currentSource = null;

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.createWaveformBars();
    }

    createWaveformBars() {
        const waveform = document.getElementById('waveform');
        for (let i = 0; i < 50; i++) {
            const bar = document.createElement('div');
            bar.className = 'wave-bar';
            bar.style.height = '2px';
            waveform.appendChild(bar);
        }
    }

    animateWaveform(analyser) {
        const waveform = document.getElementById('waveform');
        const bars = waveform.querySelectorAll('.wave-bar');
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const animate = () => {
            if (!this.isRecording) return;

            analyser.getByteFrequencyData(dataArray);

            bars.forEach((bar, index) => {
                const value = dataArray[index * 4] || 0;
                const height = Math.max(2, (value / 255) * 50);
                bar.style.height = height + 'px';
            });

            this.animationId = requestAnimationFrame(animate);
        };

        animate();
    }

    setupEventListeners() {
        const recordButton = document.getElementById('recordButton');
        const clearButton = document.getElementById('clearButton');
        const resetButton = document.getElementById('resetButton');
        const effectButtons = document.querySelectorAll('.effect-button');
        const volumeSlider = document.getElementById('volumeSlider');

        recordButton.addEventListener('click', () => this.toggleRecording());
        clearButton.addEventListener('click', () => this.clearRecording());
        resetButton.addEventListener('click', () => this.resetAll());

        effectButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (!button.classList.contains('disabled')) {
                    const effect = button.dataset.effect;
                    const action = button.dataset.action;
                    
                    if (action === 'preview') {
                        this.previewEffect(effect, button);
                    } else if (action === 'download') {
                        this.downloadEffect(effect);
                    }
                }
            });
        });

        volumeSlider.addEventListener('input', (e) => {
            this.masterVolume = e.target.value / 100;
        });
    }

    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(stream);
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            this.mediaRecorder = new MediaRecorder(stream);
            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.processRecording();
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.startTime = Date.now();

            this.updateUI();
            this.startTimer();
            this.animateWaveform(analyser);

            // Auto-stop after max duration
            setTimeout(() => {
                if (this.isRecording) {
                    this.stopRecording();
                }
            }, this.maxDuration * 1000);

        } catch (error) {
            console.error('Error accessing microphone:', error);
            document.getElementById('status').textContent = 'Microphone access denied';
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            cancelAnimationFrame(this.animationId);
            this.updateUI();
            this.resetWaveform();
        }
    }

    resetWaveform() {
        const bars = document.querySelectorAll('.wave-bar');
        bars.forEach(bar => {
            bar.style.height = '2px';
        });
    }

    async processRecording() {
        const blob = new Blob(this.recordedChunks, { type: 'audio/wav' });
        const arrayBuffer = await blob.arrayBuffer();

        try {
            this.recordedBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.enableEffectButtons();
            document.getElementById('status').textContent = 'Recording complete! Choose an effect to play.';
        } catch (error) {
            console.error('Error processing audio:', error);
            document.getElementById('status').textContent = 'Error processing recording';
        }
    }

    startTimer() {
        const timer = document.getElementById('timer');
        const updateTimer = () => {
            if (!this.isRecording) return;

            const elapsed = (Date.now() - this.startTime) / 1000;
            const minutes = Math.floor(elapsed / 60);
            const seconds = Math.floor(elapsed % 60);
            timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            setTimeout(updateTimer, 100);
        };
        updateTimer();
    }

    updateUI() {
        const recordButton = document.getElementById('recordButton');
        const status = document.getElementById('status');
        const clearButton = document.getElementById('clearButton');
        const resetButton = document.getElementById('resetButton');

        if (this.isRecording) {
            recordButton.textContent = '⏹️';
            recordButton.classList.add('recording');
            status.textContent = 'Recording... Click to stop';
            clearButton.style.display = 'none';
            resetButton.style.display = 'none';
        } else if (this.recordedBuffer || this.currentSource) {
            recordButton.textContent = '🎙️';
            recordButton.classList.remove('recording');
            recordButton.classList.add('has-recording');
            clearButton.style.display = 'inline-block';
            resetButton.style.display = 'inline-block';
        } else {
            recordButton.textContent = '🎙️';
            recordButton.classList.remove('recording', 'has-recording');
            status.textContent = 'Click to start recording (max 60 seconds)';
            clearButton.style.display = 'none';
            resetButton.style.display = 'none';
        }
    }

    enableEffectButtons() {
        const effectButtons = document.querySelectorAll('.effect-button');
        effectButtons.forEach(button => {
            button.classList.remove('disabled');
        });
    }

    disableEffectButtons() {
        const effectButtons = document.querySelectorAll('.effect-button');
        effectButtons.forEach(button => {
            button.classList.add('disabled');
        });
    }

    clearRecording() {
        if (this.currentSource) {
            this.currentSource.stop();
            this.currentSource = null;
        }
        this.recordedBuffer = null;
        this.recordedChunks = [];
        this.disableEffectButtons();
        this.resetTimer();
        this.updateUI();
    }

    resetTimer() {
        document.getElementById('timer').textContent = '00:00';
    }

    async previewEffect(effectType, button) {
        if (!this.recordedBuffer) return;

        // Stop any currently playing audio
        if (this.currentSource) {
            this.currentSource.stop();
            this.currentSource = null;
        }

        button.classList.add('playing');
        setTimeout(() => button.classList.remove('playing'), 600);

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();

        source.buffer = this.recordedBuffer;
        gainNode.gain.value = this.masterVolume;

        switch (effectType) {
            case 'alien':
                await this.applyAlienEffect(source, gainNode);
                break;
            case 'cartoon':
                await this.applyCartoonEffect(source, gainNode);
                break;
            case 'ghost':
                await this.applyGhostEffect(source, gainNode);
                break;
        }

        this.currentSource = source;
        source.onended = () => {
            this.currentSource = null;
            this.updateUI(); // Update UI when audio finishes playing
        };
        this.updateUI(); // Update UI when starting to play
    }

    async downloadEffect(effectType) {
        if (!this.recordedBuffer) {
            document.getElementById('status').textContent = 'Please record something first!';
            return;
        }

        // Create a new audio context for processing
        const offlineContext = new OfflineAudioContext(
            this.recordedBuffer.numberOfChannels,
            this.recordedBuffer.length,
            this.recordedBuffer.sampleRate
        );

        // Create source and gain nodes
        const source = offlineContext.createBufferSource();
        const gainNode = offlineContext.createGain();
        source.buffer = this.recordedBuffer;
        gainNode.gain.value = this.masterVolume;

        // Apply the effect
        switch (effectType) {
            case 'alien':
                await this.applyAlienEffect(source, gainNode, offlineContext);
                break;
            case 'cartoon':
                await this.applyCartoonEffect(source, gainNode, offlineContext);
                break;
            case 'ghost':
                await this.applyGhostEffect(source, gainNode, offlineContext);
                break;
        }

        // Render the audio
        const renderedBuffer = await offlineContext.startRendering();
        
        // Convert to WAV
        const wavBlob = this.bufferToWav(renderedBuffer);
        
        // Create download link
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voice-${effectType}-effect.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    bufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = buffer.length * blockAlign;
        const headerSize = 44;
        const totalSize = headerSize + dataSize;
        const arrayBuffer = new ArrayBuffer(totalSize);
        const view = new DataView(arrayBuffer);

        // Write WAV header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, totalSize - 8, true);
        this.writeString(view, 8, 'WAVE');
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        // Write audio data
        const offset = 44;
        const channelData = [];
        for (let i = 0; i < numChannels; i++) {
            channelData.push(buffer.getChannelData(i));
        }

        let pos = 0;
        while (pos < buffer.length) {
            for (let i = 0; i < numChannels; i++) {
                const sample = Math.max(-1, Math.min(1, channelData[i][pos]));
                const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset + pos * blockAlign + i * bytesPerSample, value, true);
            }
            pos++;
        }

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    async applyAlienEffect(source, gainNode, context = this.audioContext) {
        // Alien voice: ring modulation and distortion
        const oscillator = context.createOscillator();
        const ringModGain = context.createGain();
        const distortion = context.createWaveShaper();
        const highpass = context.createBiquadFilter();

        // Ring modulation
        oscillator.frequency.value = 30;
        oscillator.type = 'sine';
        ringModGain.gain.value = 0.5;

        // Distortion curve
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + 30) * x * 20 * deg) / (Math.PI + 30 * Math.abs(x));
        }
        distortion.curve = curve;
        distortion.oversample = '4x';

        highpass.type = 'highpass';
        highpass.frequency.value = 200;

        source.connect(ringModGain);
        oscillator.connect(ringModGain.gain);
        ringModGain.connect(distortion);
        distortion.connect(highpass);
        highpass.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start();
        source.start();
    }

    async applyCartoonEffect(source, gainNode, context = this.audioContext) {
        // Cartoon voice: higher pitch and compression
        const compressor = context.createDynamicsCompressor();
        const highpass = context.createBiquadFilter();

        compressor.threshold.value = -24;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;

        highpass.type = 'highpass';
        highpass.frequency.value = 300;

        source.playbackRate.value = 1.5; // Higher pitch
        source.connect(compressor);
        compressor.connect(highpass);
        highpass.connect(gainNode);
        gainNode.connect(context.destination);

        source.start();
    }

    async applyGhostEffect(source, gainNode, context = this.audioContext) {
        // Ghost voice: fluctuating pitch with reverb
        const convolver = context.createConvolver();
        const oscillator = context.createOscillator();
        const oscillatorGain = context.createGain();
        
        // Create reverb impulse response
        const reverbLength = context.sampleRate * 1.5; // 1.5 seconds
        const reverbBuffer = context.createBuffer(2, reverbLength, context.sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = reverbBuffer.getChannelData(channel);
            for (let i = 0; i < reverbLength; i++) {
                const decay = Math.pow(1 - i / reverbLength, 2);
                channelData[i] = (Math.random() * 2 - 1) * decay * 0.2;
            }
        }
        convolver.buffer = reverbBuffer;
        
        // Create pitch fluctuation using LFO
        oscillator.type = 'sine';
        oscillator.frequency.value = 0.7;
        oscillatorGain.gain.value = 0.1; // Pitch variance amount
        
        // Base pitch for ghost effect
        source.playbackRate.value = 0.9;
        
        // Connect LFO to pitch modulation
        oscillator.connect(oscillatorGain);
        oscillatorGain.connect(source.playbackRate);
        
        // Connect audio chain
        source.connect(convolver);
        convolver.connect(gainNode);
        gainNode.connect(context.destination);
        
        // Start both source and pitch modulation
        source.start();
        oscillator.start();
    }

    resetAll() {
        // Stop any playing audio
        if (this.currentSource) {
            this.currentSource.stop();
            this.currentSource = null;
        }

        // Reset audio context if it exists
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        // Reset all state variables
        this.recordedBuffer = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.startTime = 0;
        this.masterVolume = 0.7;
        this.animationId = null;

        // Reset UI elements
        this.disableEffectButtons();
        this.resetTimer();
        this.resetWaveform();
        this.updateUI();

        // Reset volume slider
        document.getElementById('volumeSlider').value = 70;

        // Update status
        document.getElementById('status').textContent = 'Click to start recording (max 60 seconds)';
    }
}

// Initialize the voice changer
new VoiceChanger();