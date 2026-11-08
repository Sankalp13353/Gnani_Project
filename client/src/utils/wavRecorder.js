/**
 * WAV Audio Recorder using Web Audio API
 * Records 16kHz 16-bit Mono PCM WAV audio directly in the browser
 * Natively supported by Gnani Prisma v3 REST API (which does not support WebM)
 */

export class WavRecorder {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.scriptProcessor = null;
    this.audioInput = null;
    this.samples = [];
    this.isRecording = false;
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone access is not supported by your browser.');
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    const inputSampleRate = this.audioContext.sampleRate;
    const targetSampleRate = 16000;

    this.audioInput = this.audioContext.createMediaStreamSource(this.mediaStream);
    // Buffer size 4096 gives smooth capture without drops
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.samples = [];
    this.isRecording = true;

    this.scriptProcessor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const inputData = e.inputBuffer.getChannelData(0);

      // Downsample to 16kHz if audio context runs at 44.1kHz or 48kHz
      if (inputSampleRate === targetSampleRate) {
        this.samples.push(new Float32Array(inputData));
      } else {
        const ratio = inputSampleRate / targetSampleRate;
        const newLength = Math.round(inputData.length / ratio);
        const downsampled = new Float32Array(newLength);
        for (let i = 0; i < newLength; i++) {
          const originalIndex = Math.min(Math.round(i * ratio), inputData.length - 1);
          downsampled[i] = inputData[originalIndex];
        }
        this.samples.push(downsampled);
      }
    };

    this.audioInput.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);
  }

  stop() {
    this.isRecording = false;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
    }
    if (this.audioInput) {
      this.audioInput.disconnect();
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    // Merge all float sample chunks
    const totalLength = this.samples.reduce((acc, curr) => acc + curr.length, 0);
    const mergedSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.samples) {
      mergedSamples.set(chunk, offset);
      offset += chunk.length;
    }

    // Encode merged float samples to 16-bit PCM WAV Blob
    return this.encodeWAV(mergedSamples, 16000);
  }

  encodeWAV(samples, sampleRate = 16000) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (view, offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // File length (36 + data size)
    view.setUint32(4, 36 + samples.length * 2, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // Format chunk identifier
    writeString(view, 12, 'fmt ');
    // Format chunk length (16 for PCM)
    view.setUint32(16, 16, true);
    // Sample format (1 for raw linear PCM)
    view.setUint16(20, 1, true);
    // Channel count (1 for mono)
    view.setUint16(22, 1, true);
    // Sample rate (16000)
    view.setUint32(24, sampleRate, true);
    // Byte rate (SampleRate * 1 channel * 2 bytes/sample)
    view.setUint32(28, sampleRate * 2, true);
    // Block align (1 channel * 2 bytes/sample)
    view.setUint16(32, 2, true);
    // Bits per sample (16 bits)
    view.setUint16(34, 16, true);
    // Data chunk identifier
    writeString(view, 36, 'data');
    // Data chunk length
    view.setUint32(40, samples.length * 2, true);

    // Float32 to Int16 PCM conversion
    let index = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      index += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }
}

export default WavRecorder;

