import { useState, useRef, useCallback } from 'react';
import { audio, ai } from '../workers/worker-bridge';

export default function AudioRecorder({ onTranscriptionComplete }) {
  const [recordingState, setRecordingState] = useState('idle'); // idle | recording | paused | processing
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const updateDuration = useCallback(() => {
    if (startTimeRef.current) {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }
  }, []);

  const startRecording = async () => {
    setError(null);
    setDuration(0);

    try {
      await audio.startRecording(
        { mimeType: 'audio/webm;codecs=opus' },
        {
          onData: (data) => {
            // Simulate audio level from chunk size
            setAudioLevel(Math.min(100, (data.chunkSize / 1000) * 100));
          },
        }
      );

      setRecordingState('recording');
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(updateDuration, 1000);
    } catch (err) {
      setError(err.message);
    }
  };

  const stopRecording = async () => {
    clearInterval(timerRef.current);
    setRecordingState('processing');

    try {
      const result = await audio.stopRecording();
      
      // Send audio data to Whisper for transcription
      if (result.audioData) {
        const transcription = await ai.transcribeAudio(result.audioData, {
          onProgress: (data) => {
            console.log('Transcription progress:', data);
          },
        });

        onTranscriptionComplete?.(transcription.text);
      }

      setRecordingState('idle');
      setDuration(0);
      setAudioLevel(0);
    } catch (err) {
      setError(err.message);
      setRecordingState('idle');
    }
  };

  const pauseRecording = async () => {
    clearInterval(timerRef.current);
    await audio.pauseRecording();
    setRecordingState('paused');
  };

  const resumeRecording = async () => {
    await audio.resumeRecording();
    setRecordingState('recording');
    timerRef.current = setInterval(updateDuration, 1000);
  };

  const cancelRecording = async () => {
    clearInterval(timerRef.current);
    await audio.cancelRecording();
    setRecordingState('idle');
    setDuration(0);
    setAudioLevel(0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3">
      {/* Recording Controls */}
      {recordingState === 'idle' && (
        <button
          onClick={startRecording}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 
                   text-slate-200 rounded-lg transition-colors text-sm"
          title="Record audio"
        >
          <MicIcon />
          <span>Record</span>
        </button>
      )}

      {recordingState === 'recording' && (
        <div className="flex items-center gap-2">
          {/* Audio level indicator */}
          <div className="flex items-center gap-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-xs text-red-400 font-mono">
              {formatTime(duration)}
            </span>
          </div>

          {/* Audio level bars */}
          <div className="flex items-end gap-0.5 h-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-1 bg-red-500 rounded-t transition-all duration-100"
                style={{
                  height: `${Math.min(100, audioLevel * (i * 0.3))}%`,
                  opacity: 0.3 + i * 0.15,
                }}
              />
            ))}
          </div>

          <button
            onClick={pauseRecording}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
            title="Pause"
          >
            <PauseIcon />
          </button>

          <button
            onClick={stopRecording}
            className="p-1.5 bg-red-600 hover:bg-red-500 rounded text-white transition-colors"
            title="Stop"
          >
            <StopIcon />
          </button>
        </div>
      )}

      {recordingState === 'paused' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-yellow-400 font-mono">
            ⏸ {formatTime(duration)}
          </span>

          <button
            onClick={resumeRecording}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
            title="Resume"
          >
            <PlayIcon />
          </button>

          <button
            onClick={stopRecording}
            className="p-1.5 bg-red-600 hover:bg-red-500 rounded text-white transition-colors"
            title="Stop"
          >
            <StopIcon />
          </button>

          <button
            onClick={cancelRecording}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300 transition-colors"
            title="Cancel"
          >
            <XIcon />
          </button>
        </div>
      )}

      {recordingState === 'processing' && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="animate-spin">⏳</span>
          <span>Transcribing...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 flex items-center gap-1">
          <span>⚠</span>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// SVG Icons
function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
