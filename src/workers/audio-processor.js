// ============================================================
// Audio Processor Worker
// Handles audio recording, encoding, and preprocessing
// for the Whisper model
// ============================================================

let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;

self.onmessage = async function (event) {
  const { type, payload, id } = event.data;

  try {
    switch (type) {
      case 'START_RECORDING':
        await startRecording(payload, id);
        break;
      case 'STOP_RECORDING':
        await stopRecording(id);
        break;
      case 'PAUSE_RECORDING':
        pauseRecording(id);
        break;
      case 'RESUME_RECORDING':
        resumeRecording(id);
        break;
      case 'GET_RECORDING_STATUS':
        getRecordingStatus(id);
        break;
      case 'CANCEL_RECORDING':
        cancelRecording(id);
        break;
      default:
        self.postMessage({ type: 'ERROR', error: `Unknown type: ${type}`, id });
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error.message || 'Audio processing error',
      id,
    });
  }
};

async function startRecording({ mimeType = 'audio/webm;codecs=opus' } = {}, id) {
  // Reset chunks
  audioChunks = [];

  try {
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000, // Whisper expects 16kHz
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Check supported MIME types
    const supportedTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

    let selectedType = mimeType;
    if (!MediaRecorder.isTypeSupported(selectedType)) {
      selectedType = supportedTypes.find((type) => MediaRecorder.isTypeSupported(type)) || 'audio/webm';
    }

    mediaRecorder = new MediaRecorder(stream, {
      mimeType: selectedType,
      audioBitsPerSecond: 64000,
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        self.postMessage({
          type: 'RECORDING_DATA',
          chunkSize: event.data.size,
          totalChunks: audioChunks.length,
          id,
        });
      }
    };

    mediaRecorder.onerror = (event) => {
      self.postMessage({
        type: 'RECORDING_ERROR',
        error: event.error?.message || 'Recording error',
        id,
      });
    };

    mediaRecorder.onstop = async () => {
      // Combine chunks and create audio blob
      const audioBlob = new Blob(audioChunks, { type: selectedType });

      // Convert to Float32Array for Whisper
      const audioData = await blobToAudioData(audioBlob);

      // Stop all tracks
      stream.getTracks().forEach((track) => track.stop());

      self.postMessage({
        type: 'RECORDING_COMPLETE',
        audioData,
        blob: audioBlob,
        duration: audioChunks.length * 100, // Rough estimate
        mimeType: selectedType,
        id,
      });
    };

    // Start recording with timeslice for periodic data
    mediaRecorder.start(1000); // Get data every second

    self.postMessage({
      type: 'RECORDING_STARTED',
      mimeType: selectedType,
      timestamp: Date.now(),
      id,
    });
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      throw new Error('Microphone access denied. Please allow microphone access in your browser settings.', {
        cause: error,
      });
    } else if (error.name === 'NotFoundError') {
      throw new Error('No microphone found. Please connect a microphone.', {
        cause: error,
      });
    } else {
      throw error;
    }
  }
}

async function stopRecording(id) {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    self.postMessage({
      type: 'RECORDING_STATUS',
      status: 'inactive',
      message: 'No active recording',
      id,
    });
    return;
  }

  mediaRecorder.stop();
}

function pauseRecording(id) {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') {
    self.postMessage({
      type: 'RECORDING_STATUS',
      status: mediaRecorder?.state || 'inactive',
      message: 'Cannot pause - not recording',
      id,
    });
    return;
  }

  mediaRecorder.pause();
  self.postMessage({
    type: 'RECORDING_PAUSED',
    timestamp: Date.now(),
    id,
  });
}

function resumeRecording(id) {
  if (!mediaRecorder || mediaRecorder.state !== 'paused') {
    self.postMessage({
      type: 'RECORDING_STATUS',
      status: mediaRecorder?.state || 'inactive',
      message: 'Cannot resume - not paused',
      id,
    });
    return;
  }

  mediaRecorder.resume();
  self.postMessage({
    type: 'RECORDING_RESUMED',
    timestamp: Date.now(),
    id,
  });
}

function getRecordingStatus(id) {
  self.postMessage({
    type: 'RECORDING_STATUS',
    status: mediaRecorder?.state || 'inactive',
    chunkCount: audioChunks.length,
    id,
  });
}

function cancelRecording(id) {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  audioChunks = [];
  self.postMessage({
    type: 'RECORDING_CANCELLED',
    id,
  });
}

// Convert audio blob to Float32Array at 16kHz mono
// This is what Whisper expects
async function blobToAudioData(blob) {
  // Create OfflineAudioContext (available in workers)
  // AudioContext is NOT available in workers, but we only need decodeAudioData
  if (!audioContext) {
    audioContext = new OfflineAudioContext(1, 1, 16000);
  }

  // Decode audio
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Resample to 16kHz mono if needed
  const targetSampleRate = 16000;
  let audioData;

  if (audioBuffer.sampleRate === targetSampleRate && audioBuffer.numberOfChannels === 1) {
    audioData = audioBuffer.getChannelData(0);
  } else {
    // Resample using offline context
    const offlineCtx = new OfflineAudioContext(1, Math.ceil(audioBuffer.duration * targetSampleRate), targetSampleRate);

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const resampled = await offlineCtx.startRendering();
    audioData = resampled.getChannelData(0);
  }

  return audioData;
}
