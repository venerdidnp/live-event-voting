'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { CandidateMedia } from '@/components/CandidateMedia';
import {
  Trophy,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Copy,
  Check,
  Tv,
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
  const [subMode, setSubMode] = useState<'qr' | 'reveal'>('qr');
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);

  // App URL for QR Code
  const [appUrl, setAppUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Countdown Timer state
  const [timerPresetMinutes, setTimerPresetMinutes] = useState(5);
  const [timerSeconds, setTimerSeconds] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reveal Curtain State
  const [isRevealed, setIsRevealed] = useState(false);

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

  // 2. Fetch Settings and Live Results
  const fetchProjectorData = async () => {
    try {
      const [settRes, resRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/results'),
      ]);

      if (settRes.ok) {
        const settData = await settRes.json();
        setSettings(settData.settings);
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
  }, [authenticated]);

  // Countdown Timer logic
  const toggleTimer = () => {
    if (timerRunning) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setTimerRunning(false);
    } else {
      if (timerSeconds <= 0) setTimerSeconds(timerPresetMinutes * 60);
      setTimerRunning(true);
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev > 1) return prev - 1;
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          setTimerRunning(false);
          return 0;
        });
      }, 1000);
    }
  };

  const resetTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setTimerRunning(false);
    setTimerSeconds(timerPresetMinutes * 60);
  };

  const handleSetTimerPreset = (mins: number) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setTimerRunning(false);
    setTimerPresetMinutes(mins);
    setTimerSeconds(mins * 60);
  };

  const formatTimerString = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Winner Reveal Trigger with Confetti
  const triggerReveal = () => {
    setIsRevealed(true);

    // Fire canvas-confetti burst
    try {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#006FD6', '#33A8FF', '#FBBF24', '#34D399', '#FFFFFF'],
      });
      setTimeout(() => {
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 70,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 70,
          origin: { x: 1 },
        });
      }, 350);
    } catch (e) {
      console.warn('Confetti effect error:', e);
    }
  };

  const resetReveal = () => {
    setIsRevealed(false);
  };

  const copyLink = () => {
    if (!appUrl) return;
    navigator.clipboard.writeText(appUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
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
  const status = settings?.status || 'WAITING';
  const requirePin = settings?.require_pin ?? true;
  const pinDisplay = settings?.room_pin || '2026';

  // Sorted candidates for Top 3
  const sorted = [...candidates].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const top3 = sorted.slice(0, 3);
  const activeCount = candidates.filter((c) => c.is_active).length;

  return (
    <div className="min-h-screen stage-backdrop text-white flex flex-col select-none overflow-x-hidden">
      {/* Top Header Bar */}
      <header className="relative z-30 max-w-7xl w-full mx-auto px-5 sm:px-8 pt-5 pb-3 flex flex-wrap items-center justify-between gap-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center font-extrabold text-base shadow-lg">
            <Tv className="w-6 h-6 text-blue-200" />
          </div>
          <div>
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-blue-200">
              {organizer}
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-tight">
              {title} <span className="text-blue-200 font-semibold">— {subtitle}</span>
            </h1>
          </div>
        </div>

        {/* Sub-Mode Switcher */}
        <div className="flex items-center bg-black/35 backdrop-blur-md p-1.5 rounded-2xl border border-white/15">
          <button
            type="button"
            onClick={() => setSubMode('qr')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
              subMode === 'qr'
                ? 'bg-white text-slate-900 shadow'
                : 'text-blue-100 hover:bg-white/10'
            }`}
          >
            QR & Timer
          </button>
          <button
            type="button"
            onClick={() => setSubMode('reveal')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
              subMode === 'reveal'
                ? 'bg-white text-slate-900 shadow'
                : 'text-blue-100 hover:bg-white/10'
            }`}
          >
            Reveal Winners
          </button>
        </div>
      </header>

      {/* SUB-MODE A: QR & COUNTDOWN TIMER */}
      {subMode === 'qr' && (
        <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-5 sm:px-8 py-8 flex items-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full">
            {/* Left Column: Big Crisp Vector QR Card */}
            <div className="lg:col-span-6 flex flex-col items-center">
              <div className="bg-white text-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl shadow-black/50 border-4 border-white/80 w-full max-w-md flex flex-col items-center">
                <span className="px-4 py-1.5 rounded-full bg-theme-soft text-theme-primary text-xs font-extrabold uppercase tracking-wider mb-4 shadow-sm">
                  Scan QR Code to Vote
                </span>

                {/* Real SVG QR Code */}
                <div className="w-64 h-64 sm:w-72 sm:h-72 p-3.5 rounded-2xl border-2 border-slate-100 bg-white flex items-center justify-center shadow-inner">
                  {appUrl ? (
                    <QRCodeSVG
                      value={appUrl}
                      size={260}
                      level="H"
                      includeMargin={false}
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100 animate-pulse rounded-xl" />
                  )}
                </div>

                {/* Shortlink and Copy Button */}
                <div className="mt-4 w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200">
                  <span className="text-xs sm:text-sm font-mono font-bold text-slate-800 truncate">
                    {appUrl.replace(/^https?:\/\//, '')}
                  </span>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-[11px] font-bold text-theme-primary shrink-0 cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Status, Timer, Room PIN & Live Votes Counter */}
            <div className="lg:col-span-6 space-y-6">
              {/* Status Dot */}
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/15 backdrop-blur-md border border-white/25">
                <span
                  className={`w-3 h-3 rounded-full ${
                    status === 'OPEN'
                      ? 'bg-emerald-400 animate-pulse'
                      : status === 'WAITING'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider">
                  {status === 'OPEN'
                    ? 'Voting Session is Live'
                    : status === 'WAITING'
                    ? 'Waiting for Announcement'
                    : 'Voting Session Closed'}
                </span>
              </div>

              {/* Countdown Timer Card */}
              <div className="rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 p-6 sm:p-7 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">
                    Stage Countdown Timer
                  </p>
                  <div className="flex items-center gap-1.5">
                    {[3, 5, 10].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleSetTimerPreset(m)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          timerPresetMinutes === m
                            ? 'bg-white text-slate-900 shadow'
                            : 'bg-white/15 hover:bg-white/25 text-white'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-6xl sm:text-7xl font-extrabold font-mono tracking-tight leading-none my-3">
                  {formatTimerString(timerSeconds)}
                </div>

                <div className="flex flex-wrap items-center gap-2.5 mt-5">
                  <button
                    type="button"
                    onClick={toggleTimer}
                    className="px-5 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-blue-50 font-extrabold text-xs sm:text-sm shadow-lg transition cursor-pointer flex items-center gap-2"
                  >
                    {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{timerRunning ? 'Pause Timer' : 'Start Timer'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={resetTimer}
                    className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 font-bold text-xs sm:text-sm transition cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* PIN & Live Total Counter Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Room PIN */}
                <div className="rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-200 mb-2">
                    Room PIN
                  </p>
                  {requirePin ? (
                    <>
                      <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-[0.25em] text-white">
                        {pinDisplay.split('').join(' ')}
                      </div>
                      <p className="text-xs text-blue-100/80 mt-1.5">
                        Type 4-digit PIN after scanning QR
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300">
                        DIRECT VOTE
                      </div>
                      <p className="text-xs text-blue-100/80 mt-1.5">No PIN required tonight</p>
                    </>
                  )}
                </div>

                {/* Live Total Votes */}
                <div className="rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 p-5 flex flex-col justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-200 mb-2">
                    Live Votes Cast
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-extrabold text-white">
                      {totalVotes.toLocaleString()}
                    </span>
                    <span className="text-sm font-semibold text-blue-200">votes</span>
                  </div>
                  <p className="text-xs text-emerald-300 font-semibold mt-1.5">
                    {activeCount} active nominees live
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* SUB-MODE B: WINNER REVEAL (Curtains + Top 3 Podium + Confetti) */}
      {subMode === 'reveal' && (
        <main className="relative flex-1 overflow-hidden">
          {/* Animated Curtains */}
          <div
            className={`relative w-full h-full min-h-[78vh] flex flex-col ${
              isRevealed ? 'curtain-open' : ''
            }`}
          >
            <div className="curtain-panel curtain-left" />
            <div className="curtain-panel curtain-right" />

            {/* Pre-Reveal Prompt Overlay (Before MC counts down) */}
            {!isRevealed && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center px-6 transition-opacity duration-500">
                <div className="max-w-xl bg-slate-950/60 backdrop-blur-xl border border-white/25 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl animate-fade-up">
                  <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-amber-300 shadow-inner">
                    <Trophy className="w-8 h-8" />
                  </div>
                  <span className="inline-block px-3.5 py-1 rounded-full bg-amber-400/20 border border-amber-300/35 text-amber-200 text-xs font-bold uppercase tracking-widest mb-3">
                    Results Hidden Behind Curtains
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-3">
                    {title} Winner Announcement
                  </h2>
                  <p className="text-sm text-blue-100/85 mb-7 leading-relaxed">
                    Click the button below after the countdown to part the curtains and reveal the Top 3 winners on the big screen!
                  </p>
                  <button
                    type="button"
                    onClick={triggerReveal}
                    className="px-8 py-4 rounded-2xl bg-white text-slate-900 hover:bg-blue-50 font-extrabold text-base shadow-2xl shadow-black/40 transition transform hover:scale-[1.03] active:scale-[0.98] cursor-pointer flex items-center gap-2 mx-auto"
                  >
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <span>Open Curtains & Reveal Winners!</span>
                  </button>
                </div>
              </div>
            )}

            {/* Revealed Top 3 Podium and Breakdown Content */}
            <div className="relative z-10 max-w-6xl w-full mx-auto px-5 sm:px-8 py-6 flex-1 flex flex-col justify-between">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.2em] text-amber-300">
                    ★ Official Award Winners
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5">
                    {title} Champions
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={resetReveal}
                  className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-bold text-white transition cursor-pointer"
                >
                  ↺ Close Curtains / Re-Reveal
                </button>
              </div>

              {/* Top 3 Podium Cards */}
              {top3.length === 0 ? (
                <div className="col-span-3 text-center py-12 text-blue-100/80 text-sm">
                  No nominees registered yet to announce.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 items-end mb-7">
                  {/* #2 Runner Up (Left) */}
                  {top3[1] ? (
                    <div className="md:order-1 md:pb-3 transition-all duration-700">
                      <div className="rounded-3xl bg-white/12 backdrop-blur-xl border-2 border-slate-300/60 p-5 text-center shadow-2xl">
                        <span className="inline-block px-3.5 py-1 rounded-full bg-slate-200 text-slate-900 text-xs font-extrabold uppercase tracking-wider mb-3.5 shadow">
                          🥈 2nd Place
                        </span>
                        <div className="w-20 aspect-[4/5] mx-auto rounded-2xl overflow-hidden border-2 border-white/70 shadow-lg mb-3 bg-slate-900">
                          <CandidateMedia
                            photoData={top3[1].photo_data}
                            name={top3[1].name}
                            number={top3[1].number}
                          />
                        </div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                          No. {String(top3[1].number).padStart(2, '0')} • {top3[1].category}
                        </p>
                        <h4 className="text-lg font-extrabold text-white mt-0.5 truncate">
                          {top3[1].name}
                        </h4>
                        {top3[1].costume_theme && (
                          <p className="text-xs text-blue-100/80 truncate mt-0.5">
                            {top3[1].costume_theme}
                          </p>
                        )}
                        <div className="mt-3 inline-flex items-baseline gap-1.5 px-4 py-1.5 rounded-xl bg-black/25 border border-white/15">
                          <span className="text-xl font-extrabold text-white">
                            {top3[1].votes || 0}
                          </span>
                          <span className="text-xs font-semibold text-blue-200">
                            votes (
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

                  {/* #1 Winner (Center, Elevated) */}
                  {top3[0] && (
                    <div className="md:order-2 md:-translate-y-4 transition-all duration-700">
                      <div className="rounded-3xl bg-white/15 backdrop-blur-2xl border-2 border-amber-300 shadow-2xl shadow-amber-400/20 p-6 text-center">
                        <span className="inline-block px-4 py-1.5 rounded-full bg-amber-400 text-slate-950 text-xs font-extrabold uppercase tracking-wider mb-3.5 shadow-lg">
                          👑 Best Choice #1 Winner
                        </span>
                        <div className="w-28 aspect-[4/5] mx-auto rounded-2xl overflow-hidden border-3 border-amber-300 shadow-2xl mb-3 bg-slate-900">
                          <CandidateMedia
                            photoData={top3[0].photo_data}
                            name={top3[0].name}
                            number={top3[0].number}
                          />
                        </div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200">
                          No. {String(top3[0].number).padStart(2, '0')} • {top3[0].category}
                        </p>
                        <h3 className="text-2xl font-extrabold text-white mt-0.5 truncate">
                          {top3[0].name}
                        </h3>
                        {top3[0].costume_theme && (
                          <p className="text-sm font-semibold text-blue-100/90 truncate mt-0.5">
                            {top3[0].costume_theme}
                          </p>
                        )}
                        <div className="mt-3.5 inline-flex items-baseline gap-2 px-5 py-2 rounded-2xl bg-black/35 border border-amber-400/40">
                          <span className="text-2xl sm:text-3xl font-extrabold text-amber-300">
                            {top3[0].votes || 0}
                          </span>
                          <span className="text-xs font-semibold text-blue-200">
                            votes (
                            {totalVotes > 0
                              ? Math.round(((top3[0].votes || 0) / totalVotes) * 1000) / 10
                              : 0}
                            %)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* #3 2nd Runner Up (Right) */}
                  {top3[2] ? (
                    <div className="md:order-3 md:pb-0 transition-all duration-700">
                      <div className="rounded-3xl bg-white/12 backdrop-blur-xl border-2 border-orange-300/60 p-5 text-center shadow-2xl">
                        <span className="inline-block px-3.5 py-1 rounded-full bg-orange-300 text-slate-950 text-xs font-extrabold uppercase tracking-wider mb-3.5 shadow">
                          🥉 3rd Place
                        </span>
                        <div className="w-20 aspect-[4/5] mx-auto rounded-2xl overflow-hidden border-2 border-white/70 shadow-lg mb-3 bg-slate-900">
                          <CandidateMedia
                            photoData={top3[2].photo_data}
                            name={top3[2].name}
                            number={top3[2].number}
                          />
                        </div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                          No. {String(top3[2].number).padStart(2, '0')} • {top3[2].category}
                        </p>
                        <h4 className="text-lg font-extrabold text-white mt-0.5 truncate">
                          {top3[2].name}
                        </h4>
                        {top3[2].costume_theme && (
                          <p className="text-xs text-blue-100/80 truncate mt-0.5">
                            {top3[2].costume_theme}
                          </p>
                        )}
                        <div className="mt-3 inline-flex items-baseline gap-1.5 px-4 py-1.5 rounded-xl bg-black/25 border border-white/15">
                          <span className="text-xl font-extrabold text-white">
                            {top3[2].votes || 0}
                          </span>
                          <span className="text-xs font-semibold text-blue-200">
                            votes (
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
              <div className="rounded-3xl bg-slate-950/40 backdrop-blur-xl border border-white/15 p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-200">
                    Complete Vote Breakdown
                  </p>
                  <p className="text-xs font-bold text-white bg-white/15 px-3 py-1 rounded-full">
                    Total: {totalVotes.toLocaleString()} Votes
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                  {sorted.map((c, idx) => {
                    const votes = c.votes || 0;
                    const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 1000) / 10 : 0;
                    return (
                      <div key={c.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-white truncate pr-2">
                            <span className="text-blue-300 mr-1.5">#{idx + 1}</span>
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
                                'linear-gradient(90deg, var(--color-accent), #ffffff)',
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
