function Replayer(midiFile, timeWarp, eventProcessor, bpm) {
    var trackStates = [];
    var beatsPerMinute = bpm || 120;
    var bpmOverride = bpm ? true : false;
    
    var ticksPerBeat = midiFile.header.ticksPerBeat;
    
    for (var i = 0; i < midiFile.tracks.length; i++) {
        trackStates[i] = {
            'nextEventIndex': 0,
            'ticksToNextEvent': (
                midiFile.tracks[i].length ?
                    midiFile.tracks[i][0].deltaTime :
                    null
            )
        };
    }
    
    function getNextEvent() {
        var ticksToNextEvent = null;
        var nextEventTrack = null;
        var nextEventIndex = null;
        
        for (var i = 0; i < trackStates.length; i++) {
            if (
                trackStates[i].ticksToNextEvent != null
                && (ticksToNextEvent == null || trackStates[i].ticksToNextEvent < ticksToNextEvent)
            ) {
                ticksToNextEvent = trackStates[i].ticksToNextEvent;
                nextEventTrack = i;
                nextEventIndex = trackStates[i].nextEventIndex;
            }
        }
        if (nextEventTrack != null) {
            /* consume event from that track */
            var nextEvent = midiFile.tracks[nextEventTrack][nextEventIndex];
            if (midiFile.tracks[nextEventTrack][nextEventIndex + 1]) {
                trackStates[nextEventTrack].ticksToNextEvent += midiFile.tracks[nextEventTrack][nextEventIndex + 1].deltaTime;
            } else {
                trackStates[nextEventTrack].ticksToNextEvent = null;
            }
            trackStates[nextEventTrack].nextEventIndex += 1;
            /* advance timings on all tracks */
            for (var i = 0; i < trackStates.length; i++) {
                if (trackStates[i].ticksToNextEvent != null) {
                    trackStates[i].ticksToNextEvent -= ticksToNextEvent
                }
            }
            return {
                "ticksToEvent": ticksToNextEvent,
                "event": nextEvent,
                "track": nextEventTrack
            }
        } else {
            return null;
        }
    }
    
    var midiEvent;
    var temporal = [];
    
    function processEvents() {
        function processNext() {
            if (!bpmOverride && midiEvent.event.type == "meta" && midiEvent.event.subtype == "setTempo" ) {
                // tempo change events can occur anywhere in the middle and affect events that follow
                beatsPerMinute = 60000000 / midiEvent.event.microsecondsPerBeat;
            }
            
            var beatsToGenerate = 0;
            var secondsToGenerate = 0;
            
            if (midiEvent.ticksToEvent > 0) {
                beatsToGenerate = midiEvent.ticksToEvent / ticksPerBeat;
                secondsToGenerate = beatsToGenerate / (beatsPerMinute / 60);
            }
            
            var time = (secondsToGenerate * 1000 * timeWarp) || 0;
            temporal.push([midiEvent, time]);
            
            midiEvent = getNextEvent();
        }
        
        if (midiEvent = getNextEvent()) {
            while(midiEvent) processNext(true);
        }
    }
    
    processEvents();
    return {
        "getData": function() { return temporal; }
    }
} 