class MidiPlayer {
    constructor(arrayBuffer) {
        try {
            console.log('Parsing MIDI file...');
            
            // Initialize basic properties
            this.lyrics = [];
            this.currentTime = 0;
            this.playing = false;
            this.totalDuration = 0;
            this.events = [];
            this.currentEventIndex = 0;
            this.tempo = 500000; // Default tempo (120 BPM)
            
            // Parse MIDI data first
            this.midiData = MIDIParser.parse(arrayBuffer);
            console.log('Parsed MIDI data:', this.midiData);
            
            // Process MIDI data
            this.parseMidiFile();
            
            // Initialize Audio
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            
            // Initialize timeline
            this.initializeTimeline();
            
            console.log('MidiPlayer initialized successfully');
        } catch (error) {
            console.error('Error initializing MidiPlayer:', error);
            throw error;
        }
    }

    decodeText(data) {
        if (!data) return '';
        if (typeof data === 'string') return data;

        try {
            // Try UTF-8 first
            if (Array.isArray(data)) {
                data = new Uint8Array(data);
            }
            const text = new TextDecoder('utf-8').decode(data);
            return text.trim();
        } catch (e) {
            console.log('UTF-8 decoding failed, trying ASCII');
            try {
                // Fallback to basic ASCII
                if (Array.isArray(data)) {
                    return String.fromCharCode.apply(null, data).trim();
                } else {
                    return String.fromCharCode.apply(null, Array.from(data)).trim();
                }
            } catch (e2) {
                console.error('Failed to decode text:', e2);
                return '';
            }
        }
    }

    parseLyrics() {
        console.log('Starting lyrics parsing...');
        this.lyrics = [];
        
        this.midiData.tracks.forEach((track, trackIndex) => {
            let currentTicks = 0;
            
            track.forEach(event => {
                currentTicks += event.deltaTime;
                
                // Check for text events
                if (event.type === 'meta' && 
                   (event.subtype === 0x01 || // Text Event
                    event.subtype === 0x05 || // Lyrics
                    event.subtype === 0x06)) { // Marker
                    
                    let text = event.text || this.decodeText(event.data);
                    console.log('Found text event:', { text, event });
                    
                    if (text && text.trim() && !text.startsWith('@') && text !== '\\') {
                        const lyric = {
                            time: this.ticksToSeconds(currentTicks),
                            text: text.trim(),
                            track: trackIndex
                        };
                        console.log('Adding lyric:', lyric);
                        this.lyrics.push(lyric);
                    }
                }
            });
        });

        this.lyrics.sort((a, b) => a.time - b.time);
        console.log('Final parsed lyrics:', this.lyrics);
    }

    ticksToSeconds(ticks) {
        return ticks * (this.tempo / (this.midiData.timeDivision * 1000000));
    }

    getLyrics() {
        return this.lyrics;
    }

    getTime() {
        return this.currentTime;
    }

    seekToPosition(timeInSeconds) {
        this.currentTime = timeInSeconds;
        this.currentEventIndex = this.events.findIndex(event => event.time >= timeInSeconds);
        if (this.currentEventIndex === -1) {
            this.currentEventIndex = this.events.length;
        }
        
        if (this.playing) {
            this.startTime = Date.now() - (this.currentTime * 1000);
        }
        this.updateDisplay();
    }

