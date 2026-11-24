'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CandidateMedia } from '@/components/CandidateMedia';
import {
  Clock,
  Lock,
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

export default function VoterPage() {
  const [statusData, setStatusData] = useState<StatusResponse | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  // PIN Gate state
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState(false);
  const [pinShake, setPinShake] = useState(false);
  const pinInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Modals state
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

        // If user already voted according to server or localStorage
        const localVoted = localStorage.getItem('voted_status');
        if (data.has_voted || localVoted === 'true') {
          setPinUnlocked(true);
        } else if (!data.require_pin) {
          setPinUnlocked(true);
        }

        // If voting is open, fetch active candidate list
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

  // Handle PIN input box typing
  const handlePinChange = (idx: number, val: string) => {
    const clean = val.replace(/\D/g, '').slice(-1);
    const updated = [...pinDigits];
    updated[idx] = clean;
    setPinDigits(updated);
    setPinError(false);

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
    setPinError(false);
    if (digits.length >= 4) {
      pinInputRefs[3].current?.focus();
    } else {
      pinInputRefs[digits.length]?.current?.focus();
    }
  };

  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const entered = pinDigits.join('');
    if (entered.length < 4) {
      setPinError(true);
      triggerShake();
      return;
    }

    // Try a test vote payload or unlock pin
    // We unlock locally and the POST /api/vote will rigorously validate the room PIN on server
    setPinUnlocked(true);
    showToast('PIN entered. Please select your favorite candidate!', 'success');
  };

  const triggerShake = () => {
    setPinShake(true);
    setTimeout(() => setPinShake(false), 400);
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
          // PIN was wrong
          setPinUnlocked(false);
          setPinError(true);
          triggerShake();
          showToast(data.error || 'Incorrect Room PIN.', 'error');
        } else if (res.status === 409) {
          // Already voted
          localStorage.setItem('voted_status', 'true');
          showToast('You have already cast your vote.', 'info');
          await fetchStatusAndData();
        } else {
          showToast(data.error || 'Failed to submit vote.', 'error');
        }
        return;
      }

      // Vote Success!
      localStorage.setItem('voted_status', 'true');
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
          <div className="w-10 h-10 border-4 border-[#006FD6] border-t-transparent rounded-full animate-spin" />
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-4 sm:py-8 px-3 sm:px-4 flex flex-col justify-center">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] max-w-sm w-full px-4 animate-fade-up">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl text-xs font-extrabold flex items-center gap-2.5 text-white ${
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

      {/* Mobile Card Container */}
      <div className="max-w-md w-full mx-auto bg-white sm:rounded-[2rem] rounded-3xl shadow-xl shadow-slate-200/80 border border-slate-200/80 overflow-hidden flex flex-col min-h-[82vh]">
        
        {/* Silky Curtain Hero Banner */}
        <header className="silk-curtain-hero px-5 pt-6 pb-8 text-white relative">
          <div className="relative z-10 flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-[11px] font-bold tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {organizer}
            </span>

            {/* Live Status Pill */}
            {status === 'OPEN' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-400/25 text-emerald-100 border border-emerald-300/35">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                Live
              </span>
            ) : status === 'WAITING' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-400/25 text-amber-100 border border-amber-300/35">
                ● Waiting
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-400/25 text-rose-100 border border-rose-300/35">
                ● Closed
              </span>
            )}
          </div>

          <div className="relative z-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100/90 mb-1">
              {subtitle}
            </p>
            <h1 className="text-2xl sm:text-[26px] font-extrabold tracking-tight leading-tight">
              {title}
            </h1>
            <p className="text-xs sm:text-[13px] text-blue-100/85 mt-1.5 leading-relaxed">
              Cast your vote for your favorite choice tonight! 1 vote per device.
            </p>
          </div>

          {/* Smooth Wave Divider */}
          <svg
            className="absolute bottom-0 left-0 w-full h-5 text-[#F8FAFC]"
            preserveAspectRatio="none"
            viewBox="0 0 400 24"
            fill="currentColor"
          >
            <path d="M0,24 L0,10 Q100,24 200,10 T400,10 L400,24 Z" />
          </svg>
        </header>

        {/* Dynamic Body Content */}
        <main className="flex-1 bg-[#F8FAFC] p-4 sm:p-5 flex flex-col">
          {/* STATE 1: WAITING */}
          {status === 'WAITING' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-3 animate-fade-up">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-3xl bg-theme-soft text-theme-primary flex items-center justify-center relative z-10">
                  <Clock className="w-10 h-10" />
                </div>
                <span className="absolute inset-0 rounded-3xl bg-theme-accent/30 pulse-ring" />
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-extrabold uppercase tracking-wider mb-3">
                Voting Has Not Started
              </span>
              <h2 className="text-xl font-extrabold text-slate-900">
                Please Wait for the MC
              </h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-xs">
                The committee is getting the nominees ready. This screen will automatically refresh as soon as voting begins!
              </p>
              <button
                type="button"
                onClick={fetchStatusAndData}
                className="mt-6 px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Check Status Again
              </button>
            </div>
          )}

          {/* STATE 2: CLOSED */}
          {status === 'CLOSED' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-3 animate-fade-up">
              <div className="w-20 h-20 rounded-3xl bg-slate-200/80 text-slate-600 flex items-center justify-center mb-5">
                <Lock className="w-10 h-10" />
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-extrabold uppercase tracking-wider mb-3">
                Voting Session Closed
              </span>
              <h2 className="text-xl font-extrabold text-slate-900">Thank You!</h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-xs">
                Voting has concluded. Look up at the main stage projector for the winner reveal!
              </p>

              {votedCandidate && (
                <div className="mt-5 w-full p-3.5 rounded-2xl bg-white border border-slate-200 flex items-center gap-3 text-left shadow-sm">
                  <div className="w-14 aspect-[4/5] rounded-xl overflow-hidden shrink-0 border border-slate-100 bg-slate-100">
                    <CandidateMedia
                      photoData={votedCandidate.photo_data}
                      name={votedCandidate.name}
                      number={votedCandidate.number}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-theme-primary uppercase">
                      Your Choice
                    </p>
                    <p className="text-sm font-extrabold text-slate-900 truncate">
                      No. {String(votedCandidate.number).padStart(2, '0')} — {votedCandidate.name}
                    </p>
                    {votedCandidate.costume_theme && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {votedCandidate.costume_theme}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATE 3: ALREADY VOTED (LOCKED DEVICE) */}
          {status === 'OPEN' && hasVoted && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 px-2 animate-fade-up">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 ring-8 ring-emerald-50">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold uppercase tracking-wider mb-2">
                Vote Recorded Successfully
              </span>
              <h2 className="text-2xl font-extrabold text-slate-900">Thank You!</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-xs">
                Your vote is securely logged in the system. Your browser is locked to ensure fair voting.
              </p>

              {votedCandidate && (
                <div className="mt-5 w-full bg-white rounded-2xl p-4 border-2 border-theme-soft shadow-sm text-left">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-theme-primary">
                      Your Selected Choice
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-theme-primary text-white text-xs font-extrabold">
                      No. {String(votedCandidate.number).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3.5">
                    <div className="w-16 aspect-[4/5] rounded-xl overflow-hidden shrink-0 border border-slate-200 bg-slate-100">
                      <CandidateMedia
                        photoData={votedCandidate.photo_data}
                        name={votedCandidate.name}
                        number={votedCandidate.number}
                      />
                    </div>
                    <div className="min-w-0">
                      {votedCandidate.category && (
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold mb-1">
                          {votedCandidate.category}
                        </span>
                      )}
                      <h3 className="text-base font-extrabold text-slate-900 truncate">
                        {votedCandidate.name}
                      </h3>
                      {votedCandidate.costume_theme && (
                        <p className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
                          {votedCandidate.costume_theme}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATE 4: PIN REQUIRED & NOT UNLOCKED */}
          {status === 'OPEN' && !hasVoted && statusData?.require_pin && !pinUnlocked && (
            <div className="flex-1 flex flex-col items-center justify-center py-6 px-2 animate-fade-up">
              <div className="w-14 h-14 rounded-2xl bg-theme-soft text-theme-primary flex items-center justify-center mb-4 shadow-sm">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 text-center">
                Enter Room PIN
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 text-center mt-1.5 max-w-xs leading-relaxed">
                Please enter the 4-digit PIN announced by the MC or shown on the stage screen.
              </p>

              <form onSubmit={handleVerifyPin} className="w-full max-w-xs mt-6">
                <div
                  className={`grid grid-cols-4 gap-2.5 mb-3 ${
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
                      className="w-full h-14 text-center text-2xl font-extrabold font-mono rounded-2xl border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-theme-primary transition shadow-sm"
                      aria-label={`Digit ${idx + 1}`}
                    />
                  ))}
                </div>

                {pinError && (
                  <p className="text-center text-xs font-bold text-rose-600 mb-3 animate-fade-up">
                    Please enter all 4 digits of the PIN.
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl btn-primary text-sm font-extrabold cursor-pointer"
                >
                  Enter Voting
                </button>
              </form>
            </div>
          )}

          {/* STATE 5: OPEN & UNLOCKED -> CANDIDATE GRID */}
          {status === 'OPEN' && !hasVoted && (!statusData?.require_pin || pinUnlocked) && (
            <div className="animate-fade-up">
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Official Nominees
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Tap a photo to enlarge or click Select to vote.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-theme-soft text-theme-primary text-[11px] font-extrabold">
                  {candidates.length} Nominees
                </span>
              </div>

              {candidates.length === 0 ? (
                <div className="py-12 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-white">
                  <Sparkles className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">Nominees Are Being Prepared</p>
                  <p className="text-xs text-slate-500 mt-1">
                    The stage committee will publish active nominees shortly.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {candidates.map((cand) => (
                    <article
                      key={cand.id}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-theme-accent transition-all overflow-hidden flex flex-col"
                    >
                      {/* Photo Clickable */}
                      <div
                        onClick={() => setSelectedPhotoCand(cand)}
                        className="relative aspect-[4/5] bg-slate-100 overflow-hidden cursor-pointer group"
                        title="Tap to enlarge photo"
                      >
                        <CandidateMedia
                          photoData={cand.photo_data}
                          name={cand.name}
                          number={cand.number}
                          className="group-hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-xl bg-theme-primary text-white text-xs font-extrabold shadow-md">
                          No. {String(cand.number).padStart(2, '0')}
                        </span>
                        {cand.category && (
                          <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-slate-900/65 backdrop-blur-sm text-white text-[10px] font-bold">
                            {cand.category}
                          </span>
                        )}
                        <span className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-slate-900/55 backdrop-blur-sm text-white flex items-center justify-center">
                          <ZoomIn className="w-3.5 h-3.5" />
                        </span>
                      </div>

                      {/* Info & Select Button */}
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <div className="mb-3">
                          <h3 className="text-sm font-extrabold text-slate-900 leading-snug line-clamp-2">
                            {cand.name}
                          </h3>
                          {cand.costume_theme && (
                            <p className="text-[11px] font-semibold text-theme-primary truncate mt-0.5">
                              {cand.costume_theme}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setConfirmingCand(cand)}
                          className="w-full py-2.5 rounded-xl btn-primary text-xs font-extrabold cursor-pointer"
                        >
                          Select
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-[#F8FAFC] border-t border-slate-200/70 px-5 py-3 text-center">
          <p className="text-[11px] text-slate-400 font-medium">
            {title} • {organizer}
          </p>
        </footer>
      </div>

      {/* Modal 1: Enlarge Candidate Photo */}
      {selectedPhotoCand && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up"
          onClick={() => setSelectedPhotoCand(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-slate-100 aspect-[4/5] flex items-center justify-center overflow-hidden">
              <CandidateMedia
                photoData={selectedPhotoCand.photo_data}
                name={selectedPhotoCand.name}
                number={selectedPhotoCand.number}
              />
              <span className="absolute top-3.5 left-3.5 px-3 py-1 rounded-xl bg-theme-primary text-white text-xs font-extrabold shadow-lg">
                No. {String(selectedPhotoCand.number).padStart(2, '0')}
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
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                    {selectedPhotoCand.category}
                  </span>
                )}
                {selectedPhotoCand.costume_theme && (
                  <span className="text-xs font-bold text-theme-primary truncate">
                    {selectedPhotoCand.costume_theme}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">
                {selectedPhotoCand.name}
              </h3>
              <div className="mt-4 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedPhotoCand(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
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
                  className="flex-1 py-2.5 rounded-xl btn-primary font-bold text-xs cursor-pointer"
                >
                  Vote for This Nominee
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Confirmation Vote Modal */}
      {confirmingCand && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up"
          onClick={() => !submittingVote && setConfirmingCand(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-theme-soft text-theme-primary flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">
              Confirm Your Vote
            </h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Are you sure you want to vote for{' '}
              <strong className="text-slate-900">
                No. {String(confirmingCand.number).padStart(2, '0')} — {confirmingCand.name}
              </strong>
              ?
            </p>
            {confirmingCand.costume_theme && (
              <p className="text-xs font-semibold text-theme-primary mt-1">
                ({confirmingCand.costume_theme})
              </p>
            )}
            <div className="mt-3 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800">
              Once submitted, your choice cannot be altered.
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={submittingVote}
                onClick={() => setConfirmingCand(null)}
                className="py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingVote}
                onClick={handleConfirmVote}
                className="py-3 rounded-xl btn-primary font-bold text-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submittingVote ? 'Submitting...' : 'Confirm Vote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
