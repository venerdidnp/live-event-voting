'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CandidateMedia } from '@/components/CandidateMedia';
import {
  Camera,
  Image as ImageIcon,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  LogOut,
  Tv,
  Smartphone,
  AlertTriangle,
  RotateCcw,
  Zap,
  CheckCircle2,
  X,
  FlipHorizontal,
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

interface ResultsData {
  candidates: Candidate[];
  total_votes: number;
  anomalies: {
    duplicate_ips: Array<{ ip_hash: string; vote_count: number }>;
    unique_user_agents: number;
    recent_votes: Array<{
      id: string;
      created_at: string;
      candidate_number: number;
      candidate_name: string;
      ip_hash: string;
    }>;
  };
}

const CATEGORY_PRESETS = ['Participant', 'Guest', 'VIP', 'General'];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [resultsData, setResultsData] = useState<ResultsData | null>(null);

  // Settings form transient state
  const [eventTitle, setEventTitle] = useState('');
  const [eventSubtitle, setEventSubtitle] = useState('');
  const [organizerLabel, setOrganizerLabel] = useState('');
  const [roomPin, setRoomPin] = useState('2026');
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [savingSettings, setSavingSettings] = useState(false);

  // Quick-Add Nominee transient state
  const [addNumber, setAddNumber] = useState('');
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState('Participant');
  const [addTheme, setAddTheme] = useState('');
  const [addAsDraft, setAddAsDraft] = useState(false);
  const [addPhotoDataUrl, setAddPhotoDataUrl] = useState<string | null>(null);
  const [addCompressBadge, setAddCompressBadge] = useState<string | null>(null);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edit Nominee Modal transient state
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('Participant');
  const [editTheme, setEditTheme] = useState('');
  const [editPhotoDataUrl, setEditPhotoDataUrl] = useState<string | null>(null);
  const [editCompressBadge, setEditCompressBadge] = useState<string | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Delete & Danger Modals
  const [deletingCand, setDeletingCand] = useState<Candidate | null>(null);
  const [showResetVotesModal, setShowResetVotesModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');

  // WebRTC Live Camera Modal
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'add' | 'edit'>('add');
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [cameraFlash, setCameraFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Initial Authentication Check
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

  // 2. Fetch Data once authenticated
  const loadAdminData = async () => {
    try {
      const [settRes, candRes, resRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/candidates'),
        fetch('/api/admin/results'),
      ]);

      if (settRes.ok) {
        const settData = await settRes.json();
        setSettings(settData.settings);
        setEventTitle(settData.settings.event_title);
        setEventSubtitle(settData.settings.event_subtitle);
        setOrganizerLabel(settData.settings.organizer_label);
        setRoomPin(settData.settings.room_pin);
        setTimerMinutes(settData.settings.timer_minutes);
      }

      if (candRes.ok) {
        const cands = await candRes.json();
        setCandidates(cands.candidates || []);

        // Auto calculate next number if addNumber is empty
        if (!addNumber && cands.candidates?.length) {
          const maxNum = Math.max(...cands.candidates.map((c: Candidate) => c.number), 0);
          setAddNumber(String(maxNum + 1).padStart(2, '0'));
        } else if (!addNumber) {
          setAddNumber('01');
        }
      }

      if (resRes.ok) {
        const resData = await resRes.json();
        setResultsData(resData);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  };

  useEffect(() => {
    if (authenticated) {
      loadAdminData();
      const interval = setInterval(loadAdminData, 5000); // 5s auto-polling
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  // Client-side Canvas 4:5 Crop & Compression (<80 KB WebP)
  const processImageCompression = (
    source: HTMLImageElement | HTMLVideoElement,
    srcWidth: number,
    srcHeight: number,
    target: 'add' | 'edit'
  ) => {
    const targetRatio = 4 / 5;
    const maxH = 720;
    const srcRatio = srcWidth / srcHeight;

    let sx = 0,
      sy = 0,
      sw = srcWidth,
      sh = srcHeight;
    if (srcRatio > targetRatio) {
      sw = srcHeight * targetRatio;
      sx = (srcWidth - sw) / 2;
    } else {
      sh = srcWidth / targetRatio;
      sy = Math.max(0, (srcHeight - sh) * 0.35); // slightly upper bias for faces
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

    const byteSize = Math.round((dataUrl.length * 3) / 4);
    const badge = `Compressed: ${Math.round(byteSize / 1024)} KB (WebP 4:5)`;

    if (target === 'add') {
      setAddPhotoDataUrl(dataUrl);
      setAddCompressBadge(badge);
    } else {
      setEditPhotoDataUrl(dataUrl);
      setEditCompressBadge(badge);
    }

    showToast(`Photo compressed to ${Math.round(byteSize / 1024)} KB!`, 'success');
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'add' | 'edit') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        processImageCompression(img, img.naturalWidth, img.naturalHeight, target);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // WebRTC Camera
  const startCamera = async (facing: 'environment' | 'user') => {
    stopCamera();
    setCameraError(false);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1600 } },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setCameraError(true);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
  };

  const openCamera = (target: 'add' | 'edit') => {
    setCameraTarget(target);
    setShowCameraModal(true);
    startCamera(cameraFacing);
  };

  const closeCamera = () => {
    stopCamera();
    setShowCameraModal(false);
  };

  const flipCamera = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    // Flash animation
    setCameraFlash(true);
    setTimeout(() => setCameraFlash(false), 300);

    processImageCompression(video, video.videoWidth, video.videoHeight, cameraTarget);
    setTimeout(() => {
      closeCamera();
    }, 200);
  };

  // Fallback Camera input
  const handleNativeCameraFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        processImageCompression(img, img.naturalWidth, img.naturalHeight, cameraTarget);
        closeCamera();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Save Settings
  const handleSaveSettings = async (partialUpdate?: Partial<EventSettings>) => {
    setSavingSettings(true);
    try {
      const payload = partialUpdate || {
        event_title: eventTitle,
        event_subtitle: eventSubtitle,
        organizer_label: organizerLabel,
        room_pin: roomPin,
        timer_minutes: timerMinutes,
      };

      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        showToast('Event settings saved successfully!', 'success');
      } else {
        showToast('Failed to save settings.', 'error');
      }
    } catch {
      showToast('Network error while saving settings.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Status Switcher
  const handleSetStatus = async (status: 'WAITING' | 'OPEN' | 'CLOSED') => {
    await handleSaveSettings({ status });
  };

  // Room PIN toggle
  const handleToggleRequirePin = async () => {
    if (!settings) return;
    await handleSaveSettings({ require_pin: !settings.require_pin });
  };

  // Add Candidate
  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) {
      showToast('Candidate name is required.', 'error');
      return;
    }
    if (!addPhotoDataUrl) {
      showToast('Please capture or select a photo for the nominee.', 'error');
      return;
    }

    setSubmittingAdd(true);
    try {
      const res = await fetch('/api/admin/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: parseInt(addNumber, 10) || undefined,
          name: addName.trim(),
          category: addCategory,
          costume_theme: addTheme.trim() || null,
          photo_data: addPhotoDataUrl,
          is_active: !addAsDraft,
        }),
      });

      if (res.ok) {
        showToast(
          addAsDraft
            ? `Nominee saved as Draft.`
            : `Nominee successfully published live!`,
          'success'
        );
        // Reset form
        setAddName('');
        setAddTheme('');
        setAddPhotoDataUrl(null);
        setAddCompressBadge(null);
        setAddAsDraft(false);
        await loadAdminData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to add candidate.', 'error');
      }
    } catch {
      showToast('Error saving nominee.', 'error');
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Edit Candidate
  const openEditModal = (c: Candidate) => {
    setEditingCandidate(c);
    setEditNumber(String(c.number));
    setEditName(c.name);
    setEditCategory(c.category || 'Participant');
    setEditTheme(c.costume_theme || '');
    setEditPhotoDataUrl(c.photo_data);
    setEditCompressBadge(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCandidate) return;

    setSubmittingEdit(true);
    try {
      const res = await fetch(`/api/admin/candidates/${editingCandidate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: parseInt(editNumber, 10),
          name: editName.trim(),
          category: editCategory,
          costume_theme: editTheme.trim() || null,
          photo_data: editPhotoDataUrl,
        }),
      });

      if (res.ok) {
        showToast('Nominee updated successfully!', 'success');
        setEditingCandidate(null);
        await loadAdminData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update nominee.', 'error');
      }
    } catch {
      showToast('Error updating nominee.', 'error');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Toggle Draft / Active
  const handleToggleCandidateActive = async (cand: Candidate) => {
    try {
      const res = await fetch(`/api/admin/candidates/${cand.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !cand.is_active }),
      });
      if (res.ok) {
        showToast(
          !cand.is_active ? `No. ${cand.number} is now Live.` : `No. ${cand.number} set to Draft.`,
          'info'
        );
        await loadAdminData();
      }
    } catch {
      showToast('Failed to change nominee status.', 'error');
    }
  };

  // Delete Candidate
  const handleDeleteCandidate = async () => {
    if (!deletingCand) return;
    try {
      const res = await fetch(`/api/admin/candidates/${deletingCand.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Nominee removed.', 'info');
        setDeletingCand(null);
        await loadAdminData();
      }
    } catch {
      showToast('Error deleting nominee.', 'error');
    }
  };

  // Reset Votes
  const handleExecuteResetVotes = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') return;
    try {
      const res = await fetch('/api/admin/reset-votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET' }),
      });
      if (res.ok) {
        showToast('All votes successfully reset to 0.', 'success');
        setShowResetVotesModal(false);
        setResetConfirmText('');
        await loadAdminData();
      }
    } catch {
      showToast('Error resetting votes.', 'error');
    }
  };

  // Clear All Nominees
  const handleExecuteClearAll = async () => {
    if (clearConfirmText.trim().toUpperCase() !== 'CLEAR') return;
    try {
      const res = await fetch('/api/admin/clear-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'CLEAR' }),
      });
      if (res.ok) {
        showToast('All nominees cleared.', 'success');
        setShowClearAllModal(false);
        setClearConfirmText('');
        setAddNumber('01');
        await loadAdminData();
      }
    } catch {
      showToast('Error clearing nominees.', 'error');
    }
  };

  // Logout
  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.push('/admin/login');
  };

  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalVotes = resultsData?.total_votes || 0;
  const activeNomineesCount = candidates.filter((c) => c.is_active).length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[80] max-w-sm w-full px-4 animate-fade-up">
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
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <nav className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-theme-primary text-white font-extrabold text-xs flex items-center justify-center shadow">
              ADM
            </span>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight">
                Venue Admin Control
              </h1>
              <p className="text-[11px] text-slate-400">
                {settings?.event_title || 'Live Event'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition"
              title="Open Voter HP View"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voter Screen</span>
            </a>
            <a
              href="/display"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-theme-primary hover:opacity-90 text-xs font-bold text-white flex items-center gap-1.5 transition shadow"
              title="Open Stage Projector View"
            >
              <Tv className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Projector</span>
            </a>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 text-slate-400 transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* SECTION 1: EVENT IDENTITY & SESSION STATUS CONTROL */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-theme-soft text-theme-primary text-[11px] font-extrabold uppercase tracking-wider">
                  ⚡ Live Session Status
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                    settings?.status === 'OPEN'
                      ? 'bg-emerald-100 text-emerald-800'
                      : settings?.status === 'WAITING'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  ● {settings?.status || 'WAITING'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Event Setup & Session Switch
              </h2>
            </div>

            {/* Quick Counters */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className="px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/70 text-center">
                <p className="text-[10px] font-bold uppercase text-slate-500">Total Votes</p>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
                  {totalVotes.toLocaleString()}
                </p>
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/70 text-center">
                <p className="text-[10px] font-bold uppercase text-slate-500">Live Nominees</p>
                <p className="text-xl sm:text-2xl font-extrabold text-theme-primary leading-tight">
                  {activeNomineesCount}/{candidates.length}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Controls Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5">
            {/* Status Switcher (3 Buttons) */}
            <div className="lg:col-span-5">
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                Voting Session Mode
              </label>
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 rounded-2xl">
                {(['WAITING', 'OPEN', 'CLOSED'] as const).map((st) => {
                  const isActive = settings?.status === st;
                  const activeClass =
                    st === 'OPEN'
                      ? 'bg-emerald-600 text-white shadow'
                      : st === 'WAITING'
                      ? 'bg-amber-500 text-white shadow'
                      : 'bg-rose-600 text-white shadow';
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleSetStatus(st)}
                      className={`py-3 px-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                        isActive
                          ? activeClass
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PIN Control */}
            <div className="lg:col-span-4 flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleRequirePin}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    settings?.require_pin ? 'bg-theme-primary' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      settings?.require_pin ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <div>
                  <p className="text-xs font-extrabold text-slate-800">Room PIN</p>
                  <p className="text-[11px] text-slate-500">
                    {settings?.require_pin ? 'Voters must input PIN' : 'Disabled (Direct vote)'}
                  </p>
                </div>
              </div>

              <div
                className={`flex items-center gap-1.5 ml-auto ${
                  !settings?.require_pin ? 'opacity-40 pointer-events-none' : ''
                }`}
              >
                <input
                  type="text"
                  maxLength={4}
                  value={roomPin}
                  onChange={(e) => setRoomPin(e.target.value.replace(/\D/g, ''))}
                  className="w-20 px-2.5 py-2 rounded-xl border border-slate-300 text-sm font-mono font-extrabold tracking-widest text-center text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleSaveSettings({ room_pin: roomPin })}
                  className="px-3 py-2 rounded-xl bg-theme-primary text-white text-xs font-bold hover:opacity-90 transition cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Timer Presets */}
            <div className="lg:col-span-3 flex items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div>
                <p className="text-xs font-extrabold text-slate-800">Timer Preset</p>
                <p className="text-[11px] text-slate-500">For stage screen</p>
              </div>
              <div className="flex items-center gap-1.5">
                {[3, 5, 10].map((min) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => {
                      setTimerMinutes(min);
                      handleSaveSettings({ timer_minutes: min });
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      settings?.timer_minutes === min
                        ? 'bg-theme-primary text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {min}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Event Identity Fields Accordion/Form */}
          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Event Title
              </label>
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-900"
                placeholder="Live Event Voting"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Event Subtitle / Award Category
              </label>
              <input
                type="text"
                value={eventSubtitle}
                onChange={(e) => setEventSubtitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-900"
                placeholder="Audience Choice Award"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Organizer Label
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={organizerLabel}
                  onChange={(e) => setOrganizerLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-900"
                  placeholder="Event Committee"
                />
                <button
                  type="button"
                  disabled={savingSettings}
                  onClick={() => handleSaveSettings()}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: 2-COLUMN NOMINATIONS & LIVE RECAP */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: QUICK NOMINATION CAPTURE */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm">
            <div className="mb-4">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-6 rounded-full bg-theme-primary" />
                Quick Nomination Capture
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Snap contestant photos on stage and publish instantly to voter phones.
              </p>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="space-y-4">
              {/* Photo Input (WebRTC Camera + File Upload) */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wide mb-2">
                  1. Nominee Photo (Auto-Crop 4:5 & WebP)
                </label>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => openCamera('add')}
                    className="flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-2xl bg-theme-soft hover:bg-theme-soft-strong border-2 border-theme-soft text-theme-dark transition active:scale-[0.98] cursor-pointer"
                  >
                    <span className="w-10 h-10 rounded-xl bg-theme-primary text-white flex items-center justify-center shadow-md">
                      <Camera className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-extrabold text-center leading-tight">
                      Open Live Camera
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">Venue camera</span>
                  </button>

                  <label className="flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-300 text-slate-700 transition active:scale-[0.98] cursor-pointer">
                    <span className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-sm">
                      <ImageIcon className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-extrabold text-center leading-tight">
                      Upload from Gallery
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">Auto-compress</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleGalleryUpload(e, 'add')}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Cropped Photo Preview */}
                {addPhotoDataUrl && (
                  <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 animate-fade-up flex items-center gap-3">
                    <div className="w-16 aspect-[4/5] rounded-xl overflow-hidden border border-slate-200 bg-slate-200 shrink-0">
                      <img
                        src={addPhotoDataUrl}
                        alt="Nominee preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                        {addCompressBadge || 'Ready ⚡'}
                      </span>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => openCamera('add')}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer"
                        >
                          Retake
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddPhotoDataUrl(null);
                            setAddCompressBadge(null);
                          }}
                          className="px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 text-[11px] font-bold cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Number and Name */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4">
                  <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                    No.
                  </label>
                  <input
                    type="number"
                    required
                    value={addNumber}
                    onChange={(e) => setAddNumber(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl border border-slate-300 bg-white text-base font-extrabold font-mono text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-8">
                  <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                    Name / Callout <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g. Alex Johnson"
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Category Chips */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                  Category Chip
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_PRESETS.map((cat) => {
                    const active = addCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setAddCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          active
                            ? 'bg-theme-primary text-white border-theme-primary shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Theme / Description */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                  Costume / Performance Theme <span className="text-slate-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={addTheme}
                  onChange={(e) => setAddTheme(e.target.value)}
                  placeholder="e.g. Cyberpunk Warrior, Classic Glamour..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Draft Toggle */}
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-xs">
                  <p className="font-bold text-slate-800">Save as Draft</p>
                  <p className="text-[11px] text-slate-500">Hide from voters until published.</p>
                </div>
                <input
                  type="checkbox"
                  checked={addAsDraft}
                  onChange={(e) => setAddAsDraft(e.target.checked)}
                  className="w-5 h-5 rounded accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submittingAdd}
                className="w-full py-4 px-5 rounded-2xl btn-primary text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                <span>
                  {submittingAdd
                    ? 'Saving...'
                    : addAsDraft
                    ? 'Save as Draft'
                    : 'Publish Nominee Now'}
                </span>
              </button>
            </form>
          </div>

          {/* RIGHT COLUMN: NOMINEE CRUD LIST & RECAP */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Candidate CRUD List */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <span className="w-2.5 h-6 rounded-full bg-theme-primary" />
                    Nominee Management
                  </h3>
                  <p className="text-xs text-slate-500">
                    Edit details, retake photos, toggle publish state, or remove.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-theme-soft text-theme-primary text-xs font-extrabold">
                  {candidates.length} Nominees
                </span>
              </div>

              {candidates.length === 0 ? (
                <div className="py-10 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50">
                  <p className="text-sm font-bold text-slate-700">No nominees registered yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Use the Quick Nomination form on the left to capture your first contestant.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {candidates.map((cand) => (
                    <div
                      key={cand.id}
                      className={`p-3 rounded-2xl border transition flex items-center gap-3 ${
                        cand.is_active
                          ? 'bg-white border-slate-200 hover:border-theme-accent'
                          : 'bg-slate-50/90 border-dashed border-slate-300 opacity-80'
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="relative w-14 sm:w-16 aspect-[4/5] rounded-xl overflow-hidden shrink-0 border border-slate-200 bg-slate-100">
                        <CandidateMedia
                          photoData={cand.photo_data}
                          name={cand.name}
                          number={cand.number}
                        />
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-slate-900/80 text-white text-[10px] font-extrabold">
                          {String(cand.number).padStart(2, '0')}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              cand.is_active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {cand.is_active ? '● Live' : '○ Draft'}
                          </span>
                          {cand.category && (
                            <span className="px-2 py-0.5 rounded-full bg-theme-soft text-theme-primary text-[10px] font-bold">
                              {cand.category}
                            </span>
                          )}
                          <span className="text-[11px] font-extrabold text-slate-700 ml-auto sm:ml-0">
                            {cand.votes || 0} votes
                          </span>
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-900 truncate">
                          {cand.name}
                        </h4>
                        {cand.costume_theme && (
                          <p className="text-xs text-slate-500 truncate">
                            {cand.costume_theme}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleCandidateActive(cand)}
                          className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            cand.is_active
                              ? 'bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border-slate-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                          }`}
                          title={cand.is_active ? 'Hide (Set to Draft)' : 'Publish Live'}
                        >
                          {cand.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(cand)}
                          className="p-2 rounded-xl bg-slate-50 hover:bg-theme-soft text-slate-600 hover:text-theme-primary border border-slate-200 transition cursor-pointer"
                          title="Edit nominee"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCand(cand)}
                          className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 transition cursor-pointer"
                          title="Delete nominee"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Danger Zone Actions */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowClearAllModal(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Clear All Nominees
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetVotesModal(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition cursor-pointer"
                >
                  Reset Trial Votes
                </button>
              </div>
            </div>

            {/* Live Rekap Suara (Bar Chart & Anomaly Indicators) */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <span className="w-2.5 h-6 rounded-full bg-theme-primary" />
                    Live Voting Results
                  </h3>
                  <p className="text-xs text-slate-500">Auto-polls every 5 seconds.</p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-extrabold border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {totalVotes.toLocaleString()} Votes
                </span>
              </div>

              {/* Bar Chart */}
              <div className="space-y-3.5">
                {resultsData?.candidates?.map((c, idx) => {
                  const votes = c.votes || 0;
                  const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 1000) / 10 : 0;
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 rounded-lg border text-[11px] font-extrabold flex items-center justify-center shrink-0 bg-slate-100 text-slate-700 border-slate-200">
                            #{idx + 1}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-theme-soft text-theme-primary text-[11px] font-extrabold shrink-0">
                            No. {String(c.number).padStart(2, '0')}
                          </span>
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {c.name}
                          </span>
                          {!c.is_active && (
                            <span className="text-[10px] font-bold text-slate-400 shrink-0">
                              (Draft)
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-1 shrink-0">
                          <span className="text-sm font-extrabold text-slate-900">{votes}</span>
                          <span className="text-xs font-semibold text-slate-400">({pct}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${Math.max(pct, votes > 0 ? 3 : 0)}%`,
                            background:
                              'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Anomaly & Device Analytics */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Network & Fraud Indicators
                  </p>
                  <span className="text-xs font-bold text-slate-500">
                    {resultsData?.anomalies?.unique_user_agents || 0} Unique Device Types
                  </span>
                </div>

                {resultsData?.anomalies?.duplicate_ips &&
                resultsData.anomalies.duplicate_ips.length > 0 ? (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs">
                    <p className="font-bold text-amber-900 mb-1">
                      Venue Wi-Fi / NAT Multi-Vote Activity:
                    </p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Several votes originate from the same external IP (common on venue shared Wi-Fi). Device-level unique tokens and cookies protect against repeat votes on individual devices.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    No abnormal IP clustering detected.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: EDIT CANDIDATE */}
      {editingCandidate && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up"
          onClick={() => !submittingEdit && setEditingCandidate(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-900">Edit Nominee Details</h3>
              <button
                type="button"
                onClick={() => setEditingCandidate(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Photo & Retake */}
              <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-16 aspect-[4/5] rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-200">
                  <CandidateMedia
                    photoData={editPhotoDataUrl}
                    name={editName}
                    number={editNumber}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <p className="text-xs font-extrabold text-slate-800">Change Photo</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => openCamera('edit')}
                      className="px-2.5 py-1.5 rounded-xl bg-theme-primary text-white text-[11px] font-bold cursor-pointer"
                    >
                      📷 Camera
                    </button>
                    <label className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-[11px] font-bold cursor-pointer">
                      🖼 Gallery
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleGalleryUpload(e, 'edit')}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {editCompressBadge && (
                    <p className="text-[11px] font-bold text-emerald-700">
                      {editCompressBadge}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">No.</label>
                  <input
                    type="number"
                    required
                    value={editNumber}
                    onChange={(e) => setEditNumber(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-extrabold text-center"
                  />
                </div>
                <div className="col-span-8">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_PRESETS.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setEditCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        editCategory === cat
                          ? 'bg-theme-primary text-white border-theme-primary'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Theme (Optional)
                </label>
                <input
                  type="text"
                  value={editTheme}
                  onChange={(e) => setEditTheme(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCandidate(null)}
                  className="py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="py-3 rounded-xl btn-primary font-extrabold text-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: WEBRTC LIVE CAMERA VIEWFINDER */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 text-white rounded-3xl max-w-md w-full overflow-hidden border border-slate-700 shadow-2xl flex flex-col">
            <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <h3 className="text-sm font-extrabold">Live Stage Viewfinder</h3>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative bg-black aspect-[4/5] w-full flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraError ? 'hidden' : 'block'}`}
              />

              {/* 4:5 Guide Overlay */}
              {!cameraError && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-5 border-2 border-white/35 rounded-2xl" />
                  <span className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[11px] font-bold text-white">
                    4:5 Portrait Frame • Auto-Compress
                  </span>
                </div>
              )}

              {/* Flash effect */}
              {cameraFlash && (
                <div className="absolute inset-0 bg-white z-20 animate-flash pointer-events-none" />
              )}

              {/* Fallback Box */}
              {cameraError && (
                <div className="px-6 text-center max-w-xs">
                  <p className="text-sm font-extrabold text-white">Web Camera Unavailable</p>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Browser camera permission was denied or device has no direct camera stream.
                  </p>
                  <label className="mt-5 flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-theme-primary text-white text-xs font-extrabold cursor-pointer">
                    <Camera className="w-4 h-4" />
                    <span>Open Phone Native Camera</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleNativeCameraFallback}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={flipCamera}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                title="Switch Camera Facing"
              >
                <FlipHorizontal className="w-4 h-4" />
                <span>Flip</span>
              </button>

              <button
                type="button"
                disabled={cameraError}
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full bg-white hover:bg-slate-100 p-1.5 shadow-xl transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                aria-label="Capture photo"
              >
                <span className="w-full h-full rounded-full border-4 border-slate-900 bg-white block" />
              </button>

              <div className="w-12" />
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CANDIDATE */}
      {deletingCand && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up"
          onClick={() => setDeletingCand(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-slate-900">Delete Nominee?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Are you sure you want to remove{' '}
              <strong>
                No. {String(deletingCand.number).padStart(2, '0')} — {deletingCand.name}
              </strong>
              ? All votes associated with this nominee will be deleted.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingCand(null)}
                className="py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCandidate}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
              >
                Delete Nominee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: RESET TRIAL VOTES */}
      {showResetVotesModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up"
          onClick={() => setShowResetVotesModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">Reset Trial Votes?</h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              All vote counts will be returned to <strong>0</strong>. All candidate profiles will remain intact.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Type <span className="font-mono text-rose-600">RESET</span> to confirm:
              </label>
              <input
                type="text"
                placeholder="RESET"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowResetVotesModal(false);
                  setResetConfirmText('');
                }}
                className="py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetConfirmText.trim().toUpperCase() !== 'RESET'}
                onClick={handleExecuteResetVotes}
                className="py-2.5 rounded-xl bg-rose-600 disabled:bg-rose-300 text-white font-bold text-xs cursor-pointer disabled:cursor-not-allowed"
              >
                Reset Votes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CLEAR ALL NOMINEES */}
      {showClearAllModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up"
          onClick={() => setShowClearAllModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">Clear All Nominees?</h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              This will permanently delete all nominees and their votes so you can start fresh from <strong>No. 01</strong>.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Type <span className="font-mono text-rose-600">CLEAR</span> to confirm:
              </label>
              <input
                type="text"
                placeholder="CLEAR"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowClearAllModal(false);
                  setClearConfirmText('');
                }}
                className="py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearConfirmText.trim().toUpperCase() !== 'CLEAR'}
                onClick={handleExecuteClearAll}
                className="py-2.5 rounded-xl bg-rose-600 disabled:bg-rose-300 text-white font-bold text-xs cursor-pointer disabled:cursor-not-allowed"
              >
                Clear Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