    initializeTimeline() {
        this.timelineContainer = document.querySelector('.timeline-container');
        this.timeline = document.querySelector('.timeline');
        this.timelineEvents = document.querySelector('.timeline-events');
        this.timelineCursor = document.querySelector('.timeline-cursor');
        
        if (!this.timelineContainer || !this.timeline || !this.timelineEvents) return;

        // Calculate timeline width (20px per second, minimum 100%)
        const width = Math.max(this.totalDuration * 20, this.timelineContainer.clientWidth);
        this.timeline.style.width = `${width}px`;

        // Add events to timeline
        this.events.forEach(event => {
            if (event.type === 'channel' && event.command === 0x90 && event.velocity > 0) {
                const eventElement = document.createElement('div');
                eventElement.className = 'timeline-event';
                eventElement.style.left = `${(event.time / this.totalDuration) * 100}%`;
                this.timelineEvents.appendChild(eventElement);
            }
        });

        // Add click handler for seeking
        this.timeline.addEventListener('click', (e) => {
            const rect = this.timeline.getBoundingClientRect();
            const clickPosition = (e.clientX - rect.left + this.timelineContainer.scrollLeft) / this.timeline.clientWidth;
            this.seekToPosition(clickPosition * this.totalDuration);
        });

        // Add scroll wheel handler
        this.timelineContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.timelineContainer.scrollLeft += e.deltaY;
        });
    }

    parseMidiFile() {
        if (!this.midiData || !this.midiData.tracks) {
            throw new Error('Invalid MIDI data structure');
        }

        this.parseLyrics();
        this.prepareEvents();
    }

    prepareEvents() {
        let currentTicks = 0;
        
        this.midiData.tracks.forEach(track => {
            currentTicks = 0;
            track.forEach(event => {
                currentTicks += event.deltaTime;
                
                if (event.type === 'channel') {
                    this.events.push({
                        time: this.ticksToSeconds(currentTicks),
                        ...event
                    });
                } else if (event.type === 'meta' && event.subtype === 0x51) {
                    this.tempo = event.value;
                }
            });
        });

        this.events.sort((a, b) => a.time - b.time);
        this.totalDuration = this.events.length > 0 ? 
            this.events[this.events.length - 1].time : 0;
            
        console.log('Total duration:', this.totalDuration);
    }

    initUI() {
        // Progress bar elements
        this.progressBar = document.getElementById('progress-current');
        this.timeCurrentLabel = document.getElementById('time-current');
        this.timeTotalLabel = document.getElementById('time-total');
        this.progressContainer = document.querySelector('.progress-bar');
        
        // Timeline elements
        this.timelineContainer = document.querySelector('.timeline-container');
        this.timeline = document.querySelector('.timeline');
        this.timelineEvents = document.querySelector('.timeline-events');
        this.timelineCursor = document.querySelector('.timeline-cursor');
        this.timelineLabels = document.querySelector('.timeline-labels');
        
        // Set up progress bar click handler
        if (this.progressContainer) {
            this.progressContainer.addEventListener('click', (e) => {
                if (!this.totalDuration) return;
                const rect = this.progressContainer.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                this.seekToPosition(pos * this.totalDuration);
            });
        }
        
        // Set up keyboard controls
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowLeft':
                    this.handleTimelineScroll(-100);
                    break;
                case 'ArrowRight':
                    this.handleTimelineScroll(100);
                    break;
                case ' ': // Space bar
                    e.preventDefault();
                    this.playing ? this.pause() : this.play();
                    break;
            }
        });
    }

    initAudio() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
    }

    initTimeline() {
        if (!this.timelineEvents || !this.timeline || !this.timelineLabels) return;

        // Clear existing content
        this.timelineEvents.innerHTML = '';
        this.timelineLabels.innerHTML = '';

        // Calculate timeline width (20px per second, minimum 100%)
        const width = Math.max(this.totalDuration * 20, this.timelineContainer.clientWidth);
        this.timeline.style.width = `${width}px`;

        // Add events to timeline
        this.events.forEach(event => {
            if (event.type === 'channel' && event.command === 0x90 && event.velocity > 0) {
                const eventElement = document.createElement('div');
                eventElement.className = 'timeline-event';
                eventElement.style.left = `${(event.time / this.totalDuration) * 100}%`;
                this.timelineEvents.appendChild(eventElement);
            }
        });

        // Add time labels
        const labelInterval = Math.max(Math.floor(this.totalDuration / 10), 1);
        for (let time = 0; time <= this.totalDuration; time += labelInterval) {
            const label = document.createElement('div');
            label.className = 'timeline-label';
            label.style.left = `${(time / this.totalDuration) * 100}%`;
            label.textContent = this.formatTime(time);
            this.timelineLabels.appendChild(label);
        }

        // Add timeline click handler
        this.timeline.addEventListener('click', (e) => {
            const rect = this.timeline.getBoundingClientRect();
            const clickPosition = (e.clientX - rect.left + this.timelineContainer.scrollLeft) / this.timeline.clientWidth;
            this.seekToPosition(clickPosition * this.totalDuration);
        });
    }

    handleTimelineScroll(delta) {
        if (this.timelineContainer) {
            this.timelineContainer.scrollLeft += delta;
        }
    }

    playNote(note, velocity, duration) {
        const oscillator = this.audioContext.createOscillator();
        const noteGain = this.audioContext.createGain();
        
        const frequency = 440 * Math.pow(2, (note - 69) / 12);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        noteGain.gain.setValueAtTime(velocity / 127, this.audioContext.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
        
        oscillator.connect(noteGain);
        noteGain.connect(this.gainNode);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    play() {
        if (!this.playing) {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            this.playing = true;
            document.querySelector('.progress-bar').classList.add('playing');
            this.startTime = Date.now() - (this.currentTime * 1000);
            this.playLoop();
            this.updateDisplay();
        }
    }

    playLoop() {
        if (!this.playing) return;

        const currentTime = (Date.now() - this.startTime) / 1000;
        
        while (this.currentEventIndex < this.events.length && 
               this.events[this.currentEventIndex].time <= currentTime) {
            
            const event = this.events[this.currentEventIndex];
            
            if (event.type === 'channel') {
                if (event.command === 0x90 && event.velocity > 0) { // Note On
                    console.log('Playing note:', event.note, 'velocity:', event.velocity);
                    this.playNote(event.note, event.velocity, 0.5);
                }
            }
            
            this.currentEventIndex++;
        }

        this.currentTime = currentTime;
        this.updateDisplay();

        if (this.currentEventIndex < this.events.length) {
            requestAnimationFrame(() => this.playLoop());
        } else {
            this.stop();
        }
    }

    pause() {
        this.playing = false;
        document.querySelector('.progress-bar').classList.remove('playing');
        this.audioContext.suspend();
    }

    stop() {
        this.playing = false;
        document.querySelector('.progress-bar').classList.remove('playing');
        this.currentTime = 0;
        this.currentEventIndex = 0;
        this.audioContext.suspend();
        this.updateDisplay();
    }

    updateDisplay() {
        if (this.progressBar && this.totalDuration) {
            const progress = (this.currentTime / this.totalDuration) * 100;
            this.progressBar.style.width = `${progress}%`;
        }
        
        if (this.timeCurrentLabel) {
            this.timeCurrentLabel.textContent = this.formatTime(this.currentTime);
        }

        // Update timeline cursor
        if (this.timelineCursor && this.totalDuration) {
            const cursorPosition = (this.currentTime / this.totalDuration) * 100;
            this.timelineCursor.style.left = `${cursorPosition}%`;
            
            // Auto-scroll timeline
            if (this.playing && this.timelineContainer) {
                const containerWidth = this.timelineContainer.clientWidth;
                const scrollPosition = (this.timeline.clientWidth * cursorPosition / 100) - (containerWidth / 2);
                this.timelineContainer.scrollTo({
                    left: scrollPosition,
                    behavior: 'smooth'
                });
            }
        }
    }
} 