import { useState, useRef, useCallback } from 'react';
import { ai } from '../workers/worker-bridge';
import { t } from '../lib/i18n';
import { Mic, Pause, Square, Play, X, Loader } from 'lucide-react';

export default function AudioRecorder({ onTranscriptionComplete }) {
  const [recordingState, setRecordingState] = useState('idle');
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
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not available.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      streamRef.current = stream;

      const supportedTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = supportedTypes.find((t) => MediaRecorder.isTypeSupported(t)) || 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
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
        setError('Microphone access denied.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found.');
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

            const arrayBuffer = await blob.arrayBuffer();
            const audioCtx = new AudioContext({ sampleRate: 16000 });
            const decoded = await audioCtx.decodeAudioData(arrayBuffer);
            audioCtx.close();

            let audioData;
            if (decoded.sampleRate === 16000 && decoded.numberOfChannels === 1) {
              audioData = decoded.getChannelData(0);
            } else {
              const offlineCtx = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
              const src = offlineCtx.createBufferSource();
              src.buffer = decoded;
              src.connect(offlineCtx.destination);
              src.start(0);
              const resampled = await offlineCtx.startRendering();
              audioData = resampled.getChannelData(0);
            }

            const transcription = await ai.transcribeAudio(audioData);
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
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors text-sm"
          title={t('read_aloud')}
          aria-label={t('read_aloud')}
        >
          <Mic size={16} />
          <span>{t('upload')}</span>
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
              <div key={i} className="w-1 bg-red-500 rounded-t transition-all duration-100" style={{ height: `${Math.min(100, audioLevel * (i * 0.3))}%`, opacity: 0.3 + i * 0.15 }} />
            ))}
          </div>

          <button onClick={pauseRecording} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors" title={t('pause')} aria-label={t('pause')}>
            <Pause size={14} />
          </button>

          <button onClick={stopRecording} className="p-1.5 bg-red-600 hover:bg-red-500 rounded text-white transition-colors" title={t('stop')} aria-label={t('stop')}>
            <Square size={14} />
          </button>
        </div>
      )}

      {recordingState === 'paused' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-yellow-400 font-mono">⏸ {formatTime(duration)}</span>

          <button onClick={resumeRecording} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors" title={t('resume')} aria-label={t('resume')}>
            <Play size={14} />
          </button>

          <button onClick={stopRecording} className="p-1.5 bg-red-600 hover:bg-red-500 rounded text-white transition-colors" title={t('stop')} aria-label={t('stop')}>
            <Square size={14} />
          </button>

          <button onClick={cancelRecording} className="p-1.5 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300 transition-colors" title={t('record_cancel')} aria-label={t('record_cancel')}>
            <X size={14} />
          </button>
        </div>
      )}

      {recordingState === 'processing' && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader size={14} className="animate-spin" />
          <span>{t('transcribing')}</span>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 flex items-center gap-1">
          <span>⚠</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-400" aria-label="Dismiss error">✕</button>
        </div>
      )}
    </div>
  );
}