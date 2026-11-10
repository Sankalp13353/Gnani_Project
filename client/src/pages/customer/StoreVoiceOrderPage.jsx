import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  MapPin,
  ArrowLeft,
  ArrowRight,
  Edit2,
  Check,
} from 'lucide-react';
import {
  fetchPublicStoreById,
  fetchPublicStoreCatalogue,
  transcribeVoiceOrder,
  parseOrderTranscript,
  submitCustomerOrder,
} from '../../services/api.js';
import { useCustomerStore } from '../../context/StoreContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { WavRecorder } from '../../utils/wavRecorder.js';

export const StoreVoiceOrderPage = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { selectStore } = useCustomerStore();
  const {
    cartItems,
    cartSubtotal,
    cartCount,
    unresolvedItems,
    clarifications,
    isCalculatingPricing,
    pricingError,
    updateQuantity,
    removeFromCart,
    clearCart,
    addVoiceItems,
    resolveUnresolvedItem,
    removeUnresolvedItem,
    setCartStore,
  } = useCart();

  // Store metadata
  const [store, setStore] = useState(null);
  const [storeCatalogue, setStoreCatalogue] = useState([]);
  const [storeLoading, setStoreLoading] = useState(true);
  const [storeError, setStoreError] = useState(null);

  // Audio recording state
  const [recordingState, setRecordingState] = useState('idle'); // idle | recording | recorded | processing
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioMimeType, setAudioMimeType] = useState('audio/wav');
  const [selectedLanguage, setSelectedLanguage] = useState('indic-auto');

  // Transcript & Parse Result
  const [transcript, setTranscript] = useState('');
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState('');
  const [audioMeta, setAudioMeta] = useState(null);

  // Customer Pickup details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState(null);

  // Idempotency key and confirmation secret generated once and retained across retries
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const confirmationSecretRef = useRef(
    typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues
      ? Array.from(window.crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')
      : (crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')).slice(0, 64)
  );

  // Refs for audio recorder & timers
  const wavRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);
  const activeStoreIdRef = useRef(storeId);
  activeStoreIdRef.current = storeId;

  // 1. Fetch Store Details and Public Catalogue on load
  const loadStoreAndCatalogue = useCallback(async () => {
    const targetStoreId = storeId;
    if (!targetStoreId) {
      setStoreError('No store ID provided. Please select an active store from the directory.');
      setStoreLoading(false);
      return;
    }

    setStoreLoading(true);
    setStoreError(null);

    try {
      const [storeRes, catRes] = await Promise.all([
        fetchPublicStoreById(targetStoreId),
        fetchPublicStoreCatalogue(targetStoreId, { limit: 100 }),
      ]);

      // Guard against stale asynchronous response if customer changed store
      if (activeStoreIdRef.current !== targetStoreId) {
        return;
      }

      if (storeRes?.success && storeRes?.data) {
        const s = storeRes.data;
        setStore(s);
        setStoreCatalogue(Array.isArray(catRes?.data) ? catRes.data : []);

        // Synchronize store context and cart context safely
        selectStore(s);
        setCartStore(s);
      } else {
        throw new Error(storeRes?.message || 'Store not found');
      }
    } catch (err) {
      if (activeStoreIdRef.current !== targetStoreId) {
        return;
      }
      console.error('Error loading store or catalogue:', err);
      const is404 = err.response?.status === 404;
      setStoreError(
        is404
          ? 'Store not found. Please select an active store from the directory.'
          : err.response?.data?.message || err.message || 'Error connecting to store catalogue'
      );
    } finally {
      if (activeStoreIdRef.current === targetStoreId) {
        setStoreLoading(false);
      }
    }
  }, [storeId, selectStore, setCartStore]);

  useEffect(() => {
    activeStoreIdRef.current = storeId;
    loadStoreAndCatalogue();
  }, [storeId, loadStoreAndCatalogue]);

  // Clean up audio recorder resources on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
      if (wavRecorderRef.current && wavRecorderRef.current.isRecording) {
        wavRecorderRef.current.stop();
      }
    };
  }, [audioUrl]);

  const handleRetry = () => {
    loadStoreAndCatalogue();
  };

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
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recordingState]);

  // Audio recording handlers
  const startRecording = async () => {
    setSubmissionError(null);
    try {
      const recorder = new WavRecorder();
      await recorder.start();
      wavRecorderRef.current = recorder;

      setAudioMimeType('audio/wav');
      setRecordingDuration(0);
      setRecordingState('recording');
    } catch (err) {
      console.error('Microphone access failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setSubmissionError('Microphone permission was denied. Please allow microphone access in your browser.');
      } else {
        setSubmissionError(err.message || 'Could not start recording.');
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
        console.error('Failed to finalize WAV:', err);
        setSubmissionError('Failed to finalize audio recording.');
        setRecordingState('idle');
      }
    }
  };

  const resetRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingDuration(0);
    setRecordingState('idle');
    setSubmissionError(null);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (ext === '.webm' || file.type.includes('webm')) {
      setSubmissionError(
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

  // Submit audio to backend for transcription and catalogue matching
  const handleProcessAudio = async () => {
    if (!audioBlob || !storeId) return;

    setRecordingState('processing');
    setSubmissionError(null);

    try {
      const ext = audioMimeType.includes('wav') ? 'wav' : 'mp3';
      const filename = `order_${Date.now()}.${ext}`;

      const response = await transcribeVoiceOrder(audioBlob, filename, selectedLanguage, storeId);

      if (response.success && response.data) {
        const data = response.data;
        setTranscript(data.transcript || '');
        setEditedTranscript(data.transcript || '');
        setAudioMeta(data.audio || null);

        // Filter matched items vs unresolved items
        const matched = (data.items || []).filter((item) => item.status === 'MATCHED' && item.productId);
        const unresolved = (data.items || []).filter((item) => item.status !== 'MATCHED' || !item.productId);

        // Add to shared cart context
        await addVoiceItems(matched, unresolved, data.clarificationQuestions || []);
        setRecordingState('recorded');
      } else {
        throw new Error(response.message || 'Failed to process voice order.');
      }
    } catch (err) {
      console.error('Voice order error:', err);
      const apiMsg = err.response?.data?.message || err.message;
      setSubmissionError(typeof apiMsg === 'string' ? apiMsg : JSON.stringify(apiMsg));
      setRecordingState('recorded');
    }
  };

  // Reprocess text transcript when customer manually edits it
  const handleReprocessTranscript = async () => {
    if (!editedTranscript.trim() || !storeId) return;

    setRecordingState('processing');
    setSubmissionError(null);

    try {
      const response = await parseOrderTranscript(editedTranscript.trim(), storeId);
      if (response.success && response.data) {
        const data = response.data;
        setTranscript(data.transcript);
        setIsEditingTranscript(false);

        const matched = (data.items || []).filter((item) => item.status === 'MATCHED' && item.productId);
        const unresolved = (data.items || []).filter((item) => item.status !== 'MATCHED' || !item.productId);

        await addVoiceItems(matched, unresolved, data.clarificationQuestions || []);
      } else {
        throw new Error(response.message || 'Failed to parse order text.');
      }
    } catch (err) {
      const apiMsg = err.response?.data?.message || err.message;
      setSubmissionError(typeof apiMsg === 'string' ? apiMsg : JSON.stringify(apiMsg));
    } finally {
      setRecordingState('recorded');
    }
  };

  // Final Order Submission
  const handleConfirmOrder = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      setSubmissionError('Your cart is empty. Please speak or add at least one product before submitting.');
      return;
    }

    if (unresolvedItems.length > 0) {
      setSubmissionError('Please resolve or dismiss all unmatched items before confirming your order.');
      return;
    }

    if (!store?.isOpen) {
      setSubmissionError('This store is currently closed and not accepting orders.');
      return;
    }

    if (!customerName.trim() || customerPhone.trim().length !== 10) {
      setSubmissionError('Please provide your name and a valid 10-digit mobile phone number.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const payload = {
        storeId,
        idempotencyKey: idempotencyKeyRef.current,
        confirmationToken: confirmationSecretRef.current,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        notes: notes.trim() || undefined,
        source: 'VOICE',
        items: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit || item.catalogUnit,
        })),
      };

      const response = await submitCustomerOrder(payload);

      if (response.success && response.data) {
        const createdOrder = response.data;
        const token = createdOrder.confirmationToken || confirmationSecretRef.current;

        // Clear cart
        clearCart();

        // Navigate to confirmation page using URL fragment #token=... (never query string ?token=...)
        navigate(`/orders/${createdOrder.id}/confirmation${token ? `#token=${encodeURIComponent(token)}` : ''}`, {
          state: { order: createdOrder, token },
        });
      } else {
        throw new Error(response.message || 'Failed to submit order');
      }
    } catch (err) {
      console.error('Order submission failed:', err.response?.data?.message || err.message);
      const apiMsg = err.response?.data?.message || err.message;
      setSubmissionError(typeof apiMsg === 'string' ? apiMsg : JSON.stringify(apiMsg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Loading state
  if (storeLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Connecting to store and live catalogue...</p>
      </div>
    );
  }

  // Store Error or Not Found
  if (storeError || !store) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Connection Failed</h2>
        <p className="text-sm text-slate-600">{storeError || 'The requested store could not be found.'}</p>
        <div className="pt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Connection</span>
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Browse Available Stores</span>
          </Link>
        </div>
      </div>
    );
  }

  // Store Closed Warning
  if (!store.isOpen) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">{store.name} is Currently Closed</h2>
        <p className="text-sm text-slate-600">
          This store is not accepting voice orders right now. Please check back during store operating hours or choose another local kirana store.
        </p>
        <div className="pt-4 flex items-center justify-center gap-3">
          <Link
            to={`/stores/${store.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50"
          >
            <span>View Catalogue</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700"
          >
            <span>Explore Other Stores</span>
          </Link>
        </div>
      </div>
    );
  }

  const isConfirmDisabled =
    cartItems.length === 0 ||
    unresolvedItems.length > 0 ||
    !store.isOpen ||
    isCalculatingPricing ||
    Boolean(pricingError) ||
    !customerName.trim() ||
    customerPhone.trim().length !== 10 ||
    isSubmitting;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Back button and Cart link */}
      <div className="flex items-center justify-between">
        <Link
          to={`/stores/${store.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {store.name} Catalogue</span>
        </Link>

        <Link
          to={`/stores/${store.id}/cart`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold border border-blue-200 transition-colors"
        >
          <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
          <span>Review Cart ({cartCount})</span>
        </Link>
      </div>

      {/* Selected Store Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-blue-950 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold">
              Open for Pickup
            </span>
            <span className="text-xs text-blue-200">Ordering at:</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">{store.name}</h1>
          <p className="text-xs text-slate-300 flex items-center gap-1 mt-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {store.address}, {store.city} — {store.pincode}
            </span>
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-blue-200 block">Catalogue Scope</span>
          <span className="text-xs font-medium text-slate-300 bg-white/10 px-2.5 py-1 rounded-lg inline-block mt-1">
            {storeCatalogue.length} Products Available
          </span>
        </div>
      </div>

      {/* Empty Catalogue Warning (if store has no products) */}
      {storeCatalogue.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            Notice: <strong>{store.name}</strong> has not listed any in-stock products in its catalogue yet. Spoken voice items will require manual selection once inventory is added.
          </span>
        </div>
      )}

      {/* Section 1: Voice Intake Interface */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Mic className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Speak Your Grocery Order</h2>
              <p className="text-xs text-slate-500">Natural Hindi, English, or Hinglish via Gnani Prisma v3 STT</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
              <span className="text-slate-400 font-medium">Model:</span>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
                disabled={recordingState === 'recording' || recordingState === 'processing'}
              >
                <option value="indic-auto">Indic Auto (Hindi / Hinglish)</option>
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
              <span>Upload</span>
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

        {/* Microphone Recording Area */}
        <div className="p-6">
          <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
            {recordingState === 'idle' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={startRecording}
                  className="w-20 h-20 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all transform hover:scale-105 active:scale-95 mx-auto"
                  title="Click to start recording"
                >
                  <Mic className="w-8 h-8" />
                </button>
                <div>
                  <p className="font-semibold text-slate-800">Tap microphone and speak order</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Example: &ldquo;दो किलो आटा, एक किलो नमक और तीन पैकेट मैगी देना।&rdquo;
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
                  <p className="text-xs text-slate-500 mt-2">Click red square when finished</p>
                </div>
              </div>
            )}

            {(recordingState === 'recorded' || recordingState === 'processing') && (
              <div className="space-y-4 w-full max-w-md">
                <div className="flex items-center justify-center gap-3">
                  <Volume2 className="w-5 h-5 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Audio Ready</span>
                  {recordingDuration > 0 && (
                    <span className="text-xs text-slate-500 font-mono">({formatSeconds(recordingDuration)})</span>
                  )}
                </div>

                {audioUrl && <audio controls src={audioUrl} className="w-full mt-2" />}

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
                    onClick={handleProcessAudio}
                    disabled={recordingState === 'processing'}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
                  >
                    {recordingState === 'processing' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Processing with Gnani...</span>
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

          {/* Transcript Display & Edit Area */}
          {transcript && (
            <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Spoken Transcript
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {audioMeta && (
                    <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                      Lang: {audioMeta.detectedLanguage || selectedLanguage}
                    </span>
                  )}
                  {!isEditingTranscript ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingTranscript(true)}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Transcript</span>
                    </button>
                  ) : null}
                </div>
              </div>

              {!isEditingTranscript ? (
                <p className="text-base text-slate-800 font-medium italic bg-white p-3 rounded-lg border border-slate-200">
                  &ldquo;{transcript}&rdquo;
                </p>
              ) : (
                <div className="space-y-2 mt-2">
                  <textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 text-sm rounded-lg border border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="Edit order text..."
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditedTranscript(transcript);
                        setIsEditingTranscript(false);
                      }}
                      className="px-3 py-1 text-xs text-slate-600 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleReprocessTranscript}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700"
                    >
                      <Check className="w-3 h-3" />
                      <span>Update & Reprocess</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clarification Alert */}
          {clarifications.length > 0 && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
              <div className="flex items-center gap-2 mb-1.5 font-semibold text-xs">
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <span>Notice Regarding Order Items</span>
              </div>
              <ul className="list-disc list-inside text-xs space-y-1 text-amber-800">
                {clarifications.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Unresolved Items Resolution (if any) */}
      {unresolvedItems.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-amber-900">Unmatched Spoken Items ({unresolvedItems.length})</h3>
              <p className="text-xs text-amber-800">
                Some spoken items could not be matched directly to {store.name}&apos;s live catalogue. Select an available product below:
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {unresolvedItems.map((unItem, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-amber-200 text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-800">&ldquo;{unItem.originalText}&rdquo;</span>
                  <p className="text-slate-500 mt-0.5">
                    {unItem.clarificationReason || 'Product not recognized in this store catalogue.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const prod = storeCatalogue.find((p) => p.id === e.target.value);
                      if (prod) {
                        resolveUnresolvedItem(idx, prod);
                      }
                    }}
                    className="p-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="" disabled>
                      + Choose from {store.name} catalogue...
                    </option>
                    {storeCatalogue.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name} ({prod.unit}) — ₹{prod.price}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => removeUnresolvedItem(idx)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                    title="Dismiss item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Reviewable Cart & Quantity Editor */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Your Cart ({cartItems.length} items)</h2>
              <p className="text-xs text-slate-500">Verified against {store.name}&apos;s live database catalogue</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-500 block">Server-Verified Subtotal</span>
            <span className="text-xl font-extrabold text-slate-900">₹{cartSubtotal}</span>
          </div>
        </div>

        <div className="p-5">
          {cartItems.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {cartItems.map((item, idx) => (
                <div key={idx} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">{item.productName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Rate: ₹{item.unitPrice} per {item.catalogUnit || item.unit}
                      {item.conversionNote && (
                        <span className="text-blue-600 ml-2 font-medium">({item.conversionNote})</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6">
                    {/* Quantity controls */}
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="p-1.5 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-40"
                        disabled={isCalculatingPricing}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 py-1 text-xs font-semibold text-slate-800 min-w-[3rem] text-center">
                        {item.quantity} {item.unit || item.catalogUnit}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="p-1.5 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-40"
                        disabled={isCalculatingPricing}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Line Total */}
                    <div className="text-right min-w-[5rem]">
                      <span className="text-sm font-bold text-slate-900">₹{item.lineTotal}</span>
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 text-sm">
              <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-medium text-slate-700">Your cart is currently empty.</p>
              <p className="text-xs text-slate-400 mt-1">Speak an order above or browse the catalogue to add items.</p>
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Customer Details & Final Order Submission Form */}
      {cartItems.length > 0 && (
        <form onSubmit={handleConfirmOrder} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800">In-Store Pickup Customer Details</h3>
              <p className="text-xs text-slate-500">Provide your contact info so the shopkeeper can identify your order at pickup.</p>
            </div>
            <Link
              to={`/stores/${store.id}/cart`}
              className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              <span>Full Cart Page</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Your Name</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone (10 Digits)</label>
              <input
                type="tel"
                required
                pattern="[0-9]{10}"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="e.g. 9876543210"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Pickup Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Arriving around 6 PM, please pack in one bag"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Payment Notice */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between text-xs text-blue-900">
            <div>
              <span className="font-semibold block">Payment Terms:</span>
              <span>Pay in-store during pickup via Cash or UPI at the shopkeeper&apos;s counter.</span>
            </div>
            <span className="px-2.5 py-1 bg-white font-semibold rounded border border-blue-200 text-blue-800">
              CASH / UPI ON PICKUP
            </span>
          </div>

          {/* Pricing Error Alert */}
          {pricingError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{pricingError}</span>
            </div>
          )}

          {/* Submission Error */}
          {submissionError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{submissionError}</span>
            </div>
          )}

          {/* Confirm Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div>
              <span className="text-xs text-slate-500 block">Total Payable at Counter</span>
              <span className="text-2xl font-extrabold text-blue-900">₹{cartSubtotal}</span>
            </div>

            <button
              type="submit"
              disabled={isConfirmDisabled}
              className="w-full sm:w-auto px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              title={
                unresolvedItems.length > 0
                  ? 'Resolve all unmatched voice items first'
                  : 'Place order for in-store pickup'
              }
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting Order...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Place Order</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default StoreVoiceOrderPage;
