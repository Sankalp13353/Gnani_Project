import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  RefreshCw,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  Volume2,
  FileAudio,
  Sparkles,
  HelpCircle,
  Info,
} from 'lucide-react';
import { transcribeVoiceOrder } from '../services/api.js';
import { WavRecorder } from '../utils/wavRecorder.js';

export const VoiceOrderIntake = () => {
  const [recordingState, setRecordingState] = useState('idle'); // idle | recording | recorded | processing
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioMimeType, setAudioMimeType] = useState('audio/wav');
  const [selectedLanguage, setSelectedLanguage] = useState('indic-auto');
  const [orderResult, setOrderResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const wavRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (wavRecorderRef.current && wavRecorderRef.current.isRecording) {
        wavRecorderRef.current.stop();
      }
    };
  }, [audioUrl]);

  // Timer updater during active recording
  useEffect(() => {
    if (recordingState === 'recording') {
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 30) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recordingState]);

  const startRecording = async () => {
    setErrorMessage(null);
    setOrderResult(null);

    try {
      const recorder = new WavRecorder();
      await recorder.start();
      wavRecorderRef.current = recorder;

      setAudioMimeType('audio/wav');
      setRecordingDuration(0);
      setRecordingState('recording');
    } catch (err) {
      console.error('Failed to access microphone:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone permission was denied. Please allow microphone access in your browser settings.');
      } else {
        setErrorMessage(err.message || 'Could not start audio recording.');
      }
      setRecordingState('idle');
    }
  };

  const stopRecording = () => {
    if (wavRecorderRef.current && recordingState === 'recording') {
      try {
        const wavBlob = wavRecorderRef.current.stop();
        const url = URL.createObjectURL(wavBlob);
        setAudioBlob(wavBlob);
        setAudioUrl(url);
        setAudioMimeType('audio/wav');
        setRecordingState('recorded');
      } catch (err) {
        console.error('Failed to stop recording:', err);
        setErrorMessage('Failed to finalize audio recording.');
        setRecordingState('idle');
      }
    }
  };

  const resetRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingDuration(0);
    setRecordingState('idle');
    setErrorMessage(null);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate that user is not uploading webm
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (ext === '.webm' || file.type.includes('webm')) {
      setErrorMessage(
        'WebM audio is not supported by Gnani Prisma STT. Please upload audio in WAV, MP3, M4A, OGG, FLAC, or AAC format, or use the microphone to record directly in WAV.'
      );
      if (event.target) event.target.value = '';
      return;
    }

    resetRecording();
    const url = URL.createObjectURL(file);
    setAudioBlob(file);
    setAudioUrl(url);
    setAudioMimeType(file.type || 'audio/wav');
    setRecordingState('recorded');
  };

  const handleSubmitVoiceOrder = async () => {
    if (!audioBlob) return;

    setRecordingState('processing');
    setErrorMessage(null);

    try {
      const ext = audioMimeType.includes('wav')
        ? 'wav'
        : audioMimeType.includes('mp3') || audioMimeType.includes('mpeg')
        ? 'mp3'
        : audioMimeType.includes('m4a') || audioMimeType.includes('mp4')
        ? 'm4a'
        : audioMimeType.includes('ogg')
        ? 'ogg'
        : audioMimeType.includes('aac')
        ? 'aac'
        : audioMimeType.includes('flac')
        ? 'flac'
        : 'wav';

      const filename = `voice_order_${Date.now()}.${ext}`;
      const response = await transcribeVoiceOrder(audioBlob, filename, selectedLanguage);

      if (response.success && response.data) {
        setOrderResult(response.data);
        setRecordingState('recorded');
      } else {
        throw new Error(response.message || 'Failed to process voice order.');
      }
    } catch (err) {
      console.error('Voice order error:', err);
      const apiMsg = err.response?.data?.message || err.message;
      setErrorMessage(typeof apiMsg === 'string' ? apiMsg : JSON.stringify(apiMsg));
      setRecordingState('recorded');
    }
  };

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Mic className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-800">Voice Order Intake</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Speak orders naturally in Hindi, English, or Hinglish via Gnani Prisma v3 STT.
          </p>
        </div>

        {/* Language selector & File Upload option */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
            <span className="text-slate-400 font-medium">Model:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
              disabled={recordingState === 'recording' || recordingState === 'processing'}
            >
              <option value="indic-auto">Indic Auto (Code-mixed)</option>
              <option value="hi-IN">Hindi (hi-IN)</option>
              <option value="en-IN">English (en-IN)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 transition-colors"
            title="Upload pre-recorded audio"
            disabled={recordingState === 'recording' || recordingState === 'processing'}
          >
            <FileAudio className="w-3.5 h-3.5" />
            <span>Upload Audio</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/wav,audio/mpeg,audio/mp3,audio/m4a,audio/ogg,audio/aac,audio/flac,.wav,.mp3,.m4a,.ogg,.aac,.flac"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Recording Controls Area */}
        <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
          {recordingState === 'idle' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={startRecording}
                className="w-20 h-20 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all transform hover:scale-105 active:scale-95 mx-auto"
                title="Click to start recording"
              >
                <Mic className="w-8 h-8" />
              </button>
              <div>
                <p className="font-semibold text-slate-800">Tap microphone to record order</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Try speaking: &ldquo;Bhaiya, do kilo atta, ek litre sunflower oil aur 3 Maggi de dena.&rdquo;
                </p>
              </div>
            </div>
          )}

          {recordingState === 'recording' && (
            <div className="space-y-4">
              <div className="relative mx-auto w-20 h-20">
                <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75"></div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="relative w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition-all mx-auto"
                  title="Click to stop recording"
                >
                  <Square className="w-7 h-7" />
                </button>
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 font-mono text-sm font-semibold">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                  <span>Recording: {formatSeconds(recordingDuration)} / 00:30</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">Click the red square when finished speaking</p>
              </div>
            </div>
          )}

          {(recordingState === 'recorded' || recordingState === 'processing') && (
            <div className="space-y-4 w-full max-w-md">
              <div className="flex items-center justify-center gap-3">
                <Volume2 className="w-5 h-5 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Audio Recorded</span>
                {recordingDuration > 0 && (
                  <span className="text-xs text-slate-500 font-mono">({formatSeconds(recordingDuration)})</span>
                )}
              </div>

              {audioUrl && (
                <audio controls src={audioUrl} className="w-full mt-2" />
              )}

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetRecording}
                  disabled={recordingState === 'processing'}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Re-record</span>
                </button>

                <button
                  type="button"
                  onClick={handleSubmitVoiceOrder}
                  disabled={recordingState === 'processing'}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50"
                >
                  {recordingState === 'processing' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Transcribing with Gnani...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Transcribe & Process Order</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Voice Processing Error</p>
              <p className="mt-0.5 text-red-700">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Result Area */}
        {orderResult && (
          <div className="space-y-6 pt-4 border-t border-slate-100">
            {/* Transcript Banner */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Gnani Prisma Transcript
                  </span>
                </div>
                {orderResult.audio && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono">
                      Lang: {orderResult.audio.detectedLanguage || 'indic-auto'}
                    </span>
                    {orderResult.audio.processingTime && (
                      <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {orderResult.audio.processingTime}s
                      </span>
                    )}
                  </div>
                )}
              </div>
              <p className="text-base text-slate-800 font-medium italic bg-white p-3 rounded-lg border border-slate-200">
                &ldquo;{orderResult.transcript || '(No speech detected)'}&rdquo;
              </p>
            </div>

            {/* Clarification Notice if required */}
            {orderResult.needsClarification && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                <div className="flex items-center gap-2 mb-1.5 font-semibold text-sm">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <span>Clarification Required Before Fulfilling Order</span>
                </div>
                <ul className="list-disc list-inside text-xs space-y-1 text-amber-800">
                  {orderResult.clarificationQuestions?.map((q, idx) => (
                    <li key={idx}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Parsed Items List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Extracted Order Items ({orderResult.items?.length || 0})
                </h3>
                <span className="text-xs text-slate-500">
                  Subtotal:{' '}
                  <span className="font-bold text-slate-900 text-sm">
                    ₹{orderResult.subtotal || '0.00'}
                  </span>
                </span>
              </div>

              {orderResult.items && orderResult.items.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase">
                      <tr>
                        <th className="px-4 py-3">Spoken Phrase</th>
                        <th className="px-4 py-3">Matched Product</th>
                        <th className="px-4 py-3">Qty & Unit</th>
                        <th className="px-4 py-3">Rate</th>
                        <th className="px-4 py-3 text-right">Line Total</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {orderResult.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-medium text-slate-700">
                            &ldquo;{item.originalText}&rdquo;
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-800">
                              {item.productName || item.matchedCatalogName || '—'}
                            </span>
                            {item.conversionNote && (
                              <p className="text-xs text-blue-600 mt-0.5">{item.conversionNote}</p>
                            )}
                            {item.clarificationReason && (
                              <p className="text-xs text-amber-600 mt-0.5">{item.clarificationReason}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {item.quantity ? `${item.quantity} ${item.unit || ''}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {item.unitPrice ? `₹${item.unitPrice}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {item.lineTotal ? `₹${item.lineTotal}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                item.status === 'MATCHED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.status === 'AMBIGUOUS'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  No items detected in transcript.
                </div>
              )}
            </div>

            {/* Order Summary & Notice */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-blue-50/60 rounded-xl border border-blue-200">
              <div className="flex items-center gap-2 text-xs text-blue-800">
                <Info className="w-4 h-4 flex-shrink-0" />
                <span>
                  <strong>Phase 4 Draft Order:</strong> Not persisted to database. Order confirmation and packing slips will follow in subsequent phases.
                </span>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-xs text-slate-600 block">Total Estimated Amount</span>
                <span className="text-xl font-extrabold text-blue-900">
                  ₹{orderResult.subtotal || '0.00'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceOrderIntake;

