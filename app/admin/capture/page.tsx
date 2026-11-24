'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Camera,
  SwitchCamera,
  Zap,
  Check,
  CheckCircle2,
  ArrowLeft,
  Image as ImageIcon,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';

interface EventSettings {
  id: number;
  event_title: string;
  event_subtitle: string;
  organizer_label: string;
  status: 'WAITING' | 'OPEN' | 'CLOSED';
  require_pin: boolean;
  room_pin: string;
  timer_minutes: number;
  ends_at: string | null;
}

interface CandidateSummary {
  id: number;
  number: number;
}

const CATEGORY_PRESETS = ['Participant', 'Guest', 'VIP', 'General'];

export default function MobileQuickCapturePage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // Camera state
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [cameraFlash, setCameraFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Captured photo & form state
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [compressedKb, setCompressedKb] = useState<number | null>(null);
  const [nomineeNumber, setNomineeNumber] = useState<string>('01');
  const [editingNumber, setEditingNumber] = useState(false);
  const [name, setName] = useState('');
  const [theme, setTheme] = useState('');
  const [category, setCategory] = useState('Participant');
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);

  const showToast = (msg: string, isError = false) => {
    setToastMsg(msg);
    setToastError(isError);
    setTimeout(() => setToastMsg(null), 2600);
  };

  // 1. Auth Check
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/auth/me');
        const data = await res.json();
        if (!data.authenticated) {
          router.push('/admin/login');
        } else {
          setAuthenticated(true);
        }
      } catch {
        router.push('/admin/login');
      }
    }
    checkAuth();
  }, [router]);

  // 2. Load settings & next candidate number
  const loadSessionMeta = async (updateNextNumber = false) => {
    try {
      const requests: Promise<Response>[] = [fetch('/api/admin/settings')];
      if (updateNextNumber) requests.push(fetch('/api/admin/candidates'));
      const [settRes, candRes] = await Promise.all(requests);

      if (settRes.ok) {
        const settData = await settRes.json();
        setSettings(settData.settings);
      }
      if (candRes && candRes.ok) {
        const candData = await candRes.json();
        const list: CandidateSummary[] = candData.candidates || [];
        const maxNum = list.length ? Math.max(...list.map((c) => c.number), 0) : 0;
        setNomineeNumber(String(maxNum + 1).padStart(2, '0'));
      }
    } catch (err) {
      console.error('Failed to load capture session metadata:', err);
    }
  };

  useEffect(() => {
    if (authenticated) {
      loadSessionMeta(true);
      const interval = setInterval(() => loadSessionMeta(false), 5000);
      return () => clearInterval(interval);
    }
  }, [authenticated]);

  // 3. Countdown Timer Sync
  useEffect(() => {
    if (settings?.status === 'OPEN' && settings.ends_at) {
      const updateTimer = () => {
        const end = new Date(settings.ends_at!).getTime();
        setRemainingSeconds(Math.max(0, Math.floor((end - Date.now()) / 1000)));
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setRemainingSeconds(null);
    }
  }, [settings?.status, settings?.ends_at]);

  const formatTimer = (sec: number | null) => {
    if (sec === null) return `${String(settings?.timer_minutes || 5).padStart(2, '0')}:00`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // 4. WebRTC Camera Lifecycle
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (facing: 'environment' | 'user') => {
    stopCamera();
    setCameraError(false);
    setCameraReady(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1600 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      setCameraError(true);
    }
  };

  useEffect(() => {
    if (authenticated) {
      startCamera(cameraFacing);
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  const handleFlipCamera = () => {
    const next = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(next);
    startCamera(next);
  };

  // 5. 4:5 Crop & <80KB WebP Compression
  const compressToWebp4x5 = (
    source: HTMLImageElement | HTMLVideoElement,
    srcW: number,
    srcH: number
  ) => {
    const targetRatio = 4 / 5;
    const maxH = 720;
    const srcRatio = srcW / srcH;

    let sx = 0,
      sy = 0,
      sw = srcW,
      sh = srcH;
    if (srcRatio > targetRatio) {
      sw = srcH * targetRatio;
      sx = (srcW - sw) / 2;
    } else {
      sh = srcW / targetRatio;
      sy = Math.max(0, (srcH - sh) * 0.35);
    }

    const outH = Math.min(maxH, Math.round(sh));
    const outW = Math.round(outH * targetRatio);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, outW, outH);

    let dataUrl = canvas.toDataURL('image/webp', 0.75);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    }

    const kb = Math.round(((dataUrl.length * 3) / 4) / 1024);
    setCapturedPhotoUrl(dataUrl);
    setCompressedKb(kb);
    nameInputRef.current?.focus();
  };

  const handleSnapOrRetake = () => {
    if (capturedPhotoUrl) {
      // Retake
      setCapturedPhotoUrl(null);
      setCompressedKb(null);
      return;
    }

    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      showToast('Camera not ready — upload a photo instead.', true);
      return;
    }

    setCameraFlash(true);
    setTimeout(() => setCameraFlash(false), 280);
    compressToWebp4x5(video, video.videoWidth, video.videoHeight);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => compressToWebp4x5(img, img.naturalWidth, img.naturalHeight);
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 6. Save Nominee
  const handleSaveNominee = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!capturedPhotoUrl) {
      showToast('Snap or upload a portrait photo first.', true);
      return;
    }
    if (!name.trim()) {
      nameInputRef.current?.focus();
      showToast('Please enter the nominee name.', true);
      return;
    }

    setSubmitting(true);
    try {
      const parsedNum = parseInt(nomineeNumber, 10);
      const res = await fetch('/api/admin/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: Number.isFinite(parsedNum) ? parsedNum : undefined,
          name: name.trim(),
          category,
          costume_theme: theme.trim() || null,
          photo_data: capturedPhotoUrl,
          is_active: publishImmediately,
        }),
      });

      if (res.ok) {
        showToast('Nominee saved');
        setName('');
        setTheme('');
        setCapturedPhotoUrl(null);
        setCompressedKb(null);
        setEditingNumber(false);
        await loadSessionMeta(true);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save nominee.', true);
      }
    } catch {
      showToast('Network error while saving nominee.', true);
    } finally {
      setSubmitting(false);
    }
  };

  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 border-4 border-theme-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const status = settings?.status || 'WAITING';
  const organizer = settings?.organizer_label || 'Event Committee';

  return (
    <div className="min-h-screen bg-[#F8FAFC] sm:bg-slate-100 sm:py-6 sm:px-4 flex items-center justify-center font-[family-name:var(--font-inter)] text-[#0F172A]">
      <div className="relative w-full h-screen sm:h-[calc(100vh-3rem)] sm:max-h-[880px] sm:max-w-[430px] flex flex-col overflow-hidden bg-[#F8FAFC] sm:rounded-[32px] sm:shadow-[0_24px_60px_rgba(15,23,42,0.14)] sm:border sm:border-slate-200/80">
        {/* Sticky Top Header */}
        <header className="shrink-0 border-b border-slate-200/70 bg-[#F8FAFC] px-6 pb-4 pt-5 sm:pt-7">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href="/admin"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:border-theme-primary hover:text-theme-primary transition"
                  aria-label="Back to Committee Dashboard"
                  title="Back to Dashboard"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Link>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-theme-primary truncate">
                  {organizer}
                </p>
              </div>

              <div className="mt-2 flex items-center gap-2">
                {status === 'OPEN' ? (
                  <>
                    <span className="pulse-dot h-2 w-2 rounded-full bg-green-500" />
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      Voting Open
                    </span>
                  </>
                ) : status === 'WAITING' ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                      Waiting
                    </span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                      Voting Closed
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {status === 'OPEN' ? 'Time left' : 'Duration'}
              </p>
              <p className="tabular mt-1 text-[16px] font-semibold tracking-tight text-[#0F172A]">
                {formatTimer(remainingSeconds)}
              </p>
            </div>
          </div>
        </header>

        {/* Scrollable Viewfinder & Form */}
        <main className="gallery-scroll flex-1 overflow-y-auto px-6 pb-28 pt-5">
          {/* Live 4:5 Viewfinder */}
          <section
            className="relative aspect-[4/5] overflow-hidden rounded-[15px] bg-slate-900 shadow-[0_14px_38px_rgba(15,23,42,0.12),0_2px_8px_rgba(15,23,42,0.04)]"
            aria-label="Camera viewfinder"
          >
            {capturedPhotoUrl ? (
              <img
                src={capturedPhotoUrl}
                alt="Captured nominee portrait"
                className="h-full w-full object-cover"
              />
            ) : (
              <video
                ref={videoRef}
                className={`h-full w-full object-cover ${cameraError ? 'hidden' : 'block'}`}
                autoPlay
                muted
                playsInline
              />
            )}

            {/* Camera Ready / Fallback State */}
            {!capturedPhotoUrl && (cameraError || !cameraReady) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-slate-700 to-theme-dark px-8 text-center text-white">
                <Camera className="w-10 h-10 text-white/80" />
                <p className="mt-3 text-sm font-semibold">
                  {cameraError ? 'Camera unavailable' : 'Starting camera...'}
                </p>
                <p className="mt-1 text-xs leading-5 text-white/65">
                  {cameraError
                    ? 'Allow camera access or pick a photo directly from your device.'
                    : 'Frame the nominee portrait inside the 4:5 grid.'}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <label className="inline-flex items-center gap-1.5 rounded-full bg-theme-primary hover:bg-theme-dark px-4 py-2 text-xs font-semibold text-white shadow cursor-pointer">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Upload / Native Camera</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Rule-of-thirds grid & crosshair overlay (hidden once captured) */}
            {!capturedPhotoUrl && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/20" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/20" />
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/20" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/20" />
                <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25 shadow-[0_0_0_1px_rgba(255,255,255,0.2)]" />
                <div className="absolute left-1/2 top-[calc(50%-1px)] h-px w-20 -translate-x-1/2 bg-white/30" />
                <div className="absolute left-[calc(50%-1px)] top-1/2 h-20 w-px -translate-y-1/2 bg-white/30" />
              </div>
            )}

            {/* Flash overlay */}
            {cameraFlash && (
              <div className="absolute inset-0 bg-white z-20 animate-flash pointer-events-none" />
            )}

            {/* Top-Right Flip Camera / Gallery Upload */}
            {!capturedPhotoUrl ? (
              <button
                type="button"
                onClick={handleFlipCamera}
                aria-label="Flip camera"
                className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-theme-primary text-white shadow-lg transition hover:bg-theme-dark active:scale-95 cursor-pointer"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCapturedPhotoUrl(null);
                  setCompressedKb(null);
                }}
                aria-label="Retake photo"
                className="absolute right-3 top-3 flex h-11 px-3.5 items-center justify-center gap-1.5 rounded-full bg-slate-950/75 text-white text-xs font-semibold backdrop-blur-sm hover:bg-slate-950 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake</span>
              </button>
            )}

            {/* Bottom-Left WebP Compression Pill & Gallery Quick Trigger */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
              <div className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-slate-950/70 px-3 text-[12px] font-medium text-white backdrop-blur-sm">
                <Zap className="w-[13px] h-[13px] text-theme-accent" />
                <span>
                  {compressedKb !== null ? `WebP · ${compressedKb} KB` : 'WebP · <80 KB'}
                </span>
              </div>

              {!capturedPhotoUrl && cameraReady && (
                <label className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-slate-950/70 hover:bg-slate-950 px-3 text-[12px] font-medium text-white backdrop-blur-sm cursor-pointer transition">
                  <ImageIcon className="w-[13px] h-[13px]" />
                  <span>Gallery</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </section>

          {/* Snap / Photo Captured Primary Button */}
          <button
            type="button"
            onClick={handleSnapOrRetake}
            className={`mt-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition active:scale-[0.98] cursor-pointer ${
              capturedPhotoUrl
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_7px_16px_rgba(5,150,105,0.22)]'
                : 'bg-theme-primary hover:bg-theme-dark text-white shadow-[0_7px_16px_rgba(0,111,214,0.22)]'
            }`}
          >
            {capturedPhotoUrl ? (
              <>
                <Check className="w-5 h-5" />
                <span>Photo Captured · Tap to Retake</span>
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                <span>Snap Photo</span>
              </>
            )}
          </button>

          {/* White Form Card */}
          <section
            className="mt-6 rounded-[24px] bg-white p-5 shadow-[0_14px_38px_rgba(15,23,42,0.07),0_2px_8px_rgba(15,23,42,0.03)]"
            aria-labelledby="nominee-form-title"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-theme-primary">
                  New Nominee
                </p>
                <h1
                  id="nominee-form-title"
                  className="mt-1 text-[20px] font-bold tracking-tight text-[#0F172A]"
                >
                  Capture details
                </h1>
              </div>

              {editingNumber ? (
                <input
                  type="number"
                  value={nomineeNumber}
                  onChange={(e) => setNomineeNumber(e.target.value)}
                  onBlur={() => setEditingNumber(false)}
                  autoFocus
                  className="tabular h-10 w-16 rounded-full border-2 border-theme-primary text-center text-xs font-bold text-[#0F172A] outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingNumber(true)}
                  title="Tap to edit nominee number"
                  className="tabular flex h-10 min-w-[40px] px-2.5 items-center justify-center rounded-full bg-theme-primary text-xs font-bold text-white cursor-pointer"
                >
                  #{nomineeNumber.padStart(2, '0')}
                </button>
              )}
            </div>

            <form onSubmit={handleSaveNominee} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-[12px] font-semibold text-slate-600">
                  Name <span className="text-theme-primary">*</span>
                </span>
                <input
                  ref={nameInputRef}
                  required
                  autoComplete="off"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter nominee name"
                  className="h-[52px] w-full rounded-[15px] border border-slate-200 focus:border-2 focus:border-theme-primary bg-white px-4 text-[14px] text-[#0F172A] outline-none transition focus:shadow-[0_0_0_4px_rgba(0,111,214,0.10)] placeholder:text-slate-400"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[12px] font-semibold text-slate-600">
                  Theme <span className="font-normal text-slate-400">Optional</span>
                </span>
                <input
                  autoComplete="off"
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="Add a theme or description"
                  className="h-[52px] w-full rounded-[15px] border border-slate-200 bg-white px-4 text-[14px] text-[#0F172A] outline-none transition focus:border-theme-primary focus:shadow-[0_0_0_4px_rgba(0,111,214,0.10)] placeholder:text-slate-400"
                />
              </label>

              <fieldset>
                <legend className="mb-2 block text-[12px] font-semibold text-slate-600">
                  Category
                </legend>
                <div className="chip-row flex gap-2 overflow-x-auto pb-1">
                  {CATEGORY_PRESETS.map((cat) => {
                    const active = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`min-h-[44px] shrink-0 rounded-full border px-4 text-xs transition cursor-pointer ${
                          active
                            ? 'border-theme-primary bg-theme-primary font-semibold text-white'
                            : 'border-slate-200 bg-white font-medium text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <div>
                  <p className="text-[13px] font-semibold text-[#0F172A]">Publish nominee</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Make visible to voters immediately
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={publishImmediately}
                  aria-label="Toggle publish state"
                  onClick={() => setPublishImmediately((prev) => !prev)}
                  className={`relative h-7 w-12 rounded-full transition cursor-pointer ${
                    publishImmediately ? 'bg-theme-primary' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                      publishImmediately ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </form>
          </section>
        </main>

        {/* Sticky Bottom Footer Save CTA */}
        <footer className="absolute inset-x-0 bottom-0 z-20 bg-[#F8FAFC]/95 backdrop-blur-md border-t border-slate-200/60 px-6 pb-6 sm:pb-6 pt-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSaveNominee()}
            className="min-h-[54px] w-full rounded-full bg-theme-primary hover:bg-theme-dark text-[15px] font-semibold text-white shadow-[0_7px_16px_rgba(0,111,214,0.22)] transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Saving Nominee...' : 'Save Nominee'}
          </button>
        </footer>

        {/* Bottom Pill Toast */}
        {toastMsg && (
          <div
            role="status"
            className={`pointer-events-none absolute bottom-24 left-1/2 z-30 -translate-x-1/2 flex items-center gap-2 rounded-full px-4 py-3 text-[13px] font-semibold text-white shadow-xl animate-fade-up whitespace-nowrap ${
              toastError ? 'bg-rose-600' : 'bg-[#0F172A]'
            }`}
          >
            {toastError ? (
              <AlertCircle className="w-4 h-4 text-rose-200 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-theme-accent shrink-0" />
            )}
            <span>{toastMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
