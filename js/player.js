class KaraokePlayer {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.timeUpdateInterval = null;
        this.lyrics = [];
        this.currentLyricIndex = 0;
    }

    initializeElements() {
        this.fileInput = document.getElementById('file-input');
        this.playButton = document.getElementById('play');
        this.pauseButton = document.getElementById('pause');
        this.stopButton = document.getElementById('stop');
        this.timeDisplay = document.getElementById('time');
        this.lyricsPrevious = document.getElementById('lyrics-previous');
        this.lyricsCurrent = document.getElementById('lyrics-current');
        this.lyricsNext = document.getElementById('lyrics-next');

        // Set initial text
        if (this.lyricsCurrent) {
            this.lyricsCurrent.textContent = 'Load a karaoke file...';
        }

        console.log('Player initialized with elements:', {
            fileInput: this.fileInput,
            playButton: this.playButton,
            pauseButton: this.pauseButton,
            stopButton: this.stopButton,
            timeDisplay: this.timeDisplay,
            lyrics: [this.lyricsPrevious, this.lyricsCurrent, this.lyricsNext]
        });
    }

    setupEventListeners() {
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.loadFile(e));
        }

        if (this.playButton) {
            this.playButton.addEventListener('click', () => this.play());
        }

        if (this.pauseButton) {
            this.pauseButton.addEventListener('click', () => this.pause());
        }

        if (this.stopButton) {
            this.stopButton.addEventListener('click', () => this.stop());
        }

        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    if (this.midiPlayer) {
                        if (this.midiPlayer.playing) {
                            this.pause();
                        } else {
                            this.play();
                        }
                    }
                    break;
                case 'Escape':
                    if (this.midiPlayer) {
                        this.stop();
                    }
                    break;
            }
        });
    }

    loadFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        console.log('Loading file:', file);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const arrayBuffer = e.target.result;
                console.log('File loaded:', {
                    size: arrayBuffer.byteLength,
                    firstBytes: this.arrayBufferToHex(arrayBuffer.slice(0, 16))
                });
                this.processMidiFile(arrayBuffer);
            } catch (error) {
                console.error('Error processing file:', error);
                if (this.lyricsCurrent) {
                    this.lyricsCurrent.textContent = 'Error loading file';
                }
            }
        };

        reader.onerror = (error) => {
            console.error('Error reading file:', error);
            if (this.lyricsCurrent) {
                this.lyricsCurrent.textContent = 'Error reading file';
            }
        };

        reader.readAsArrayBuffer(file);
    }

    arrayBufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ');
    }

    processMidiFile(arrayBuffer) {
        try {
            console.log('Processing MIDI file...');
            this.midiPlayer = new MidiPlayer(arrayBuffer);
            this.lyrics = this.midiPlayer.getLyrics();
            console.log('Loaded lyrics:', this.lyrics);
            this.currentLyricIndex = 0;
            this.updateLyricsDisplay();
        } catch (error) {
            console.error('Error processing MIDI file:', error);
            throw error;
        }
    }

    updateLyricsDisplay(currentTime = 0) {
        if (!this.lyrics || this.lyrics.length === 0) {
            console.log('No lyrics available');
            if (this.lyricsCurrent) {
                this.lyricsCurrent.textContent = 'No lyrics found in file';
            }
            return;
        }

        // Find the current lyric based on time
        let newIndex = this.lyrics.findIndex(lyric => lyric.time > currentTime);
        if (newIndex === -1) {
            newIndex = this.lyrics.length;
        }
        newIndex = Math.max(0, newIndex - 1);

        // Only update if the index changed
        if (newIndex !== this.currentLyricIndex) {
            this.currentLyricIndex = newIndex;
            console.log('Updating lyrics display at index:', newIndex);

            // Update previous lyric
            if (this.lyricsPrevious) {
                const prevText = newIndex > 0 ? this.lyrics[newIndex - 1].text : '';
                this.lyricsPrevious.textContent = prevText;
            }

            // Update current lyric
            if (this.lyricsCurrent) {
                this.lyricsCurrent.textContent = this.lyrics[newIndex].text;
                
                // Add highlight animation
                this.lyricsCurrent.classList.remove('highlight');
                void this.lyricsCurrent.offsetWidth; // Trigger reflow
                this.lyricsCurrent.classList.add('highlight');
            }

            // Update next lyric
            if (this.lyricsNext) {
                const nextText = newIndex < this.lyrics.length - 1 ? 
                    this.lyrics[newIndex + 1].text : '';
                this.lyricsNext.textContent = nextText;
            }
        }
    }

    startTimeUpdate() {
        this.timeUpdateInterval = setInterval(() => {
            const currentTime = this.midiPlayer.getTime();
            this.updateLyricsDisplay(currentTime);
        }, 100);
    }

    stopTimeUpdate() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
        }
    }

    play() {
        if (this.midiPlayer) {
            this.midiPlayer.play();
            this.startTimeUpdate();
        }
    }

    pause() {
        if (this.midiPlayer) {
            this.midiPlayer.pause();
            this.stopTimeUpdate();
        }
    }

    stop() {
        if (this.midiPlayer) {
            this.midiPlayer.stop();
            this.stopTimeUpdate();
            this.updateLyricsDisplay(0);
        }
    }
}

// Initialize the player when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.karaokePlayer = new KaraokePlayer();
}); 