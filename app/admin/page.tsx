'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CandidateMedia } from '@/components/CandidateMedia';
import {
  Camera,
  Image as ImageIcon,
  Pencil,
  Trash2,
  LogOut,
  Tv,
  Smartphone,
  AlertTriangle,
  RotateCcw,
  Zap,
  CheckCircle2,
  X,
  FlipHorizontal,
  Play,
  Square,
  Plus,
  RefreshCw,
  Copy,
  Check,
  BarChart3,
  Clock,
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
  const [refreshing, setRefreshing] = useState(false);

  // Settings form transient state (protected against background polling overwrites)
  const [eventTitle, setEventTitle] = useState('');
  const [eventSubtitle, setEventSubtitle] = useState('');
  const [organizerLabel, setOrganizerLabel] = useState('');
  const [roomPin, setRoomPin] = useState('2026');
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [savingSettings, setSavingSettings] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const initialSettingsLoaded = useRef(false);

  // Live timer countdown state
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // Add Nominee Modal & transient state
  const [showAddModal, setShowAddModal] = useState(false);
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
  const loadAdminData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [settRes, candRes, resRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/candidates'),
        fetch('/api/admin/results'),
      ]);

      if (settRes.ok) {
        const settData = await settRes.json();
        setSettings(settData.settings);
        // Only populate controlled form inputs on initial load so typing is never overwritten
        if (!initialSettingsLoaded.current) {
          setEventTitle(settData.settings.event_title || '');
          setEventSubtitle(settData.settings.event_subtitle || '');
          setOrganizerLabel(settData.settings.organizer_label || '');
          setRoomPin(settData.settings.room_pin || '2026');
          setTimerMinutes(settData.settings.timer_minutes || 5);
          initialSettingsLoaded.current = true;
        }
      }

      if (candRes.ok) {
        const cands = await candRes.json();
        setCandidates(cands.candidates || []);

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

      if (isManual) showToast('Dashboard refreshed', 'info');
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (authenticated) {
      loadAdminData();
      const interval = setInterval(() => loadAdminData(false), 5000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  // Live countdown ticker in Admin
  useEffect(() => {
    if (settings?.status === 'OPEN' && settings.ends_at) {
      const updateTimer = () => {
        const end = new Date(settings.ends_at!).getTime();
        const diff = Math.max(0, Math.floor((end - Date.now()) / 1000));
        setRemainingSeconds(diff);
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setRemainingSeconds(null);
    }
  }, [settings?.status, settings?.ends_at]);

  const formatTimerString = (sec: number | null) => {
    if (sec === null) return `${String(timerMinutes).padStart(2, '0')}:00`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

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
      sy = Math.max(0, (srcHeight - sh) * 0.35);
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

    setCameraFlash(true);
    setTimeout(() => setCameraFlash(false), 300);

    processImageCompression(video, video.videoWidth, video.videoHeight, cameraTarget);
    setTimeout(() => {
      closeCamera();
    }, 200);
  };

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
  const handleSaveSettings = async (
    partialUpdate?: Partial<EventSettings> & { extend_minutes?: number },
    customToast?: string
  ) => {
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
        if (!partialUpdate) {
          setEventTitle(data.settings.event_title || '');
          setEventSubtitle(data.settings.event_subtitle || '');
          setOrganizerLabel(data.settings.organizer_label || '');
          setRoomPin(data.settings.room_pin || '2026');
          setTimerMinutes(data.settings.timer_minutes || 5);
        }
        showToast(customToast || 'Settings saved successfully!', 'success');
      } else {
        showToast('Failed to save settings.', 'error');
      }
    } catch {
      showToast('Failed to connect to server.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Dedicated Session Workflow Actions
  const handleStartVoting = async () => {
    await handleSaveSettings(
      {
        status: 'OPEN',
        timer_minutes: timerMinutes,
      },
      `Voting opened (${timerMinutes} min timer started)!`
    );
  };

  const handleFinishVotingNow = async () => {
    await handleSaveSettings(
      {
        status: 'CLOSED',
        ends_at: null,
      },
      'Voting closed! Winners revealed on stage display.'
    );
  };

  const handleResetToWaiting = async () => {
    await handleSaveSettings(
      {
        status: 'WAITING',
        ends_at: null,
      },
      'Session reset to WAITING mode (Stage shows QR code).'
    );
  };

  const handleExtendTimer = async (mins: number) => {
    await handleSaveSettings(
      {
        extend_minutes: mins,
      },
      `Added +${mins} minute${mins > 1 ? 's' : ''} to countdown timer!`
    );
  };

  const handleSetStatus = async (status: 'WAITING' | 'OPEN' | 'CLOSED') => {
    if (status === 'OPEN') {
      await handleStartVoting();
    } else if (status === 'CLOSED') {
      await handleFinishVotingNow();
    } else {
      await handleResetToWaiting();
    }
  };

  const handleToggleRequirePin = async () => {
    if (!settings) return;
    await handleSaveSettings(
      { require_pin: !settings.require_pin },
      !settings.require_pin ? 'Room PIN enabled' : 'Room PIN disabled'
    );
  };

  const handleCopyPin = () => {
    navigator.clipboard?.writeText(roomPin || settings?.room_pin || '2026');
    setCopiedPin(true);
    showToast('Room PIN copied', 'info');
    setTimeout(() => setCopiedPin(false), 2000);
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
          addAsDraft ? 'Nominee saved as Draft.' : 'Nominee published live!',
          'success'
        );
        setAddName('');
        setAddTheme('');
        setAddPhotoDataUrl(null);
        setAddCompressBadge(null);
        setAddAsDraft(false);
        setAddNumber('');
        setShowAddModal(false);
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
          !cand.is_active ? `No. ${cand.number} is now Active.` : `No. ${cand.number} set to Draft.`,
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

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.push('/admin/login');
  };

  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 border-4 border-theme-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalVotes = resultsData?.total_votes || 0;
  const activeNomineesCount = candidates.filter((c) => c.is_active).length;
  const currentStatus = settings?.status || 'WAITING';
  const duplicateIpCount = resultsData?.anomalies?.duplicate_ips?.length || 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-[family-name:var(--font-inter)] text-[#0F172A] pb-16">
      {/* Bottom Pill Toast (Superdesign) */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] rounded-full px-5 py-3 text-sm font-semibold text-white shadow-xl flex items-center gap-2 animate-fade-up ${
            toastType === 'error'
              ? 'bg-rose-600'
              : toastType === 'success'
              ? 'bg-[#0F172A]'
              : 'bg-slate-800'
          }`}
        >
          {toastType === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : toastType === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-200 shrink-0" />
          ) : null}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sticky White Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[76px] max-w-[1360px] items-center justify-between px-4 sm:px-8 gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-theme-primary truncate">
              {settings?.event_title || 'Live Event Voting'}
            </p>
            <h1 className="mt-0.5 text-lg sm:text-xl font-bold tracking-tight truncate">
              Committee Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Status Pill */}
            <span
              className={`hidden md:inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold ${
                currentStatus === 'OPEN'
                  ? 'bg-emerald-50 text-emerald-700'
                  : currentStatus === 'WAITING'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  currentStatus === 'OPEN'
                    ? 'bg-green-500 pulse-dot'
                    : currentStatus === 'WAITING'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
              {currentStatus === 'OPEN'
                ? 'Voting Open'
                : currentStatus === 'WAITING'
                ? 'Waiting'
                : 'Voting Closed'}
            </span>

            {/* Quick Links */}
            <Link
              href="/admin/capture"
              className="flex h-10 items-center gap-1.5 rounded-full border border-slate-200 px-3.5 text-xs font-semibold text-slate-600 transition hover:border-theme-primary hover:text-theme-primary"
              title="Open Mobile Quick Capture Camera"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Quick Capture</span>
            </Link>

            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="flex h-10 items-center gap-1.5 rounded-full border border-slate-200 px-3.5 text-xs font-semibold text-slate-600 transition hover:border-theme-primary hover:text-theme-primary"
              title="Open Voter HP Screen"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voter Screen</span>
            </a>

            <a
              href="/display"
              target="_blank"
              rel="noreferrer"
              className="flex h-10 items-center gap-1.5 rounded-full bg-theme-primary px-3.5 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(0,111,214,0.22)] transition hover:bg-theme-dark"
              title="Open Stage Projector View"
            >
              <Tv className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Projector</span>
            </a>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => loadAdminData(true)}
              aria-label="Refresh dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-theme-primary hover:text-theme-primary cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Sign Out */}
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign Out"
              title="Sign Out"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1360px] px-4 sm:px-8 py-7 space-y-7">
        {/* SECTION 1: 3-COLUMN UNIFIED CONTROL STRIP */}
        <section className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 rounded-[24px] bg-white shadow-[0_14px_38px_rgba(15,23,42,0.07),0_2px_8px_rgba(15,23,42,0.03)]">
          {/* Column 1: Session State & Quick Action */}
          <div className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Session State
                </p>
                <button
                  type="button"
                  onClick={() => setShowResetVotesModal(true)}
                  className="rounded-full border border-red-200 px-3 py-1.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 cursor-pointer"
                >
                  Reset Session
                </button>
              </div>

              {/* Segmented State Pill */}
              <div className="mt-4 flex rounded-full bg-slate-100 p-1">
                {(['WAITING', 'OPEN', 'CLOSED'] as const).map((st) => {
                  const isActive = currentStatus === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleSetStatus(st)}
                      disabled={savingSettings}
                      className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition cursor-pointer disabled:opacity-60 ${
                        isActive
                          ? 'bg-theme-primary text-white shadow'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3.5 flex items-center gap-2 text-xs text-slate-500">
                <span
                  className={`h-2 w-2 rounded-full ${
                    currentStatus === 'OPEN'
                      ? 'bg-green-500 pulse-dot'
                      : currentStatus === 'WAITING'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                />
                <span>
                  {currentStatus === 'OPEN'
                    ? 'Session is live and accepting votes'
                    : currentStatus === 'WAITING'
                    ? 'Stage displays QR code only (Waiting)'
                    : 'Voting closed — winners revealed on stage'}
                </span>
              </div>
            </div>

            {/* Mission Control Contextual Action */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              {currentStatus === 'WAITING' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[1, 2, 3, 5, 10].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setTimerMinutes(m);
                          handleSaveSettings({ timer_minutes: m }, `Timer set to ${m} minutes`);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition cursor-pointer ${
                          timerMinutes === m
                            ? 'border-theme-primary bg-theme-soft text-theme-primary'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleStartVoting}
                    disabled={savingSettings}
                    className="w-full min-h-[44px] rounded-full bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-sm transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Buka Sesi Voting ({timerMinutes} Menit)</span>
                  </button>
                </div>
              )}

              {currentStatus === 'OPEN' && (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleFinishVotingNow}
                    disabled={savingSettings}
                    className="w-full min-h-[44px] rounded-full bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white shadow-sm transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Selesaikan Voting Sekarang (Finish)</span>
                  </button>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">Perpanjang waktu:</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleExtendTimer(1)}
                        className="px-3 py-1 rounded-full border border-slate-200 hover:border-theme-primary hover:text-theme-primary text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> 1m
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExtendTimer(2)}
                        className="px-3 py-1 rounded-full border border-slate-200 hover:border-theme-primary hover:text-theme-primary text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> 2m
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {currentStatus === 'CLOSED' && (
                <button
                  type="button"
                  onClick={handleResetToWaiting}
                  disabled={savingSettings}
                  className="w-full min-h-[44px] rounded-full border border-slate-200 bg-white hover:border-theme-primary hover:text-theme-primary text-xs font-semibold text-slate-700 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset ke Mode Menunggu (QR Stage)</span>
                </button>
              )}
            </div>
          </div>

          {/* Column 2: Room Configuration */}
          <div className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Room Configuration
                </p>
                <button
                  type="button"
                  onClick={handleToggleRequirePin}
                  className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-600 cursor-pointer"
                >
                  <span>Require PIN</span>
                  <span
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                      settings?.require_pin ? 'bg-theme-primary' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition mt-0.5 ${
                        settings?.require_pin ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                </button>
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <div className={!settings?.require_pin ? 'opacity-40' : ''}>
                  <p className="text-xs text-slate-500">Room PIN</p>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={roomPin}
                      disabled={!settings?.require_pin}
                      onChange={(e) => setRoomPin(e.target.value.replace(/\D/g, ''))}
                      className="tabular w-28 rounded-[12px] border border-transparent hover:border-slate-200 focus:border-theme-primary focus:bg-white bg-transparent text-3xl font-bold tracking-[0.18em] text-[#0F172A] outline-none px-1 transition"
                      aria-label="Room PIN"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {roomPin !== settings?.room_pin && (
                    <button
                      type="button"
                      onClick={() => handleSaveSettings({ room_pin: roomPin }, 'Room PIN updated')}
                      className="rounded-full bg-theme-primary px-3 py-2 text-xs font-semibold text-white hover:bg-theme-dark transition cursor-pointer"
                    >
                      Save
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyPin}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-theme-primary transition hover:border-theme-primary cursor-pointer"
                  >
                    {copiedPin ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPin ? 'Copied' : 'Copy PIN'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <label htmlFor="admin-timer-input" className="text-xs text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{currentStatus === 'OPEN' ? 'Remaining time' : 'Duration (minutes)'}</span>
              </label>

              {currentStatus === 'OPEN' ? (
                <div className="tabular h-10 min-w-[7rem] rounded-[15px] border border-emerald-200 bg-emerald-50 px-3 flex items-center justify-center text-sm font-bold text-emerald-700">
                  {formatTimerString(remainingSeconds)}
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    id="admin-timer-input"
                    type="number"
                    min="1"
                    max="60"
                    value={timerMinutes}
                    onChange={(e) =>
                      setTimerMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))
                    }
                    onBlur={() => handleSaveSettings({ timer_minutes: timerMinutes })}
                    className="tabular h-10 w-20 rounded-[15px] border border-slate-200 px-3 text-center text-sm font-semibold outline-none focus:border-theme-primary focus:shadow-[0_0_0_4px_rgba(0,111,214,0.10)]"
                  />
                  <span className="text-xs text-slate-400 font-medium">min</span>
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Metrics & Health */}
          <div className="p-6 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Metrics &amp; Health
              </p>

              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-xs text-slate-500">Total votes</p>
                  <p className="tabular mt-1 text-3xl font-bold text-[#0F172A]">
                    {totalVotes.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Live nominees</p>
                  <p className="tabular mt-1 text-xl font-bold text-theme-primary">
                    {activeNomineesCount}
                    <span className="text-sm font-medium text-slate-400">/{candidates.length}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                Spam protection ({resultsData?.anomalies?.unique_user_agents || 0} devices)
              </span>
              {duplicateIpCount > 0 ? (
                <span
                  title="Shared venue Wi-Fi NAT detected; browser cookies prevent double voting"
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
                >
                  <span>!</span> Shared Wi-Fi ({duplicateIpCount})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <span>✓</span> Healthy
                </span>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 2: EVENT IDENTITY SETUP (White-label, protected from polling reset) */}
        <section className="rounded-[24px] bg-white p-6 shadow-[0_14px_38px_rgba(15,23,42,0.07),0_2px_8px_rgba(15,23,42,0.03)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-theme-primary">
                White-Label Setup
              </p>
              <h2 className="mt-1 text-base font-bold tracking-tight text-[#0F172A]">
                Event Identity &amp; Labels
              </h2>
            </div>
            <button
              type="button"
              disabled={savingSettings}
              onClick={() => handleSaveSettings(undefined, 'Event identity updated!')}
              className="rounded-full bg-[#0F172A] hover:bg-slate-800 px-5 py-2.5 text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Simpan Identitas</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                Event Title
              </label>
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Live Event Voting"
                className="h-11 w-full rounded-[15px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-[#0F172A] outline-none transition focus:border-theme-primary focus:shadow-[0_0_0_4px_rgba(0,111,214,0.10)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                Event Subtitle / Award Category
              </label>
              <input
                type="text"
                value={eventSubtitle}
                onChange={(e) => setEventSubtitle(e.target.value)}
                placeholder="Audience Choice Award"
                className="h-11 w-full rounded-[15px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-[#0F172A] outline-none transition focus:border-theme-primary focus:shadow-[0_0_0_4px_rgba(0,111,214,0.10)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                Organizer Label
              </label>
              <input
                type="text"
                value={organizerLabel}
                onChange={(e) => setOrganizerLabel(e.target.value)}
                placeholder="Event Committee"
                className="h-11 w-full rounded-[15px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-[#0F172A] outline-none transition focus:border-theme-primary focus:shadow-[0_0_0_4px_rgba(0,111,214,0.10)]"
              />
            </div>
          </div>
        </section>

        {/* SECTION 3: 2-COLUMN WORKSPACE (Live Vote Standings + Nominees Management) */}
        <section className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-7 items-start">
          {/* LEFT: LIVE VOTE STANDINGS */}
          <div className="rounded-[24px] bg-white p-6 sm:p-7 shadow-[0_14px_38px_rgba(15,23,42,0.07),0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-theme-primary">
                  Live Results
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#0F172A]">
                  Live Vote Standings
                </h2>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-500">
                <span className="pulse-dot h-2 w-2 rounded-full bg-green-500" />
                <span>Auto-refreshing</span>
              </div>
            </div>

            {!resultsData?.candidates || resultsData.candidates.length === 0 ? (
              <div className="py-20 text-center text-sm text-slate-400">
                <BarChart3 className="w-8 h-8 mx-auto text-slate-300" />
                <p className="mt-3 font-medium">Waiting for nominees &amp; first vote...</p>
              </div>
            ) : (
              <div className="mt-8 space-y-6">
                {resultsData.candidates.map((c, idx) => {
                  const votes = c.votes || 0;
                  const pct =
                    totalVotes > 0 ? Math.round((votes / totalVotes) * 1000) / 10 : 0;
                  return (
                    <div key={c.id}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-theme-soft text-xs font-bold text-theme-primary">
                            #{String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="truncate text-sm font-semibold text-[#0F172A]">
                            {c.name}
                          </span>
                          <span className="hidden sm:inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 shrink-0">
                            No. {String(c.number).padStart(2, '0')}
                          </span>
                          {!c.is_active && (
                            <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                              (Draft)
                            </span>
                          )}
                        </div>
                        <div className="tabular flex items-center gap-3 text-xs font-semibold text-slate-500 shrink-0">
                          <span>{votes} votes</span>
                          <span className="w-10 text-right text-theme-primary">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="bar-grow h-full rounded-full bg-theme-primary"
                          style={
                            {
                              '--width': `${Math.max(pct, votes > 0 ? 2 : 0)}%`,
                              animationDelay: `${Math.min(idx, 8) * 120}ms`,
                            } as React.CSSProperties
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: NOMINEES MANAGEMENT */}
          <div className="flex min-h-[540px] flex-col rounded-[24px] bg-white p-6 sm:p-7 shadow-[0_14px_38px_rgba(15,23,42,0.07),0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-theme-primary">
                  Session Content
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#0F172A]">
                  Nominees Management
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                  {activeNomineesCount} active
                </span>
                {candidates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearAllModal(true)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                    title="Clear all nominees"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {candidates.length === 0 ? (
              <div className="mt-6 flex-1 flex flex-col items-center justify-center rounded-[15px] border-2 border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
                <Camera className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No nominees yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Click &ldquo;Add Nominee&rdquo; below to snap a live photo or upload from gallery.
                </p>
              </div>
            ) : (
              <div className="mt-6 flex-1 space-y-2.5 overflow-y-auto max-h-[460px] pr-1 gallery-scroll">
                {candidates.map((cand) => (
                  <div
                    key={cand.id}
                    className={`group flex items-center gap-3 rounded-[15px] border p-3 transition ${
                      cand.is_active
                        ? 'border-slate-100 bg-white hover:border-slate-200'
                        : 'border-dashed border-slate-200 bg-slate-50/80 opacity-80'
                    }`}
                  >
                    <div className="relative w-11 aspect-[4/5] rounded-[10px] overflow-hidden shrink-0 bg-slate-100 border border-slate-200/70">
                      <CandidateMedia
                        photoData={cand.photo_data}
                        name={cand.name}
                        number={cand.number}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-400 tabular">
                          #{String(cand.number).padStart(2, '0')}
                        </span>
                        <p className="truncate text-sm font-semibold text-[#0F172A]">
                          {cand.name}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex rounded-full bg-theme-soft px-2 py-0.5 text-[10px] font-semibold text-theme-primary">
                          {cand.category}
                        </span>
                        {cand.costume_theme && (
                          <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
                            {cand.costume_theme}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleCandidateActive(cand)}
                      aria-label="Toggle nominee status"
                      className={`rounded-full px-2.5 py-1.5 text-[10px] font-semibold transition cursor-pointer shrink-0 ${
                        cand.is_active
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {cand.is_active ? 'Active' : 'Draft'}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(cand)}
                      aria-label="Edit nominee"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-50 hover:text-theme-primary cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingCand(cand)}
                      aria-label="Delete nominee"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="mt-5 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-theme-primary text-sm font-semibold text-white shadow-[0_7px_16px_rgba(0,111,214,0.22)] transition hover:bg-theme-dark active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Nominee</span>
            </button>
          </div>
        </section>
      </main>

      {/* MODAL 1: ADD NOMINEE (Quick Nomination Capture with WebRTC & Compression) */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up"
          onClick={() => !submittingAdd && setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-[24px] max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-theme-primary">
                  Quick Capture
                </p>
                <h3 className="text-lg font-bold text-[#0F172A]">Add New Nominee</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Nominee Photo (Auto-Crop 4:5 &amp; WebP)
                </label>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => openCamera('add')}
                    className="flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-[15px] bg-theme-soft hover:bg-theme-soft-strong border border-theme-primary/20 text-theme-dark transition active:scale-[0.98] cursor-pointer"
                  >
                    <span className="w-10 h-10 rounded-full bg-theme-primary text-white flex items-center justify-center shadow-md">
                      <Camera className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-semibold">Open Live Camera</span>
                    <span className="text-[10px] text-slate-500">Venue camera</span>
                  </button>

                  <label className="flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-[15px] bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 text-slate-700 transition active:scale-[0.98] cursor-pointer">
                    <span className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-sm">
                      <ImageIcon className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-semibold">Upload Gallery</span>
                    <span className="text-[10px] text-slate-500">Auto-compress</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleGalleryUpload(e, 'add')}
                      className="hidden"
                    />
                  </label>
                </div>

                {addPhotoDataUrl && (
                  <div className="mt-3 p-3 rounded-[15px] bg-slate-50 border border-slate-200 animate-fade-up flex items-center gap-3">
                    <div className="w-14 aspect-[4/5] rounded-[10px] overflow-hidden border border-slate-200 bg-slate-200 shrink-0">
                      <img
                        src={addPhotoDataUrl}
                        alt="Nominee preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                        {addCompressBadge || 'Ready'}
                      </span>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => openCamera('add')}
                          className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          Retake
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddPhotoDataUrl(null);
                            setAddCompressBadge(null);
                          }}
                          className="px-3 py-1 rounded-full text-rose-600 hover:bg-rose-50 text-[11px] font-semibold cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    No.
                  </label>
                  <input
                    type="number"
                    required
                    value={addNumber}
                    onChange={(e) => setAddNumber(e.target.value)}
                    className="tabular w-full h-11 px-3 rounded-[15px] border border-slate-200 bg-white text-base font-bold text-center text-[#0F172A] outline-none focus:border-theme-primary"
                  />
                </div>
                <div className="col-span-8">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Name / Callout <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full h-11 px-3.5 rounded-[15px] border border-slate-200 bg-white text-sm font-medium text-[#0F172A] outline-none focus:border-theme-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Category Chip
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_PRESETS.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setAddCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                        addCategory === cat
                          ? 'bg-theme-primary text-white border-theme-primary shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Costume / Performance Theme <span className="text-slate-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={addTheme}
                  onChange={(e) => setAddTheme(e.target.value)}
                  placeholder="e.g. Neon Horizon, Classic Glamour..."
                  className="w-full h-11 px-3.5 rounded-[15px] border border-slate-200 bg-white text-sm text-[#0F172A] outline-none focus:border-theme-primary"
                />
              </div>

              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-[15px] bg-slate-50 border border-slate-200/80">
                <div className="text-xs">
                  <p className="font-semibold text-slate-800">Save as Draft</p>
                  <p className="text-[11px] text-slate-500">Hide from voters until published.</p>
                </div>
                <input
                  type="checkbox"
                  checked={addAsDraft}
                  onChange={(e) => setAddAsDraft(e.target.checked)}
                  className="w-5 h-5 rounded accent-blue-600 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={submittingAdd}
                className="w-full min-h-[50px] rounded-full bg-theme-primary hover:bg-theme-dark text-sm font-semibold text-white shadow-[0_7px_16px_rgba(0,111,214,0.22)] flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
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
        </div>
      )}

      {/* MODAL 2: EDIT CANDIDATE */}
      {editingCandidate && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up"
          onClick={() => !submittingEdit && setEditingCandidate(null)}
        >
          <div
            className="bg-white rounded-[24px] max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#0F172A]">Edit Nominee Details</h3>
              <button
                type="button"
                onClick={() => setEditingCandidate(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="flex items-center gap-3.5 p-3 rounded-[15px] bg-slate-50 border border-slate-200">
                <div className="w-16 aspect-[4/5] rounded-[12px] overflow-hidden bg-slate-200 shrink-0 border border-slate-200">
                  <CandidateMedia
                    photoData={editPhotoDataUrl}
                    name={editName}
                    number={editNumber}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-xs font-semibold text-slate-800">Change Photo</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => openCamera('edit')}
                      className="px-3 py-1.5 rounded-full bg-theme-primary text-white text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <Camera className="w-3 h-3" /> Camera
                    </button>
                    <label className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> Gallery
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleGalleryUpload(e, 'edit')}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {editCompressBadge && (
                    <p className="text-[11px] font-semibold text-emerald-700">
                      {editCompressBadge}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">No.</label>
                  <input
                    type="number"
                    required
                    value={editNumber}
                    onChange={(e) => setEditNumber(e.target.value)}
                    className="tabular w-full h-11 px-3 rounded-[15px] border border-slate-200 text-sm font-bold text-center outline-none focus:border-theme-primary"
                  />
                </div>
                <div className="col-span-8">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-[15px] border border-slate-200 text-sm font-medium outline-none focus:border-theme-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_PRESETS.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setEditCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Theme (Optional)
                </label>
                <input
                  type="text"
                  value={editTheme}
                  onChange={(e) => setEditTheme(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[15px] border border-slate-200 text-sm outline-none focus:border-theme-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCandidate(null)}
                  className="min-h-[46px] rounded-full border border-slate-200 text-slate-700 font-semibold text-xs cursor-pointer hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="min-h-[46px] rounded-full bg-theme-primary hover:bg-theme-dark text-white font-semibold text-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: WEBRTC LIVE CAMERA VIEWFINDER (z-[60] to stack above Add/Edit Modals) */}
      {showCameraModal && (
        <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 text-white rounded-[24px] max-w-md w-full overflow-hidden border border-slate-700 shadow-2xl flex flex-col">
            <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <h3 className="text-sm font-bold">Live Stage Viewfinder</h3>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
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

              {!cameraError && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-5 border-2 border-white/35 rounded-2xl" />
                  <span className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[11px] font-semibold text-white">
                    4:5 Portrait Frame • Auto-Compress
                  </span>
                </div>
              )}

              {cameraFlash && (
                <div className="absolute inset-0 bg-white z-20 animate-flash pointer-events-none" />
              )}

              {cameraError && (
                <div className="px-6 text-center max-w-xs">
                  <p className="text-sm font-bold text-white">Web Camera Unavailable</p>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Browser camera permission was denied or device has no direct camera stream.
                  </p>
                  <label className="mt-5 flex items-center justify-center gap-2 w-full py-3 px-4 rounded-full bg-theme-primary text-white text-xs font-semibold cursor-pointer">
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
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
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

      {/* MODAL 4: DELETE CANDIDATE */}
      {deletingCand && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up"
          onClick={() => setDeletingCand(null)}
        >
          <div
            className="bg-white rounded-[24px] max-w-sm w-full p-6 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[#0F172A]">Delete Nominee?</h3>
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
                className="min-h-[44px] rounded-full border border-slate-200 text-slate-700 font-semibold text-xs cursor-pointer hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCandidate}
                className="min-h-[44px] rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs cursor-pointer"
              >
                Delete Nominee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: RESET TRIAL VOTES */}
      {showResetVotesModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up"
          onClick={() => setShowResetVotesModal(false)}
        >
          <div
            className="bg-white rounded-[24px] max-w-sm w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#0F172A]">Reset Trial Votes?</h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              All vote counts will be returned to <strong>0</strong>. All candidate profiles will remain intact.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Type <span className="font-mono text-rose-600">RESET</span> to confirm:
              </label>
              <input
                type="text"
                placeholder="RESET"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
                className="w-full h-11 px-3.5 rounded-[15px] border border-slate-200 text-sm font-mono font-bold uppercase outline-none focus:border-rose-500"
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowResetVotesModal(false);
                  setResetConfirmText('');
                }}
                className="min-h-[44px] rounded-full border border-slate-200 text-slate-700 font-semibold text-xs cursor-pointer hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetConfirmText.trim().toUpperCase() !== 'RESET'}
                onClick={handleExecuteResetVotes}
                className="min-h-[44px] rounded-full bg-rose-600 disabled:bg-rose-300 text-white font-semibold text-xs cursor-pointer disabled:cursor-not-allowed"
              >
                Reset Votes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: CLEAR ALL NOMINEES */}
      {showClearAllModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up"
          onClick={() => setShowClearAllModal(false)}
        >
          <div
            className="bg-white rounded-[24px] max-w-sm w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#0F172A]">Clear All Nominees?</h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              This will permanently delete all nominees and their votes so you can start fresh from <strong>No. 01</strong>.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Type <span className="font-mono text-rose-600">CLEAR</span> to confirm:
              </label>
              <input
                type="text"
                placeholder="CLEAR"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value.toUpperCase())}
                className="w-full h-11 px-3.5 rounded-[15px] border border-slate-200 text-sm font-mono font-bold uppercase outline-none focus:border-rose-500"
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowClearAllModal(false);
                  setClearConfirmText('');
                }}
                className="min-h-[44px] rounded-full border border-slate-200 text-slate-700 font-semibold text-xs cursor-pointer hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearConfirmText.trim().toUpperCase() !== 'CLEAR'}
                onClick={handleExecuteClearAll}
                className="min-h-[44px] rounded-full bg-rose-600 disabled:bg-rose-300 text-white font-semibold text-xs cursor-pointer disabled:cursor-not-allowed"
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
