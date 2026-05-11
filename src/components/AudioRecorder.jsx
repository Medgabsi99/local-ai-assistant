import { useState, useRef, useCallback } from 'react';
import { ai } from '../workers/worker-bridge';

export default function AudioRecorder({ onTranscriptionComplete }) {
  const [recordingState, setRecordingState] = useState('idle'); // idle | recording | paused | processing
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const updateDuration = useCallback(() => {
    if (startTimeRef.current) {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }
  }, []);

  const startRecording = async () => {
    setError(null);
    setDuration(0);
    chunksRef.current = [];

    try {
      // getUserMedia MUST be called on the main thread — not available in Workers
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Microphone access is not available. Make sure you are on localhost or HTTPS.'
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Pick a supported MIME type
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mimeType =
        supportedTypes.find((t) => MediaRecorder.isTypeSupported(t)) ||
        'audio/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000,
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          setAudioLevel(Math.min(100, (e.data.size / 1000) * 100));
        }
      };

      recorder.onerror = (e) => {
        setError(e.error?.message || 'Recording error');
        setRecordingState('idle');
      };

      recorder.start(1000);
      setRecordingState('recording');
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(updateDuration, 1000);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError(err.message);
      }
    }
  };

  const stopRecording = async () => {
    clearInterval(timerRef.current);
    setRecordingState('processing');

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setRecordingState('idle');
      return;
    }

    try {
      await new Promise((resolve, reject) => {
        recorder.onstop = async () => {
          try {
            streamRef.current?.getTracks().forEach((t) => t.stop());

            const mimeType = recorder.mimeType || 'audio/webm';
            const blob = new Blob(chunksRef.current, { type: mimeType });

            // Resample to 16 kHz Float32Array (main thread — OfflineAudioContext is available here)
            const arrayBuffer = await blob.arrayBuffer();
            const audioCtx = new AudioContext({ sampleRate: 16000 });
            const decoded = await audioCtx.decodeAudioData(arrayBuffer);
            audioCtx.close();

            let audioData;
            if (decoded.sampleRate === 16000 && decoded.numberOfChannels === 1) {
              audioData = decoded.getChannelData(0);
            } else {
              const offlineCtx = new OfflineAudioContext(
                1,
                Math.ceil(decoded.duration * 16000),
                16000
              );
              const src = offlineCtx.createBufferSource();
              src.buffer = decoded;
              src.connect(offlineCtx.destination);
              src.start(0);
              const resampled = await offlineCtx.startRendering();
              audioData = resampled.getChannelData(0);
            }

            // Send Float32Array to Whisper worker
            const transcription = await ai.transcribeAudio(audioData, {
              onProgress: (data) => console.log('Transcription progress:', data),
            });

            onTranscriptionComplete?.(transcription.text);
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        recorder.stop();
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setRecordingState('idle');
      setDuration(0);
      setAudioLevel(0);
      chunksRef.current = [];
      mediaRecorderRef.current = null;
      streamRef.current = null;
    }
  };

  const pauseRecording = () => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.pause();
    setRecordingState('paused');
  };

  const resumeRecording = () => {
    mediaRecorderRef.current?.resume();
    setRecordingState('recording');
    timerRef.current = setInterval(updateDuration, 1000);
  };

  const cancelRecording = () => {
    clearInterval(timerRef.current);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    streamRef.current = null;
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
          <div className="flex items-center gap-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-xs text-red-400 font-mono">{formatTime(duration)}</span>
          </div>

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
          <span className="text-xs text-yellow-400 font-mono">⏸ {formatTime(duration)}</span>

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

      {error && (
        <div className="text-xs text-red-400 flex items-center gap-1">
          <span>⚠</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-400">✕</button>
        </div>
      )}
    </div>
  );
}

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
