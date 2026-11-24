'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { CandidateMedia } from '@/components/CandidateMedia';
import {
  Users,
  ScanLine,
  MonitorPlay,
  Sparkles,
  Maximize,
  Minimize,
  Check,
  X,
  Trophy,
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

const PODIUM_CONFETTI = [
  { left: '8%', drift: '80px', delay: '0.95s', colorClass: 'bg-theme-accent', sizeClass: 'h-3 w-2 rounded-sm' },
  { left: '17%', drift: '-45px', delay: '1.2s', colorClass: 'bg-white/80', sizeClass: 'h-2 w-3 rounded-sm' },
  { left: '28%', drift: '120px', delay: '1.1s', colorClass: 'bg-theme-muted-blue', sizeClass: 'h-3 w-2 rounded-sm' },
  { left: '39%', drift: '-90px', delay: '1.4s', colorClass: 'bg-theme-accent', sizeClass: 'h-2 w-2 rounded-full' },
  { left: '52%', drift: '70px', delay: '1.05s', colorClass: 'bg-white/75', sizeClass: 'h-3 w-2 rounded-sm' },
  { left: '64%', drift: '-130px', delay: '1.3s', colorClass: 'bg-theme-muted-blue', sizeClass: 'h-2 w-3 rounded-sm' },
  { left: '76%', drift: '55px', delay: '1.0s', colorClass: 'bg-theme-accent', sizeClass: 'h-3 w-2 rounded-sm' },
  { left: '89%', drift: '-75px', delay: '1.5s', colorClass: 'bg-white/70', sizeClass: 'h-2 w-2 rounded-full' },
];

export default function ProjectorDisplayPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);

  // Manual override for operator preview (null = automatically follow settings.status)
  const [manualMode, setManualMode] = useState<'WAITING' | 'OPEN' | 'CLOSED' | null>(null);

  // App URL for QR Code
  const [appUrl, setAppUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Synchronized countdown timer state
  const [timerSeconds, setTimerSeconds] = useState<number>(0);

  // Podium celebration & full standings drawer
  const [revealKey, setRevealKey] = useState(0);
  const [showStandingsModal, setShowStandingsModal] = useState(false);
  const previousStatusRef = useRef<string | null>(null);

  // Fire canvas-confetti celebration burst
  const triggerCelebration = () => {
    setRevealKey((k) => k + 1);
    try {
      confetti({
        particleCount: 140,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#006FD6', '#33A8FF', '#FBBF24', '#34D399', '#FFFFFF'],
      });
      setTimeout(() => {
        confetti({ particleCount: 80, angle: 60, spread: 75, origin: { x: 0 } });
        confetti({ particleCount: 80, angle: 120, spread: 75, origin: { x: 1 } });
      }, 380);
    } catch (e) {
      console.warn('Confetti effect error:', e);
    }
  };

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

  // 2. Set App URL for QR Code
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const envUrl = process.env.NEXT_PUBLIC_APP_URL;
      setAppUrl(envUrl || origin);
    }
  }, []);

  // 3. Fetch Settings and Live Results
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

        if (
          previousStatusRef.current &&
          previousStatusRef.current !== 'CLOSED' &&
          newSettings.status === 'CLOSED'
        ) {
          triggerCelebration();
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
      const interval = setInterval(fetchProjectorData, 3000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  // 4. Countdown Timer Sync from settings.ends_at
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
      setTimerSeconds((settings?.timer_minutes || 5) * 60);
    }
  }, [settings?.status, settings?.ends_at, settings?.timer_minutes]);

  const formatTimerString = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const copyLink = () => {
    if (!appUrl) return;
    navigator.clipboard?.writeText(appUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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
      <div className="min-h-screen bg-[#001B3A] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const title = settings?.event_title || 'Live Event Voting';
  const subtitle = settings?.event_subtitle || 'Audience Choice Award';
  const rawStatus = settings?.status || 'WAITING';
  const activeMode = manualMode || rawStatus;
  const requirePin = settings?.require_pin ?? true;
  const pinDisplay = settings?.room_pin || '2026';

  const sorted = [...candidates].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const top3 = sorted.slice(0, 3);
  const activeCount = candidates.filter((c) => c.is_active).length;

  const isPodiumView = activeMode === 'CLOSED';

  return (
    <>
      {/* =================================================================== */}
      {/* VIEW 1: QR & LIVE TIMER STAGE (WAITING & OPEN — Votes Hidden)       */}
      {/* =================================================================== */}
      {!isPodiumView && (
        <div className="relative min-h-screen overflow-hidden bg-[#001B3A] font-[family-name:var(--font-inter)] text-white select-none">
          {/* Layered Deep Blue Stage Gradients */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_50%,rgba(0,111,214,0.28),transparent_52%),linear-gradient(105deg,#001B3A_0%,#003E85_45%,#001B3A_100%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_0%,#33A8FF,transparent_35%)]" />

          {/* Swaying Top Silk Curtain Accents */}
          <div className="stage-curtain-left pointer-events-none absolute -left-20 -top-24 h-[420px] w-[270px] rounded-[45%] bg-gradient-to-br from-[#33A8FF]/30 via-[#006FD6]/15 to-transparent blur-[1px]" />
          <div className="stage-curtain-left pointer-events-none absolute left-8 -top-20 h-[360px] w-[110px] rounded-[50%] bg-gradient-to-r from-[#001B3A]/70 via-[#33A8FF]/20 to-transparent opacity-60" />
          <div className="stage-curtain-right pointer-events-none absolute -right-20 -top-24 h-[420px] w-[270px] rounded-[45%] bg-gradient-to-bl from-[#33A8FF]/30 via-[#006FD6]/15 to-transparent blur-[1px]" />
          <div className="stage-curtain-right pointer-events-none absolute right-8 -top-20 h-[360px] w-[110px] rounded-[50%] bg-gradient-to-l from-[#001B3A]/70 via-[#33A8FF]/20 to-transparent opacity-60" />

          <main className="relative z-10 mx-auto grid min-h-screen max-w-[1920px] grid-cols-1 lg:grid-cols-[45%_55%] items-center px-[6vw] py-12 lg:py-16 gap-12 lg:gap-4">
            {/* Left Column (45%): Status, Event Title, PIN Card, Timer, Live Votes */}
            <section className="flex flex-col items-center justify-center px-4 sm:px-8 text-center">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-[#001329]/80 px-5 py-3 text-xs sm:text-sm font-semibold tracking-[0.08em] text-white shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
                {activeMode === 'OPEN' ? (
                  <>
                    <span className="stage-live-dot h-3 w-3 rounded-full bg-green-400" />
                    <span>VOTING OPEN</span>
                  </>
                ) : (
                  <>
                    <span className="h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
                    <span>WAITING TO OPEN</span>
                  </>
                )}
              </div>

              <h1 className="mt-8 text-[clamp(40px,4vw,76px)] font-bold leading-[1.05] tracking-[-0.055em] text-white max-w-xl">
                {title}
              </h1>
              <p className="mt-4 text-lg sm:text-xl font-medium text-white/60">
                {subtitle}
              </p>

              {/* Glowing Glass Room PIN Card */}
              <div className="stage-pin-card mt-10 w-full max-w-[540px] rounded-[28px] border border-white/15 bg-[#062448]/75 px-8 sm:px-10 py-7 sm:py-8 backdrop-blur-xl">
                {requirePin ? (
                  <>
                    <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-theme-accent">
                      Room PIN
                    </p>
                    <p className="tabular mt-3 sm:mt-4 text-[clamp(64px,6.5vw,112px)] font-semibold leading-none tracking-[0.08em] text-white">
                      {pinDisplay}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
                      Direct Access
                    </p>
                    <p className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight text-white">
                      NO PIN NEEDED
                    </p>
                  </>
                )}
              </div>

              {/* Countdown Timer */}
              <div className="mt-10">
                <p
                  className={`tabular text-[clamp(56px,5.5vw,96px)] font-semibold leading-none tracking-[-0.04em] transition-colors ${
                    activeMode === 'OPEN' && timerSeconds < 30 && timerSeconds > 0
                      ? 'text-red-400 animate-pulse'
                      : 'text-white'
                  }`}
                >
                  {formatTimerString(timerSeconds)}
                </p>
                <p className="mt-3 text-xs sm:text-base font-medium uppercase tracking-[0.28em] text-white/45">
                  {activeMode === 'OPEN' ? 'Time remaining' : 'Session duration'}
                </p>
              </div>

              {/* Live Participation Counter */}
              <div className="mt-10 flex items-center gap-3.5 text-white">
                <Users className="w-6 h-6 text-theme-accent" />
                {activeMode === 'OPEN' ? (
                  <>
                    <span
                      key={totalVotes}
                      className="stage-counter-pop tabular text-3xl font-semibold"
                    >
                      {totalVotes.toLocaleString()}
                    </span>
                    <span className="text-lg text-white/55">live votes</span>
                  </>
                ) : (
                  <>
                    <span className="tabular text-3xl font-semibold">
                      {activeCount}
                    </span>
                    <span className="text-lg text-white/55">nominees ready</span>
                  </>
                )}
              </div>
            </section>

            {/* Right Column (55%): Giant High-Contrast White QR Card */}
            <section className="flex flex-col items-center justify-center px-4 sm:px-8 text-center">
              <div className="stage-qr-shadow rounded-[28px] bg-white p-7 sm:p-10">
                <div className="h-[min(29vw,440px)] w-[min(29vw,440px)] min-h-[260px] min-w-[260px] sm:min-h-[360px] sm:min-w-[360px] flex items-center justify-center">
                  {appUrl ? (
                    <QRCodeSVG
                      value={appUrl}
                      size={420}
                      level="H"
                      includeMargin={false}
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100 animate-pulse rounded-2xl" />
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={copyLink}
                className="mt-8 sm:mt-10 inline-flex items-center gap-2 text-xl sm:text-2xl font-medium tracking-tight text-white hover:text-theme-accent transition cursor-pointer"
                title="Copy voting URL"
              >
                <span>{appUrl.replace(/^https?:\/\//, '')}</span>
                {copiedLink && <Check className="w-5 h-5 text-emerald-400" />}
              </button>

              <div className="mt-4 inline-flex items-center gap-3 text-base sm:text-lg font-medium text-white/65">
                <ScanLine className="w-6 h-6 text-theme-accent" />
                <span>Scan to vote</span>
              </div>
            </section>
          </main>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: WINNER REVEAL PODIUM (CLOSED — Results Revealed)            */}
      {/* =================================================================== */}
      {isPodiumView && (
        <div className="stage-root relative min-h-screen overflow-hidden bg-[#001B3A] font-[family-name:var(--font-inter)] text-white select-none">
          {/* SVG Silk Draped Curtains Left & Right */}
          <svg
            className="pointer-events-none absolute inset-0 z-0 h-full w-full"
            viewBox="0 0 1920 1080"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="silkBlue" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#00112d" />
                <stop offset=".28" stopColor="#006FD6" stopOpacity=".9" />
                <stop offset=".5" stopColor="#33A8FF" stopOpacity=".25" />
                <stop offset=".72" stopColor="#003E85" stopOpacity=".86" />
                <stop offset="1" stopColor="#000d24" />
              </linearGradient>
              <linearGradient id="curtainFold" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#00112d" stopOpacity=".75" />
                <stop offset=".5" stopColor="#33A8FF" stopOpacity=".15" />
                <stop offset="1" stopColor="#001B3A" stopOpacity=".8" />
              </linearGradient>
            </defs>
            <path
              className="podium-curtain-left"
              fill="url(#silkBlue)"
              d="M0 0H430C380 180 390 350 330 530C275 695 335 845 270 1080H0Z"
            />
            <path
              className="podium-curtain-left"
              fill="url(#curtainFold)"
              d="M0 0H270C225 210 265 355 190 575C145 720 205 900 150 1080H0Z"
            />
            <path
              className="podium-curtain-right"
              fill="url(#silkBlue)"
              d="M1920 0H1490C1540 180 1530 350 1590 530C1645 695 1585 845 1650 1080H1920Z"
            />
            <path
              className="podium-curtain-right"
              fill="url(#curtainFold)"
              d="M1920 0H1650C1695 210 1655 355 1730 575C1775 720 1715 900 1770 1080H1920Z"
            />
          </svg>

          {/* Animated CSS Confetti Rain */}
          <div
            key={revealKey}
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
            aria-hidden="true"
          >
            {PODIUM_CONFETTI.map((c, idx) => (
              <span
                key={idx}
                className={`podium-confetti absolute top-[-10px] ${c.sizeClass} ${c.colorClass}`}
                style={
                  {
                    left: c.left,
                    '--drift': c.drift,
                    animationDelay: c.delay,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>

          {/* Minimalist Floating Top Header */}
          <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-6 sm:px-14 py-6 sm:py-10">
            <div>
              <p className="text-[11px] sm:text-[12px] font-semibold uppercase tracking-[0.34em] text-[#9bd9ff]">
                {title}
              </p>
              <p className="mt-1.5 text-xs sm:text-sm font-medium text-white/55">
                {subtitle}
              </p>
            </div>
            <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-[#001B3A]/45 px-4 sm:px-5 py-2.5 sm:py-3 text-xs font-semibold text-white/80 backdrop-blur-md">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_14px_rgba(74,222,128,0.8)]" />
              <span>Results revealed</span>
            </div>
          </header>

          {/* Center Stage 3-Card Podium */}
          <main className="relative z-20 flex min-h-screen flex-col md:flex-row items-center justify-center gap-6 md:gap-8 xl:gap-12 px-6 sm:px-10 pb-14 pt-24 md:pt-16">
            {top3.length === 0 ? (
              <div className="stage-glass-card rounded-[28px] p-10 text-center max-w-md">
                <Trophy className="w-12 h-12 text-theme-accent mx-auto mb-3" />
                <h2 className="text-xl font-bold text-white">No Nominees Registered</h2>
                <p className="text-sm text-white/60 mt-2">
                  Register nominees in Committee Dashboard to display the winner podium.
                </p>
              </div>
            ) : (
              <>
                {/* #2 Left Podium */}
                {top3[1] && (
                  <article className="podium-side podium-left stage-glass-card relative order-2 md:order-1 md:mt-28 flex h-[380px] sm:h-[420px] w-[260px] sm:w-[280px] shrink-0 flex-col items-center rounded-[28px] px-[15px] pb-7 pt-5 shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
                    <span className="absolute left-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/10 text-lg font-bold text-white backdrop-blur-md">
                      #2
                    </span>
                    <div className="mt-5 h-[240px] sm:h-[290px] w-[220px] sm:w-[250px] overflow-hidden rounded-[18px] stage-portrait-glow">
                      <CandidateMedia
                        photoData={top3[1].photo_data}
                        name={top3[1].name}
                        number={top3[1].number}
                      />
                    </div>
                    <div className="mt-4 text-center w-full px-2">
                      <h2 className="text-xl font-semibold tracking-tight text-white truncate">
                        {top3[1].name}
                      </h2>
                      <p className="tabular mt-2 text-2xl font-bold text-white">
                        {(top3[1].votes || 0).toLocaleString()}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-[#a8dcff]">
                        {totalVotes > 0
                          ? Math.round(((top3[1].votes || 0) / totalVotes) * 100)
                          : 0}
                        % of votes
                      </p>
                    </div>
                  </article>
                )}

                {/* #1 Center Hero Podium */}
                {top3[0] && (
                  <article className="podium-hero stage-glass-card relative z-10 order-1 md:order-2 flex h-[540px] sm:h-[650px] w-[320px] sm:w-[380px] shrink-0 flex-col items-center rounded-[32px] px-[20px] sm:px-[25px] pb-7 pt-6">
                    <span className="absolute left-6 top-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-theme-primary text-lg font-bold text-white shadow-[0_0_22px_rgba(51,168,255,0.55)]">
                      #1
                    </span>
                    <span className="absolute right-6 top-7 z-10 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#9bd9ff]">
                      Audience choice
                    </span>
                    <div className="mt-5 h-[360px] sm:h-[480px] w-[270px] sm:w-[320px] overflow-hidden rounded-[20px] stage-portrait-glow">
                      <CandidateMedia
                        photoData={top3[0].photo_data}
                        name={top3[0].name}
                        number={top3[0].number}
                      />
                    </div>
                    <div className="mt-4 text-center w-full px-2">
                      <h1 className="text-[24px] sm:text-[26px] font-bold tracking-[-0.035em] text-white truncate">
                        {top3[0].name}
                      </h1>
                      <p className="tabular mt-1 text-[28px] sm:text-[30px] font-bold leading-none text-white">
                        {(top3[0].votes || 0).toLocaleString()}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[#a8dcff]">
                        {totalVotes > 0
                          ? Math.round(((top3[0].votes || 0) / totalVotes) * 100)
                          : 0}
                        % of votes
                      </p>
                    </div>
                  </article>
                )}

                {/* #3 Right Podium */}
                {top3[2] && (
                  <article className="podium-side podium-right stage-glass-card relative order-3 md:mt-40 flex h-[380px] sm:h-[420px] w-[260px] sm:w-[280px] shrink-0 flex-col items-center rounded-[28px] px-[15px] pb-7 pt-5 shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
                    <span className="absolute left-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/10 text-lg font-bold text-white backdrop-blur-md">
                      #3
                    </span>
                    <div className="mt-5 h-[240px] sm:h-[290px] w-[220px] sm:w-[250px] overflow-hidden rounded-[18px] stage-portrait-glow">
                      <CandidateMedia
                        photoData={top3[2].photo_data}
                        name={top3[2].name}
                        number={top3[2].number}
                      />
                    </div>
                    <div className="mt-4 text-center w-full px-2">
                      <h2 className="text-xl font-semibold tracking-tight text-white truncate">
                        {top3[2].name}
                      </h2>
                      <p className="tabular mt-2 text-2xl font-bold text-white">
                        {(top3[2].votes || 0).toLocaleString()}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-[#a8dcff]">
                        {totalVotes > 0
                          ? Math.round(((top3[2].votes || 0) / totalVotes) * 100)
                          : 0}
                        % of votes
                      </p>
                    </div>
                  </article>
                )}
              </>
            )}
          </main>

          {/* Bottom-Center Full Standings Trigger */}
          {sorted.length > 0 && (
            <button
              type="button"
              onClick={() => setShowStandingsModal(true)}
              className="absolute bottom-7 left-1/2 z-20 -translate-x-1/2 text-[10px] font-medium uppercase tracking-[0.3em] text-white/35 hover:text-white/80 transition cursor-pointer"
              title="View full vote breakdown"
            >
              Final standings ({totalVotes.toLocaleString()} votes)
            </button>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* FLOATING BOTTOM-RIGHT OPERATOR STAGE CONTROLS                       */}
      {/* =================================================================== */}
      <div className="fixed bottom-6 right-6 z-30 flex items-center gap-2">
        {isPodiumView && (
          <button
            type="button"
            onClick={triggerCelebration}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#001329]/85 px-4 py-2.5 text-xs font-semibold text-white/75 backdrop-blur-md transition hover:border-theme-accent/60 hover:text-white cursor-pointer"
            title="Fire celebration confetti"
          >
            <Sparkles className="w-3.5 h-3.5 text-theme-accent" />
            <span className="hidden sm:inline">Celebrate</span>
          </button>
        )}

        {/* Quick Mode Switcher Pill */}
        <div className="inline-flex items-center rounded-full border border-white/15 bg-[#001329]/85 p-1 text-[11px] font-semibold backdrop-blur-md">
          <button
            type="button"
            onClick={() => setManualMode(null)}
            className={`rounded-full px-3 py-1.5 transition cursor-pointer ${
              manualMode === null
                ? 'bg-theme-primary text-white'
                : 'text-white/55 hover:text-white'
            }`}
            title="Automatically sync with Committee Dashboard"
          >
            Auto Sync
          </button>
          <button
            type="button"
            onClick={() => setManualMode('OPEN')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition cursor-pointer ${
              manualMode === 'OPEN'
                ? 'bg-white/20 text-white'
                : 'text-white/55 hover:text-white'
            }`}
            title="Preview QR & Live Timer"
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">QR &amp; Timer</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setManualMode('CLOSED');
              triggerCelebration();
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition cursor-pointer ${
              manualMode === 'CLOSED'
                ? 'bg-white/20 text-white'
                : 'text-white/55 hover:text-white'
            }`}
            title="Preview Winner Reveal Podium"
          >
            <MonitorPlay className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Winner Reveal</span>
          </button>
        </div>

        {/* Fullscreen Button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="Toggle fullscreen"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#001329]/85 text-white/65 backdrop-blur-md transition hover:border-white/35 hover:text-white cursor-pointer"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>

      {/* =================================================================== */}
      {/* OPTIONAL FULL STANDINGS DRAWER (Click "Final standings" to inspect) */}
      {/* =================================================================== */}
      {showStandingsModal && (
        <div
          className="fixed inset-0 z-40 bg-[#000d24]/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-up"
          onClick={() => setShowStandingsModal(false)}
        >
          <div
            className="stage-glass-card rounded-[28px] max-w-2xl w-full p-6 sm:p-8 shadow-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#9bd9ff]">
                  Complete Standings
                </p>
                <h3 className="text-xl font-bold text-white mt-1">
                  {title} — {totalVotes.toLocaleString()} Total Votes
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStandingsModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4 overflow-y-auto pr-1">
              {sorted.map((c, idx) => {
                const votes = c.votes || 0;
                const pct =
                  totalVotes > 0 ? Math.round((votes / totalVotes) * 1000) / 10 : 0;
                return (
                  <div key={c.id}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-semibold text-white truncate pr-3">
                        <span className="text-theme-accent mr-2 tabular">#{idx + 1}</span>
                        No. {String(c.number).padStart(2, '0')} — {c.name}
                      </span>
                      <span className="tabular font-semibold text-[#a8dcff] shrink-0">
                        {votes.toLocaleString()} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.max(pct, votes > 0 ? 3 : 0)}%`,
                          background:
                            idx === 0
                              ? 'linear-gradient(90deg, #006FD6, #33A8FF)'
                              : 'rgba(255, 255, 255, 0.55)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
