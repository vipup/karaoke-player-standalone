class MIDIParser {
    static parse(arrayBuffer) {
        const dv = new DataView(arrayBuffer);
        let position = 0;

        // Parse header
        const headerChunk = this.parseChunk(dv, position);
        if (headerChunk.id !== 'MThd') {
            throw new Error('Invalid MIDI file (missing MThd)');
        }
        position += 8 + headerChunk.length;

        const format = dv.getUint16(8);
        const numTracks = dv.getUint16(10);
        const timeDivision = dv.getUint16(12);

        const tracks = [];
        
        // Parse each track
        for (let i = 0; i < numTracks; i++) {
            const trackChunk = this.parseChunk(dv, position);
            if (trackChunk.id !== 'MTrk') {
                throw new Error(`Invalid track chunk at position ${position}`);
            }
            
            const trackData = this.parseTrackEvents(dv, position + 8, trackChunk.length);
            tracks.push(trackData.events);
            position += 8 + trackChunk.length;
        }

        return {
            format,
            numTracks,
            timeDivision,
            tracks
        };
    }

    static parseChunk(dv, position) {
        const id = String.fromCharCode(
            dv.getUint8(position),
            dv.getUint8(position + 1),
            dv.getUint8(position + 2),
            dv.getUint8(position + 3)
        );
        const length = dv.getUint32(position + 4);
        return { id, length };
    }

    static decodeText(bytes) {
        // Try Windows-1251 first for Cyrillic
        try {
            // For browsers that support Windows-1251
            return new TextDecoder('windows-1251').decode(bytes);
        } catch (e) {
            // Fallback for Windows-1251
            return Array.from(bytes).map(byte => {
                // Windows-1251 Cyrillic mapping
                if (byte >= 0xC0 && byte <= 0xFF) {
                    return String.fromCharCode(0x0410 + (byte - 0xC0)); // Capital letters
                } else if (byte >= 0x80 && byte <= 0xBF) {
                    return String.fromCharCode(0x0430 + (byte - 0x80)); // Small letters
                } else {
                    return String.fromCharCode(byte);
                }
            }).join('');
        }
    }

    static parseTrackEvents(dv, start, length) {
        const events = [];
        let position = start;
        let runningStatus = 0;
        const end = start + length;

        while (position < end) {
            const deltaTime = this.parseVLQ(dv, position);
            position += deltaTime.length;
            
            let eventType = dv.getUint8(position);
            position++;

            // Handle running status
            if ((eventType & 0x80) === 0) {
                eventType = runningStatus;
                position--;
            } else {
                runningStatus = eventType;
            }

            // Meta event
            if (eventType === 0xFF) {
                const metaType = dv.getUint8(position);
                position++;
                const length = this.parseVLQ(dv, position);
                position += length.length;

                // Handle text events (0x01-0x0F)
                if (metaType >= 0x01 && metaType <= 0x0F) {
                    const textBytes = new Uint8Array(
                        dv.buffer.slice(position, position + length.value)
                    );
                    
                    // Use our custom decoder
                    const text = this.decodeText(textBytes);
                    
                    events.push({
                        deltaTime: deltaTime.value,
                        type: 'meta',
                        subtype: metaType,
                        text: text
                    });
                }
                position += length.value;
            }
            // Other events (note on/off, etc.)
            else {
                const channel = eventType & 0x0F;
                const command = eventType & 0xF0;
                
                // Handle different command types
                switch (command) {
                    case 0x80: // Note off
                    case 0x90: // Note on
                        events.push({
                            deltaTime: deltaTime.value,
                            type: 'channel',
                            command: command,
                            channel: channel,
                            note: dv.getUint8(position),
                            velocity: dv.getUint8(position + 1)
                        });
                        position += 2;
                        break;
                    // Add other MIDI commands as needed
                }
            }
        }

        return { events };
    }

    static parseVLQ(dv, position) {
        let value = 0;
        let length = 0;
        let byte;

        do {
            byte = dv.getUint8(position + length);
            value = (value << 7) | (byte & 0x7F);
            length++;
        } while (byte & 0x80);

        return { value, length };
    }
} 