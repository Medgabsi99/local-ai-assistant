import { useState, useEffect, useRef } from 'react';
import { audio } from '../workers/worker-bridge';
import { t } from '../lib/i18n';
import { Mic, Square, Loader2 } from 'lucide-react';

export default function AudioRecorder({ onTranscriptionComplete }) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await audio.startRecording(
        {},
        {
          onData: () => {},
          onTranscript: (data) => {
            if (data.text) onTranscriptionComplete(data.text);
          },
        },
      );
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        alert('Microphone permission denied. Please allow microphone access in your browser settings.');
      } else {
        console.error(err);
      }
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTranscribing(true);
    try {
      const result = await audio.stopRecording();
      if (result?.text) onTranscriptionComplete(result.text);
    } catch {
      /* transcription failed */
    } finally {
      setRecording(false);
      setPaused(false);
      setTranscribing(false);
      setDuration(0);
    }
  };

  const togglePause = async () => {
    if (paused) {
      await audio.resumeRecording();
      setPaused(false);
    } else {
      await audio.pauseRecording();
      setPaused(true);
    }
  };

  if (transcribing) {
    return (
      <button
        disabled
        className="inline-flex items-center justify-center rounded-xl h-[42px] w-[42px] p-0 cursor-not-allowed"
        style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
        aria-label={t('transcribing')}
      >
        <Loader2 size={16} className="animate-spin" />
      </button>
    );
  }

  return (
    <button
      onClick={recording ? stopRecording : startRecording}
      className={`inline-flex items-center justify-center rounded-xl h-[42px] w-[42px] p-0 transition-all duration-200 active:scale-95 ${recording ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/30' : 'hover:bg-white/5'}`}
      style={{ color: recording ? undefined : 'var(--text-muted)' }}
      aria-label={recording ? t('stop') : t('record_audio')}
    >
      {recording ? (
        <div className="flex items-center gap-1.5">
          <Square size={12} />
          <span className="text-[10px] font-mono w-8">{formatTime(duration)}</span>
        </div>
      ) : (
        <Mic size={16} />
      )}
    </button>
  );
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
