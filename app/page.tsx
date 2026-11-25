'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CandidateMedia } from '@/components/CandidateMedia';
import {
  Clock,
  Lock,
  LockKeyhole,
  CheckCircle2,
  ZoomIn,
  X,
  AlertCircle,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface Candidate {
  id: number;
  number: number;
  name: string;
  category: string;
  costume_theme: string | null;
  photo_data: string;
  is_active: boolean;
}

interface StatusResponse {
  event_title: string;
  event_subtitle: string;
  organizer_label: string;
  status: 'WAITING' | 'OPEN' | 'CLOSED';
  require_pin: boolean;
  timer_minutes: number;
  ends_at: string | null;
  has_voted: boolean;
  voted_candidate: Candidate | null;
  voted_at: string | null;
}

const CONFETTI_PIECES = [
  { drift: '-112px', delay: '0.1s', colorClass: 'bg-theme-primary', sizeClass: 'h-2 w-1.5 rounded-sm' },
  { drift: '-70px', delay: '0.24s', colorClass: 'bg-theme-accent', sizeClass: 'h-1.5 w-2 rounded-sm' },
  { drift: '78px', delay: '0.18s', colorClass: 'bg-theme-muted-blue', sizeClass: 'h-2 w-1.5 rounded-sm' },
  { drift: '120px', delay: '0.32s', colorClass: 'bg-theme-primary', sizeClass: 'h-1.5 w-2 rounded-sm' },
  { drift: '42px', delay: '0.42s', colorClass: 'bg-theme-accent', sizeClass: 'h-2 w-1.5 rounded-sm' },
  { drift: '-36px', delay: '0.52s', colorClass: 'bg-theme-muted-blue', sizeClass: 'h-1.5 w-1.5 rounded-full' },
];

export default function VoterPage() {
  const [statusData, setStatusData] = useState<StatusResponse | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  // Category Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Countdown state synced from statusData.ends_at
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // PIN Gate state
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinShake, setPinShake] = useState(false);
  const [verifyingPin, setVerifyingPin] = useState(false);
  // True only after a successful POST /api/vote — prevents polling from resetting
  // pinUnlocked while the user is actively browsing candidates with a valid PIN.
  const pinServerVerified = useRef(false);
  const pinInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Modals / Bottom Sheet state
  const [selectedPhotoCand, setSelectedPhotoCand] = useState<Candidate | null>(null);
  const [confirmingCand, setConfirmingCand] = useState<Candidate | null>(null);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // 1. Fetch Status & Candidates
  const fetchStatusAndData = async () => {
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      if (res.ok) {
        const data: StatusResponse = await res.json();
        setStatusData(data);

        // The server (voted_token cookie + votes table) is the single source of truth.
        // A stale localStorage flag (cookie cleared, votes reset, new event) must never
        // bypass the PIN gate, so drop it whenever the server says we haven't voted.
        if (!data.has_voted) {
          localStorage.removeItem('voted_status');
        }

        if (data.has_voted) {
          pinServerVerified.current = true;
          setPinUnlocked(true);
        } else if (!data.require_pin) {
          setPinUnlocked(true);
        } else {
          // require_pin is ON and user hasn't voted yet.
          // Only enforce the gate if the PIN hasn't been server-verified this session.
          // This prevents polling from locking out a user who entered the correct PIN
          // but hasn't submitted their vote yet.
          if (!pinServerVerified.current) {
            setPinUnlocked(false);
          }
        }

        if (data.status === 'OPEN') {
          const candRes = await fetch('/api/candidates', { cache: 'no-store' });
          if (candRes.ok) {
            const candData = await candRes.json();
            setCandidates(candData.candidates || []);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndData();

    // Auto-poll every 5 seconds to sync event state
    const interval = setInterval(() => {
      fetchStatusAndData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // 2. Live Countdown Ticker synced from ends_at
  useEffect(() => {
    if (statusData?.status === 'OPEN' && statusData.ends_at) {
      const endMs = new Date(statusData.ends_at).getTime();
      const updateRemaining = () => {
        const diff = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
        setRemainingSeconds(diff);
      };
      updateRemaining();
      const ticker = setInterval(updateRemaining, 1000);
      return () => clearInterval(ticker);
    } else {
      setRemainingSeconds(null);
    }
  }, [statusData?.status, statusData?.ends_at]);

  const formatTimer = (sec: number | null) => {
    if (sec === null) return 'LIVE';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Handle PIN input box typing
  const handlePinChange = (idx: number, val: string) => {
    const clean = val.replace(/\D/g, '').slice(-1);
    const updated = [...pinDigits];
    updated[idx] = clean;
    setPinDigits(updated);
    setPinError(null);

    if (clean && idx < 3) {
      pinInputRefs[idx + 1].current?.focus();
    }
  };

  const handlePinKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[idx] && idx > 0) {
      pinInputRefs[idx - 1].current?.focus();
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;
    const digits = pasted.split('');
    const updated = ['', '', '', ''];
    digits.forEach((d, i) => {
      if (i < 4) updated[i] = d;
    });
    setPinDigits(updated);
    setPinError(null);
    if (digits.length >= 4) {
      pinInputRefs[3].current?.focus();
    } else {
      pinInputRefs[digits.length]?.current?.focus();
    }
  };

  const triggerShake = () => {
    setPinShake(true);
    setTimeout(() => setPinShake(false), 400);
  };

  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (verifyingPin) return;
    const entered = pinDigits.join('');
    if (entered.length < 4) {
      setPinError('Please enter a valid 4-digit PIN.');
      triggerShake();
      return;
    }

    setVerifyingPin(true);
    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_pin: entered }),
      });

      if (res.ok) {
        // PIN confirmed by the server; polling must not re-lock the gate now.
        pinServerVerified.current = true;
        setPinUnlocked(true);
        showToast('PIN accepted. Please select your favorite nominee!', 'success');
        return;
      }

      // Wrong PIN (or any failure): clear the boxes so the user can retype right away.
      const data = await res.json().catch(() => ({}));
      pinServerVerified.current = false;
      setPinDigits(['', '', '', '']);
      setPinError(
        res.status === 401
          ? 'Incorrect PIN. Please check the main stage screen and try again.'
          : data.error || 'Could not verify the PIN. Please try again.'
      );
      triggerShake();
      setTimeout(() => pinInputRefs[0].current?.focus(), 50);
    } catch (err) {
      console.error('PIN verify error:', err);
      setPinError('Network error. Please try again.');
      triggerShake();
    } finally {
      setVerifyingPin(false);
    }
  };

  // Submit Vote
  const handleConfirmVote = async () => {
    if (!confirmingCand) return;
    setSubmittingVote(true);
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: confirmingCand.id,
          room_pin: pinDigits.join(''),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setConfirmingCand(null);
          pinServerVerified.current = false; // Wrong PIN — revoke optimistic unlock
          setPinUnlocked(false);
          setPinDigits(['', '', '', '']);
          setPinError('The Room PIN has changed or is incorrect. Please enter it again.');
          triggerShake();
          setTimeout(() => pinInputRefs[0].current?.focus(), 50);
          showToast(data.error || 'Incorrect Room PIN.', 'error');
        } else if (res.status === 409) {
          setConfirmingCand(null);
          showToast('You have already cast your vote.', 'info');
          await fetchStatusAndData();
        } else {
          showToast(data.error || 'Failed to submit vote.', 'error');
        }
        return;
      }

      // Vote Success!
      showToast(data.message || 'Vote successfully recorded!', 'success');
      setConfirmingCand(null);
      await fetchStatusAndData();
    } catch (err) {
      console.error('Vote error:', err);
      showToast('Network error while submitting vote.', 'error');
    } finally {
      setSubmittingVote(false);
    }
  };

  if (loading && !statusData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-theme-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading Voting Session...
          </p>
        </div>
      </div>
    );
  }

  const title = statusData?.event_title || 'Live Event Voting';
  const subtitle = statusData?.event_subtitle || 'Audience Choice Award';
  const organizer = statusData?.organizer_label || 'Event Committee';
  const status = statusData?.status || 'WAITING';
  const hasVoted = Boolean(statusData?.has_voted);
  const votedCandidate = statusData?.voted_candidate;

  const isGalleryView =
    status === 'OPEN' && !hasVoted && (!statusData?.require_pin || pinUnlocked);
  const isVoteRecordedView = status === 'OPEN' && hasVoted;

  // Dynamic category filter pills
  const uniqueCategories = Array.from(
    new Set(candidates.map((c) => c.category).filter(Boolean))
  );
  const categories = ['All', ...uniqueCategories];
  const activeCategory =
    selectedCategory === 'All' || uniqueCategories.includes(selectedCategory)
      ? selectedCategory
      : 'All';
  const filteredCandidates =
    activeCategory === 'All'
      ? candidates
      : candidates.filter((c) => c.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#F8FAFC] sm:bg-slate-100 sm:py-6 sm:px-4 flex items-center justify-center font-[family-name:var(--font-inter)]">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] max-w-sm w-full px-4 animate-fade-up">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2.5 text-white ${
              toastType === 'success'
                ? 'bg-emerald-600'
                : toastType === 'error'
                ? 'bg-rose-600'
                : 'bg-slate-900'
            }`}
          >
            {toastType === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Mobile App Frame */}
      <div className="relative w-full h-screen sm:h-[calc(100vh-3rem)] sm:max-h-[880px] sm:max-w-[430px] flex flex-col overflow-hidden bg-[#F8FAFC] text-[#0F172A] sm:rounded-[32px] sm:shadow-[0_24px_60px_rgba(15,23,42,0.14)] sm:border sm:border-slate-200/80">
        {/* Sticky Minimalist Header (hidden on Vote Recorded view to match Superdesign celebration screen) */}
        {!isVoteRecordedView && (
          <header className="shrink-0 pt-5 sm:pt-7 border-b border-slate-200/70 bg-[#F8FAFC]/95 backdrop-blur-md z-20">
            <div className="flex items-center justify-between px-6 pb-4 gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-theme-primary truncate">
                  {title}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#0F172A] truncate">
                  {subtitle}
                </p>
              </div>

              {status === 'OPEN' ? (
                <div className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full bg-theme-primary px-3.5 text-[12px] font-semibold text-white shadow-[0_7px_16px_rgba(0,111,214,0.22)]">
                  <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="tabular">{formatTimer(remainingSeconds)}</span>
                </div>
              ) : status === 'WAITING' ? (
                <div className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full bg-amber-100 border border-amber-200 px-3.5 text-[12px] font-semibold text-amber-800">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Waiting</span>
                </div>
              ) : (
                <div className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full bg-rose-100 border border-rose-200 px-3.5 text-[12px] font-semibold text-rose-700">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  <span>Closed</span>
                </div>
              )}
            </div>

            {/* Category Filter Chips (only on Nominee Gallery when categories exist) */}
            {isGalleryView && candidates.length > 0 && (
              <div className="chip-row flex gap-2.5 overflow-x-auto px-6 pb-4">
                {categories.map((cat) => {
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`min-h-[44px] shrink-0 rounded-full border px-5 text-sm transition cursor-pointer ${
                        isActive
                          ? 'border-theme-primary bg-theme-primary font-semibold text-white shadow-[0_7px_16px_rgba(0,111,214,0.16)]'
                          : 'border-slate-200 bg-white font-medium text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            )}
          </header>
        )}

        {/* STATE 1: WAITING */}
        {status === 'WAITING' && (
          <main className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center justify-center text-center animate-fade-up">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-theme-soft text-theme-primary flex items-center justify-center relative z-10">
                <Clock className="w-9 h-9" />
              </div>
              <span className="absolute inset-0 rounded-full bg-theme-accent/30 pulse-ring" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold uppercase tracking-[0.08em] mb-3">
              Voting Has Not Started
            </span>
            <h1 className="text-[26px] font-bold leading-[1.15] tracking-[-0.03em] text-[#0F172A]">
              Please wait for the stage MC
            </h1>
            <p className="text-[14px] text-slate-500 mt-3 leading-[1.55] max-w-[280px]">
              {organizer} is preparing the nominees. This screen refreshes automatically when voting begins.
            </p>
            <button
              type="button"
              onClick={fetchStatusAndData}
              className="mt-7 min-h-[48px] px-6 rounded-full border border-slate-200 bg-white hover:border-theme-primary text-sm font-semibold text-theme-primary shadow-sm flex items-center gap-2 transition cursor-pointer active:scale-[0.98]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Check Status Again</span>
            </button>
          </main>
        )}

        {/* STATE 2: CLOSED */}
        {status === 'CLOSED' && (
          <main className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center justify-center text-center animate-fade-up">
            <div className="w-[68px] h-[68px] rounded-full bg-slate-200/80 text-slate-600 flex items-center justify-center mb-5">
              <LockKeyhole className="w-8 h-8" />
            </div>
            <span className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-semibold uppercase tracking-[0.08em] mb-3">
              Voting Session Closed
            </span>
            <h1 className="text-[26px] font-bold leading-[1.15] tracking-[-0.03em] text-[#0F172A]">
              Voting has ended
            </h1>
            <p className="text-[14px] text-slate-500 mt-3 leading-[1.55] max-w-[280px]">
              Watch the main stage screen for the official winner announcement.
            </p>

            {hasVoted && votedCandidate && (
              <div className="mt-7 w-full rounded-[24px] bg-white p-4 shadow-[0_14px_38px_rgba(15,23,42,0.07),0_2px_8px_rgba(15,23,42,0.03)] text-left">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-theme-primary mb-3">
                  Your Recorded Vote
                </p>
                <div className="flex items-center gap-3.5">
                  <div className="w-16 aspect-[4/5] rounded-[14px] overflow-hidden shrink-0 bg-slate-100">
                    <CandidateMedia
                      photoData={votedCandidate.photo_data}
                      name={votedCandidate.name}
                      number={votedCandidate.number}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-[#0F172A] truncate">
                      {votedCandidate.name}
                    </p>
                    {votedCandidate.costume_theme && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {votedCandidate.costume_theme}
                      </p>
                    )}
                    <span className="mt-2 inline-flex items-center rounded-full bg-theme-soft px-3 py-1 text-[11px] font-semibold text-theme-primary">
                      {votedCandidate.category} · #{String(votedCandidate.number).padStart(2, '0')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </main>
        )}

        {/* STATE 3: VOTE RECORDED (Superdesign Celebration Screen) */}
        {isVoteRecordedView && (
          <main className="relative flex-1 overflow-y-auto px-6 pt-12 pb-[34px]">
            {/* Confetti Rain */}
            <div
              className="pointer-events-none absolute inset-x-0 top-10 flex justify-center"
              aria-hidden="true"
            >
              {CONFETTI_PIECES.map((piece, idx) => (
                <span
                  key={idx}
                  className={`confetti-drift-piece absolute ${piece.sizeClass} ${piece.colorClass}`}
                  style={
                    {
                      '--drift': piece.drift,
                      animationDelay: piece.delay,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>

            <section className="flex min-h-full flex-col items-center text-center">
              {/* Animated SVG Checkmark Emblem */}
              <div
                className="success-emblem flex h-[68px] w-[68px] items-center justify-center rounded-full bg-theme-soft text-theme-primary"
                aria-label="Vote submitted successfully"
              >
                <svg className="h-10 w-10" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2.5" opacity=".22" />
                  <path
                    className="check-line"
                    d="M15 24.5 21 30l12-13"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <h1 className="mt-7 text-[30px] font-bold leading-[1.12] tracking-[-0.045em] text-[#0F172A]">
                Your vote is<br />submitted
              </h1>
              <p className="mt-4 max-w-[290px] text-[14px] leading-[1.55] text-slate-500">
                Thank you for taking part in live event voting.
              </p>

              {/* Showcase Card for Selected Nominee */}
              {votedCandidate && (
                <section
                  className="mt-9 w-full rounded-[24px] bg-white p-4 shadow-[0_14px_38px_rgba(15,23,42,0.07),0_2px_8px_rgba(15,23,42,0.03)]"
                  aria-label="Your selected nominee"
                >
                  <div className="aspect-[4/5] w-full rounded-[18px] overflow-hidden bg-slate-100">
                    <CandidateMedia
                      photoData={votedCandidate.photo_data}
                      name={votedCandidate.name}
                      number={votedCandidate.number}
                    />
                  </div>
                  <div className="px-2 pb-1 pt-5">
                    <p className="text-[20px] font-bold tracking-[-0.025em] text-[#0F172A] truncate">
                      {votedCandidate.name}
                    </p>
                    {votedCandidate.costume_theme && (
                      <p className="mt-1 text-[14px] text-slate-500 truncate">
                        {votedCandidate.costume_theme}
                      </p>
                    )}
                    <span className="mt-4 inline-flex min-h-[32px] items-center rounded-full bg-theme-soft px-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-theme-primary">
                      {votedCandidate.category} · #{String(votedCandidate.number).padStart(2, '0')}
                    </span>
                  </div>
                </section>
              )}

              {/* One vote per device pill */}
              <div className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-slate-100 px-4 text-[12px] font-semibold text-slate-600">
                <LockKeyhole className="w-[15px] h-[15px] text-slate-500" />
                <span>One vote per device</span>
              </div>

              <p className="mt-6 max-w-[270px] text-[14px] leading-[1.55] text-slate-500">
                Watch the main stage for final results
              </p>
            </section>
          </main>
        )}

        {/* STATE 4: PIN REQUIRED & NOT UNLOCKED */}
        {status === 'OPEN' && !hasVoted && statusData?.require_pin && !pinUnlocked && (
          <main className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center justify-center animate-fade-up">
            <div className="w-[68px] h-[68px] rounded-full bg-theme-soft text-theme-primary flex items-center justify-center mb-5">
              <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-[#0F172A] text-center">
              Enter Room PIN
            </h1>
            <p className="text-[14px] text-slate-500 text-center mt-2 max-w-[280px] leading-[1.55]">
              Enter the 4-digit PIN shown on the main stage screen to unlock voting.
            </p>

            <form onSubmit={handleVerifyPin} className="w-full max-w-xs mt-7">
              <div
                className={`grid grid-cols-4 gap-3 mb-4 ${
                  pinShake ? 'animate-shake' : ''
                }`}
              >
                {[0, 1, 2, 3].map((idx) => (
                  <input
                    key={idx}
                    ref={pinInputRefs[idx]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={pinDigits[idx]}
                    onChange={(e) => handlePinChange(idx, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(idx, e)}
                    onPaste={handlePinPaste}
                    className="w-full h-14 text-center text-2xl font-bold tabular rounded-2xl border-2 border-slate-200 bg-white text-[#0F172A] focus:outline-none focus:border-theme-primary transition shadow-sm"
                    aria-label={`Digit ${idx + 1}`}
                  />
                ))}
              </div>

              {pinError && (
                <p className="text-center text-xs font-semibold text-rose-600 mb-3 animate-fade-up">
                  {pinError}
                </p>
              )}

              <button
                type="submit"
                disabled={verifyingPin}
                className="w-full min-h-[54px] rounded-full bg-theme-primary hover:bg-theme-dark text-[15px] font-semibold text-white shadow-[0_7px_16px_rgba(0,111,214,0.22)] transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {verifyingPin ? 'Checking...' : 'Enter Voting'}
              </button>
            </form>
          </main>
        )}

        {/* STATE 5: NOMINEE GALLERY (Superdesign Full-Bleed Grid) */}
        {isGalleryView && (
          <main className="gallery-scroll flex-1 overflow-y-auto px-6 pb-10 pt-5">
            {filteredCandidates.length === 0 ? (
              <div className="py-16 text-center rounded-[24px] border-2 border-dashed border-slate-200 bg-white px-6">
                <Sparkles className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">
                  {candidates.length === 0
                    ? 'Nominees Are Being Prepared'
                    : 'No Nominees in This Category'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {candidates.length === 0
                    ? 'The committee will publish active nominees shortly.'
                    : 'Try switching back to "All" above.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredCandidates.map((cand, idx) => (
                  <article
                    key={cand.id}
                    onClick={() => setSelectedPhotoCand(cand)}
                    style={{ animationDelay: `${Math.min(idx, 8) * 70}ms` }}
                    className="card-rise relative aspect-[4/5] overflow-hidden rounded-[24px] bg-white shadow-[0_14px_38px_rgba(15,23,42,0.07),0_2px_8px_rgba(15,23,42,0.03)] cursor-pointer group"
                  >
                    <CandidateMedia
                      photoData={cand.photo_data}
                      name={cand.name}
                      number={cand.number}
                      className="group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Top-Left Number Badge */}
                    <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-theme-primary text-xs font-bold text-white shadow-lg">
                      #{String(cand.number).padStart(2, '0')}
                    </span>

                    {/* Subtle Zoom Hint Top-Right */}
                    <span
                      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/35 backdrop-blur-sm text-white/90"
                      aria-hidden="true"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </span>

                    {/* Bottom Gradient Overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/75 to-transparent px-4 pb-4 pt-14 text-white">
                      <p className="text-[15px] font-semibold leading-tight truncate">
                        {cand.name}
                      </p>
                      {cand.costume_theme && (
                        <p className="mt-1 text-xs text-white/75 truncate">
                          {cand.costume_theme}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingCand(cand);
                        }}
                        className="mt-3 min-h-[44px] rounded-full bg-theme-primary hover:bg-theme-dark px-5 text-xs font-semibold text-white shadow-[0_7px_16px_rgba(0,111,214,0.22)] transition active:scale-[0.97] cursor-pointer"
                      >
                        Select
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </main>
        )}

        {/* BOTTOM SHEET: CONFIRM & SUBMIT VOTE (Superdesign) */}
        {confirmingCand && (
          <>
            <div
              className="backdrop-in absolute inset-0 z-30 bg-slate-950/35 backdrop-blur-[3px]"
              onClick={() => !submittingVote && setConfirmingCand(null)}
            />
            <section
              className="sheet-rise absolute inset-x-0 bottom-0 z-40 rounded-t-[24px] bg-white px-6 pb-8 pt-4 shadow-[0_-14px_38px_rgba(15,23,42,0.16)] flex flex-col max-h-[85%]"
              aria-label="Confirm and submit vote"
            >
              <div className="mx-auto mb-5 h-1 w-10 shrink-0 rounded-full bg-slate-200" />

              <div className="flex gap-4">
                <div className="h-28 w-[90px] shrink-0 rounded-[15px] overflow-hidden bg-slate-100">
                  <CandidateMedia
                    photoData={confirmingCand.photo_data}
                    name={confirmingCand.name}
                    number={confirmingCand.number}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-theme-primary">
                    Confirm your choice
                  </p>
                  <h2 className="mt-2 truncate text-xl font-bold tracking-tight text-[#0F172A]">
                    {confirmingCand.name}
                  </h2>
                  {confirmingCand.costume_theme && (
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {confirmingCand.costume_theme}
                    </p>
                  )}
                  <span className="mt-3 inline-flex w-fit rounded-full bg-theme-soft px-3 py-1 text-xs font-semibold text-theme-primary">
                    {confirmingCand.category} · #{String(confirmingCand.number).padStart(2, '0')}
                  </span>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5">
                <h3 className="text-lg font-bold tracking-tight text-[#0F172A]">
                  Confirm &amp; Submit Vote
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Your vote can only be submitted once on this device.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  disabled={submittingVote}
                  onClick={handleConfirmVote}
                  className="min-h-[54px] rounded-full bg-theme-primary hover:bg-theme-dark text-[15px] font-semibold text-white shadow-[0_7px_16px_rgba(0,111,214,0.22)] transition active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center"
                >
                  {submittingVote ? 'Submitting...' : 'Confirm & Submit Vote'}
                </button>
                <button
                  type="button"
                  disabled={submittingVote}
                  onClick={() => setConfirmingCand(null)}
                  className="min-h-[54px] rounded-full border border-slate-200 bg-white text-[15px] font-semibold text-theme-primary transition hover:border-theme-primary disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </section>
          </>
        )}

        {/* MODAL: ENLARGE CANDIDATE PHOTO */}
        {selectedPhotoCand && (
          <div
            className="backdrop-in absolute inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-5"
            onClick={() => setSelectedPhotoCand(null)}
          >
            <div
              className="bg-white rounded-[24px] w-full max-w-sm overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative bg-slate-100 aspect-[4/5] flex items-center justify-center overflow-hidden">
                <CandidateMedia
                  photoData={selectedPhotoCand.photo_data}
                  name={selectedPhotoCand.name}
                  number={selectedPhotoCand.number}
                />
                <span className="absolute top-3.5 left-3.5 flex h-9 px-3 items-center justify-center rounded-full bg-theme-primary text-white text-xs font-bold shadow-lg">
                  #{String(selectedPhotoCand.number).padStart(2, '0')}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPhotoCand(null)}
                  className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white flex items-center justify-center cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  {selectedPhotoCand.category && (
                    <span className="rounded-full bg-theme-soft px-3 py-0.5 text-[11px] font-semibold text-theme-primary">
                      {selectedPhotoCand.category}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  {selectedPhotoCand.name}
                </h3>
                {selectedPhotoCand.costume_theme && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    {selectedPhotoCand.costume_theme}
                  </p>
                )}
                <div className="mt-5 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedPhotoCand(null)}
                    className="flex-1 min-h-[48px] rounded-full border border-slate-200 text-theme-primary font-semibold text-xs hover:border-theme-primary cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const c = selectedPhotoCand;
                      setSelectedPhotoCand(null);
                      setConfirmingCand(c);
                    }}
                    className="flex-1 min-h-[48px] rounded-full bg-theme-primary hover:bg-theme-dark text-white font-semibold text-xs shadow-[0_7px_16px_rgba(0,111,214,0.22)] cursor-pointer"
                  >
                    Select Nominee
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
