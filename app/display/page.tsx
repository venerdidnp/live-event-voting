'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { CandidateMedia } from '@/components/CandidateMedia';
import {
  Trophy,
  Sparkles,
  Copy,
  Check,
  Tv,
  Clock,
  Maximize,
  Minimize,
  Users,
} from 'lucide-react';

interface Candidate {
  id: number;
  number: number;
  name: string;
  category: string;
  costume_theme: string | null;
  photo_data: string;
  is_active: boolean;
  votes?: number;
}

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

export default function ProjectorDisplayPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);

  // Manual override for operator preview (null means auto-follow settings.status)
  const [manualMode, setManualMode] = useState<'WAITING' | 'OPEN' | 'CLOSED' | null>(null);

  // App URL for QR Code
  const [appUrl, setAppUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Synchronized countdown timer state
  const [timerSeconds, setTimerSeconds] = useState<number>(0);

  // Winner Reveal Curtain state
  const [isRevealed, setIsRevealed] = useState(false);
  const previousStatusRef = useRef<string | null>(null);

  // 1. Verify Admin Authentication
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

  // Set App URL for QR code
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const envUrl = process.env.NEXT_PUBLIC_APP_URL;
      setAppUrl(envUrl || origin);
    }
  }, []);

  // Winner Reveal Trigger with Confetti Celebration
  const triggerReveal = () => {
    setIsRevealed(true);

    try {
      // Wave 1: Center blast
      confetti({
        particleCount: 140,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#006FD6', '#33A8FF', '#FBBF24', '#34D399', '#FFFFFF', '#EC4899'],
      });

      // Wave 2: Left and right bursts
      setTimeout(() => {
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 75,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 75,
          origin: { x: 1 },
        });
      }, 400);

      // Wave 3: Grand shower
      setTimeout(() => {
        confetti({
          particleCount: 110,
          spread: 120,
          origin: { y: 0.4 },
        });
      }, 900);
    } catch (e) {
      console.warn('Confetti effect error:', e);
    }
  };

  // 2. Fetch Settings and Live Results
  const fetchProjectorData = async () => {
    try {
      const [settRes, resRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/results'),
      ]);

      if (settRes.ok) {
        const settData = await settRes.json();
        const newSettings: EventSettings = settData.settings;
        setSettings(newSettings);

        // Check for transition to CLOSED -> automatically fire confetti & open curtains
        if (
          previousStatusRef.current &&
          previousStatusRef.current !== 'CLOSED' &&
          newSettings.status === 'CLOSED'
        ) {
          triggerReveal();
        } else if (newSettings.status === 'CLOSED' && !isRevealed) {
          setIsRevealed(true);
        }
        previousStatusRef.current = newSettings.status;
      }

      if (resRes.ok) {
        const resData = await resRes.json();
        setCandidates(resData.candidates || []);
        setTotalVotes(resData.total_votes || 0);
      }
    } catch (err) {
      console.error('Error fetching projector data:', err);
    }
  };

  useEffect(() => {
    if (authenticated) {
      fetchProjectorData();
      // Auto-poll every 3 seconds for live projector sync
      const interval = setInterval(fetchProjectorData, 3000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  // 3. Countdown Timer Sync from settings.ends_at
  useEffect(() => {
    if (settings?.status === 'OPEN' && settings.ends_at) {
      const updateTimer = () => {
        const end = new Date(settings.ends_at!).getTime();
        const diff = Math.max(0, Math.floor((end - Date.now()) / 1000));
        setTimerSeconds(diff);
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setTimerSeconds(0);
    }
  }, [settings?.status, settings?.ends_at]);

  const formatTimerString = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const copyLink = () => {
    if (!appUrl) return;
    navigator.clipboard.writeText(appUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const title = settings?.event_title || 'Live Event Voting';
  const subtitle = settings?.event_subtitle || 'Audience Choice Award';
  const organizer = settings?.organizer_label || 'Event Committee';
  const rawStatus = settings?.status || 'WAITING';
  const activeMode = manualMode || rawStatus;
  const requirePin = settings?.require_pin ?? true;
  const pinDisplay = settings?.room_pin || '2026';

  // Sorted candidates for Top 3 & Leaderboard
  const sorted = [...candidates].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const top3 = sorted.slice(0, 3);
  const activeCount = candidates.filter((c) => c.is_active).length;

  return (
    <div className="min-h-screen stage-backdrop text-white flex flex-col select-none overflow-x-hidden">
      {/* Top Header Bar */}
      <header className="relative z-30 max-w-7xl w-full mx-auto px-5 sm:px-8 pt-5 pb-3 flex flex-wrap items-center justify-between gap-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center font-extrabold text-base shadow-lg">
            <Tv className="w-5 h-5 text-blue-200" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-blue-200">
              {organizer}
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-tight">
              {title} <span className="text-blue-200 font-semibold">— {subtitle}</span>
            </h1>
          </div>
        </div>

        {/* Status Indicator & Stage Controls */}
        <div className="flex items-center gap-2">
          {/* Active Mode Pill */}
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-bold">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                activeMode === 'OPEN'
                  ? 'bg-emerald-400 animate-pulse'
                  : activeMode === 'WAITING'
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
              }`}
            />
            <span className="uppercase tracking-wider">
              {activeMode === 'OPEN'
                ? 'Live Voting'
                : activeMode === 'WAITING'
                ? 'Mode Menunggu (QR)'
                : 'Pemenang (Closed)'}
            </span>
            {manualMode && (
              <span className="text-[10px] text-amber-300 font-extrabold">(Preview)</span>
            )}
          </div>

          {/* Quick Screen Mode Switcher */}
          <div className="flex items-center bg-black/40 backdrop-blur-md p-1 rounded-xl border border-white/15 text-xs font-bold">
            <button
              type="button"
              onClick={() => setManualMode(null)}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                manualMode === null
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Otomatis sinkron dengan Admin"
            >
              Auto Sync
            </button>
            <button
              type="button"
              onClick={() => setManualMode('WAITING')}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                manualMode === 'WAITING'
                  ? 'bg-white text-slate-900 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Paksa tampilkan QR Code"
            >
              QR Stage
            </button>
            <button
              type="button"
              onClick={() => setManualMode('OPEN')}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                manualMode === 'OPEN'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Paksa tampilkan Live Voting"
            >
              Live Votes
            </button>
            <button
              type="button"
              onClick={() => {
                setManualMode('CLOSED');
                setIsRevealed(true);
              }}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                manualMode === 'CLOSED'
                  ? 'bg-amber-500 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Paksa tampilkan Podium Pemenang"
            >
              Podium
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition cursor-pointer"
            title="Toggle Fullscreen Layar Panggung"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 1. STAGE VIEW: WAITING (QR CODE ONLY - CLEAN & MASSIVE)    */}
      {/* ========================================================= */}
      {activeMode === 'WAITING' && (
        <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-5 sm:px-8 py-8 flex items-center justify-center animate-fade-up">
          <div className="w-full max-w-2xl flex flex-col items-center text-center">
            {/* Top Stage Notice */}
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/15 backdrop-blur-md border border-white/25 mb-6 shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-amber-200">
                ⏳ Voting Belum Dibuka — Silakan Siapkan HP & Scan QR
              </span>
            </div>

            {/* Giant Stage QR Code Card */}
            <div className="bg-white text-slate-900 rounded-[3rem] p-7 sm:p-10 shadow-2xl shadow-black/60 border-4 border-white/90 w-full max-w-lg flex flex-col items-center">
              <span className="px-5 py-1.5 rounded-full bg-theme-soft text-theme-primary text-xs font-black uppercase tracking-wider mb-5 shadow-sm">
                Scan QR Code untuk Memilih
              </span>

              {/* Massive Crisp SVG QR Code */}
              <div className="w-72 h-72 sm:w-80 sm:h-80 p-3.5 rounded-3xl border-2 border-slate-100 bg-white flex items-center justify-center shadow-inner">
                {appUrl ? (
                  <QRCodeSVG
                    value={appUrl}
                    size={300}
                    level="H"
                    includeMargin={false}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 animate-pulse rounded-2xl" />
                )}
              </div>

              {/* Shortlink and Copy Button */}
              <div className="mt-5 w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 border border-slate-200">
                <span className="text-xs sm:text-sm font-mono font-extrabold text-slate-800 truncate">
                  {appUrl.replace(/^https?:\/\//, '')}
                </span>
                <button
                  type="button"
                  onClick={copyLink}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-theme-primary shrink-0 cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>

              {/* Room PIN Card */}
              {requirePin ? (
                <div className="mt-4 w-full p-3.5 rounded-2xl bg-theme-soft border border-blue-200/60 text-center">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-theme-primary mb-1">
                    PIN RUANGAN UNTUK MEMILIH
                  </p>
                  <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-[0.3em] text-slate-900">
                    {pinDisplay.split('').join(' ')}
                  </div>
                </div>
              ) : (
                <div className="mt-4 w-full p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                  <p className="text-xs font-bold text-emerald-800">
                    Direct Vote: Tidak memerlukan PIN
                  </p>
                </div>
              )}
            </div>

            {/* Candidates Ready Footer */}
            <p className="text-xs sm:text-sm text-blue-100/85 mt-6 font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-300" />
              <span>{activeCount} Kandidat Siap Dipilih • Voting akan segera dimulai oleh MC</span>
            </p>
          </div>
        </main>
      )}

      {/* ========================================================= */}
      {/* 2. STAGE VIEW: OPEN (LIVE VOTING + COUNTDOWN + LIVE BARS)   */}
      {/* ========================================================= */}
      {activeMode === 'OPEN' && (
        <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-5 sm:px-8 py-6 sm:py-10 flex flex-col justify-center gap-6 animate-fade-up">
          {/* Top Banner: Countdown Timer & Live Votes Counter */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
            {/* Countdown Timer Display */}
            <div className="md:col-span-6 rounded-3xl bg-white/15 backdrop-blur-xl border border-white/25 p-5 sm:p-6 shadow-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shadow-inner">
                  <Clock className="w-7 h-7 text-amber-300" />
                </div>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-widest text-blue-200">
                    Sisa Waktu Voting
                  </p>
                  <div
                    className={`text-4xl sm:text-5xl font-extrabold font-mono tracking-tight leading-none mt-1.5 ${
                      timerSeconds <= 30 && timerSeconds > 0
                        ? 'text-rose-400 animate-pulse'
                        : 'text-white'
                    }`}
                  >
                    {formatTimerString(timerSeconds)}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-400/25 border border-emerald-300/40 text-emerald-200 text-xs font-extrabold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Live Voting
                </span>
                <p className="text-[11px] text-blue-200/80 mt-2">
                  Layar otomatis refresh
                </p>
              </div>
            </div>

            {/* Total Votes Counter */}
            <div className="md:col-span-6 rounded-3xl bg-white/15 backdrop-blur-xl border border-white/25 p-5 sm:p-6 shadow-2xl flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-blue-200">
                  Total Suara Masuk
                </p>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-4xl sm:text-5xl font-extrabold text-white">
                    {totalVotes.toLocaleString()}
                  </span>
                  <span className="text-sm font-semibold text-blue-200">suara</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-emerald-300 font-extrabold">
                  {activeCount} Kandidat
                </span>
                <p className="text-[11px] text-blue-200/80 mt-1.5">
                  1 Suara per Perangkat
                </p>
              </div>
            </div>
          </div>

          {/* Main Content Area: Side QR Code + Live Vote Leaderboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Side Column: Compact QR Code for latecomers */}
            <div className="lg:col-span-4 flex flex-col">
              <div className="bg-white text-slate-900 rounded-[2.5rem] p-6 sm:p-7 shadow-2xl border-4 border-white/80 w-full h-full flex flex-col items-center justify-center">
                <span className="px-4 py-1.5 rounded-full bg-theme-soft text-theme-primary text-xs font-black uppercase tracking-wider mb-4 shadow-sm">
                  Scan untuk Ikut Memilih
                </span>

                <div className="w-52 h-52 sm:w-60 sm:h-60 p-3 rounded-2xl border-2 border-slate-100 bg-white flex items-center justify-center shadow-inner">
                  {appUrl ? (
                    <QRCodeSVG
                      value={appUrl}
                      size={230}
                      level="H"
                      includeMargin={false}
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100 animate-pulse rounded-xl" />
                  )}
                </div>

                {requirePin && (
                  <div className="mt-4 w-full py-2.5 px-4 rounded-2xl bg-slate-100 border border-slate-200 text-center">
                    <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                      PIN RUANGAN
                    </span>
                    <div className="text-2xl font-black font-mono tracking-[0.25em] text-slate-900 mt-0.5">
                      {pinDisplay.split('').join(' ')}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Main Column: Live Nominees & Incoming Vote Distribution */}
            <div className="lg:col-span-8 rounded-[2.5rem] bg-slate-950/45 backdrop-blur-xl border border-white/20 p-6 sm:p-7 shadow-2xl flex flex-col justify-between min-h-[440px]">
              <div>
                <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-white/10">
                  <h3 className="text-sm font-extrabold uppercase tracking-widest text-blue-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Pergerakan Suara Masuk Real-Time</span>
                  </h3>
                  <span className="text-xs font-bold text-emerald-300 animate-pulse">
                    ● Live Updates
                  </span>
                </div>

                {/* Candidate list with live bars */}
                {candidates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-16 px-4">
                    <div className="w-16 h-16 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center text-blue-300 mb-4 shadow-inner">
                      <Users className="w-8 h-8" />
                    </div>
                    <h4 className="text-base font-extrabold text-white">Menunggu Kandidat</h4>
                    <p className="text-xs text-blue-200/80 max-w-sm mt-1.5 leading-relaxed">
                      Belum ada kandidat aktif yang terdaftar untuk sesi ini. Tambahkan kandidat melalui dashboard Admin untuk melihat grafik voting secara langsung.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {candidates.map((c) => {
                      const votes = c.votes || 0;
                      const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 1000) / 10 : 0;
                      return (
                        <div
                          key={c.id}
                          className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 transition-all hover:bg-white/15"
                        >
                          <div className="flex items-center gap-3">
                            {/* Candidate Photo thumbnail */}
                            <div className="w-12 h-14 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-white/30">
                              <CandidateMedia
                                photoData={c.photo_data}
                                name={c.name}
                                number={c.number}
                              />
                            </div>

                            {/* Candidate info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2 truncate">
                                  <span className="px-2 py-0.5 rounded-lg bg-white/20 text-blue-100 font-mono text-xs font-black">
                                    No. {String(c.number).padStart(2, '0')}
                                  </span>
                                  <h4 className="text-sm sm:text-base font-extrabold text-white truncate">
                                    {c.name}
                                  </h4>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-sm sm:text-base font-extrabold text-white">
                                    {votes}
                                  </span>
                                  <span className="text-xs text-blue-200 ml-1">({pct}%)</span>
                                </div>
                              </div>

                              {c.costume_theme && (
                                <p className="text-[11px] text-blue-100/70 truncate mb-2">
                                  {c.costume_theme}
                                </p>
                              )}

                              {/* Live Animated Progress Bar */}
                              <div className="w-full h-2.5 rounded-full bg-black/30 overflow-hidden border border-white/10">
                                <div
                                  className="h-full rounded-full transition-all duration-700 ease-out"
                                  style={{
                                    width: `${Math.max(pct, votes > 0 ? 3 : 0)}%`,
                                    background:
                                      'linear-gradient(90deg, #006FD6 0%, #38BDF8 60%, #FFFFFF 100%)',
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================= */}
      {/* 3. STAGE VIEW: CLOSED (WINNER REVEAL & PODIUM CELEBRATION) */}
      {/* ========================================================= */}
      {activeMode === 'CLOSED' && (
        <main className="relative flex-1 overflow-hidden">
          {/* Animated Curtains Container */}
          <div
            className={`relative w-full h-full min-h-[82vh] flex flex-col ${
              isRevealed ? 'curtain-open' : ''
            }`}
          >
            <div className="curtain-panel curtain-left" />
            <div className="curtain-panel curtain-right" />

            {/* Revealed Top 3 Podium and Breakdown Content */}
            <div className="relative z-10 max-w-6xl w-full mx-auto px-5 sm:px-8 py-6 sm:py-8 flex-1 flex flex-col justify-center animate-fade-up">
              {/* Header Title & Confetti re-trigger */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.2em] text-amber-300">
                    ★ Hasil Resmi Pemilihan Suara Terbanyak
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5">
                    Pengumuman Pemenang {subtitle}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={triggerReveal}
                    className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition shadow-lg flex items-center gap-1.5 cursor-pointer transform hover:scale-105 active:scale-95"
                  >
                    <Sparkles className="w-4 h-4 fill-current" />
                    <span>🎉 Rayakan Lagi (Confetti)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRevealed(!isRevealed)}
                    className="px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-bold text-white transition cursor-pointer"
                  >
                    {isRevealed ? 'Tutup Tirai' : 'Buka Tirai'}
                  </button>
                </div>
              </div>

              {/* Top 3 Podium Cards */}
              {top3.length === 0 ? (
                <div className="col-span-3 text-center py-12 text-blue-100/80 text-sm">
                  Belum ada kandidat yang terdaftar untuk diumumkan.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-end mb-7">
                  {/* #2 Runner Up (Left Podium) */}
                  {top3[1] ? (
                    <div className="md:order-1 md:pb-3 transition-all duration-700">
                      <div className="rounded-3xl bg-white/15 backdrop-blur-xl border-2 border-slate-300/70 p-5 text-center shadow-2xl">
                        <span className="inline-block px-4 py-1 rounded-full bg-slate-200 text-slate-900 text-xs font-black uppercase tracking-wider mb-3.5 shadow">
                          🥈 Juara 2 (2nd Place)
                        </span>
                        <div className="w-24 aspect-[4/5] mx-auto rounded-2xl overflow-hidden border-2 border-white/80 shadow-lg mb-3 bg-slate-900">
                          <CandidateMedia
                            photoData={top3[1].photo_data}
                            name={top3[1].name}
                            number={top3[1].number}
                          />
                        </div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                          No. {String(top3[1].number).padStart(2, '0')} • {top3[1].category}
                        </p>
                        <h4 className="text-xl font-extrabold text-white mt-0.5 truncate">
                          {top3[1].name}
                        </h4>
                        {top3[1].costume_theme && (
                          <p className="text-xs text-blue-100/80 truncate mt-0.5">
                            {top3[1].costume_theme}
                          </p>
                        )}
                        <div className="mt-3.5 inline-flex items-baseline gap-1.5 px-4 py-1.5 rounded-xl bg-black/30 border border-white/20">
                          <span className="text-2xl font-extrabold text-white">
                            {top3[1].votes || 0}
                          </span>
                          <span className="text-xs font-semibold text-blue-200">
                            suara (
                            {totalVotes > 0
                              ? Math.round(((top3[1].votes || 0) / totalVotes) * 1000) / 10
                              : 0}
                            %)
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="hidden md:block md:order-1" />
                  )}

                  {/* #1 Winner (Center Podium, Elevated with Gold Crown) */}
                  {top3[0] && (
                    <div className="md:order-2 md:-translate-y-5 transition-all duration-700">
                      <div className="rounded-3xl bg-gradient-to-b from-amber-500/20 to-amber-900/40 backdrop-blur-2xl border-3 border-amber-300 shadow-2xl shadow-amber-400/30 p-6 sm:p-7 text-center relative overflow-hidden">
                        {/* Glowing Background aura */}
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-400/25 blur-3xl rounded-full pointer-events-none" />

                        <span className="relative z-10 inline-block px-5 py-1.5 rounded-full bg-amber-400 text-slate-950 text-xs sm:text-sm font-black uppercase tracking-wider mb-4 shadow-xl">
                          👑 JUARA 1 (BEST CHOICE)
                        </span>

                        <div className="relative z-10 w-32 aspect-[4/5] mx-auto rounded-2xl overflow-hidden border-4 border-amber-300 shadow-2xl mb-3 bg-slate-900">
                          <CandidateMedia
                            photoData={top3[0].photo_data}
                            name={top3[0].name}
                            number={top3[0].number}
                          />
                        </div>

                        <p className="relative z-10 text-xs font-extrabold uppercase tracking-wider text-amber-200">
                          No. {String(top3[0].number).padStart(2, '0')} • {top3[0].category}
                        </p>
                        <h3 className="relative z-10 text-2xl sm:text-3xl font-black text-white mt-0.5 truncate">
                          {top3[0].name}
                        </h3>
                        {top3[0].costume_theme && (
                          <p className="relative z-10 text-sm font-semibold text-blue-100/90 truncate mt-0.5">
                            {top3[0].costume_theme}
                          </p>
                        )}
                        <div className="relative z-10 mt-4 inline-flex items-baseline gap-2 px-6 py-2.5 rounded-2xl bg-black/45 border border-amber-400/50 shadow-inner">
                          <span className="text-3xl sm:text-4xl font-black text-amber-300">
                            {top3[0].votes || 0}
                          </span>
                          <span className="text-sm font-bold text-amber-100">
                            suara (
                            {totalVotes > 0
                              ? Math.round(((top3[0].votes || 0) / totalVotes) * 1000) / 10
                              : 0}
                            %)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* #3 2nd Runner Up (Right Podium) */}
                  {top3[2] ? (
                    <div className="md:order-3 md:pb-0 transition-all duration-700">
                      <div className="rounded-3xl bg-white/15 backdrop-blur-xl border-2 border-amber-600/60 p-5 text-center shadow-2xl">
                        <span className="inline-block px-4 py-1 rounded-full bg-amber-600/80 text-white text-xs font-black uppercase tracking-wider mb-3.5 shadow">
                          🥉 Juara 3 (3rd Place)
                        </span>
                        <div className="w-24 aspect-[4/5] mx-auto rounded-2xl overflow-hidden border-2 border-white/80 shadow-lg mb-3 bg-slate-900">
                          <CandidateMedia
                            photoData={top3[2].photo_data}
                            name={top3[2].name}
                            number={top3[2].number}
                          />
                        </div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                          No. {String(top3[2].number).padStart(2, '0')} • {top3[2].category}
                        </p>
                        <h4 className="text-xl font-extrabold text-white mt-0.5 truncate">
                          {top3[2].name}
                        </h4>
                        {top3[2].costume_theme && (
                          <p className="text-xs text-blue-100/80 truncate mt-0.5">
                            {top3[2].costume_theme}
                          </p>
                        )}
                        <div className="mt-3.5 inline-flex items-baseline gap-1.5 px-4 py-1.5 rounded-xl bg-black/30 border border-white/20">
                          <span className="text-2xl font-extrabold text-white">
                            {top3[2].votes || 0}
                          </span>
                          <span className="text-xs font-semibold text-blue-200">
                            suara (
                            {totalVotes > 0
                              ? Math.round(((top3[2].votes || 0) / totalVotes) * 1000) / 10
                              : 0}
                            %)
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="hidden md:block md:order-3" />
                  )}
                </div>
              )}

              {/* Complete Breakdown of All Nominees */}
              <div className="rounded-3xl bg-slate-950/50 backdrop-blur-xl border border-white/15 p-5 sm:p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-200 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-300" />
                    <span>Klasemen Lengkap Perolehan Suara</span>
                  </p>
                  <p className="text-xs font-bold text-white bg-white/15 px-3.5 py-1 rounded-full">
                    Total: {totalVotes.toLocaleString()} Suara
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5">
                  {sorted.map((c, idx) => {
                    const votes = c.votes || 0;
                    const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 1000) / 10 : 0;
                    return (
                      <div key={c.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-white truncate pr-2">
                            <span className="text-blue-300 font-extrabold mr-1.5">#{idx + 1}</span>
                            No. {String(c.number).padStart(2, '0')} — {c.name}
                          </span>
                          <span className="font-extrabold text-blue-100 shrink-0">
                            {votes} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{
                              width: `${isRevealed ? Math.max(pct, votes > 0 ? 3 : 0) : 0}%`,
                              background:
                                idx === 0
                                  ? 'linear-gradient(90deg, #F59E0B, #FDE68A)'
                                  : idx === 1
                                  ? 'linear-gradient(90deg, #94A3B8, #F1F5F9)'
                                  : idx === 2
                                  ? 'linear-gradient(90deg, #D97706, #FDE68A)'
                                  : 'linear-gradient(90deg, var(--color-accent), #ffffff)',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
