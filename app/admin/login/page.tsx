'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardShake, setCardShake] = useState(false);

  const triggerShake = () => {
    setCardShake(false);
    requestAnimationFrame(() => {
      setCardShake(true);
      setTimeout(() => setCardShake(false), 380);
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('Enter your admin password to continue.');
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "That password doesn't match. Try again.");
        triggerShake();
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to connect to authentication service.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-[family-name:var(--font-inter)] text-[#0F172A] flex items-center justify-center px-6 py-10">
      <main className="w-full max-w-[380px]">
        <section className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-theme-primary">
            Live Event Voting
          </p>
          <h1 className="mt-3 text-[30px] font-bold leading-[1.12] tracking-[-0.045em] text-[#0F172A]">
            Admin Access
          </h1>
          <p className="mx-auto mt-4 max-w-[300px] text-[14px] leading-[1.55] text-slate-500">
            Manage nominees, session settings, and live vote results.
          </p>
        </section>

        <section
          className={`mt-8 rounded-[24px] bg-white p-6 shadow-[0_14px_38px_rgba(15,23,42,0.07),0_2px_8px_rgba(15,23,42,0.03)] border border-slate-100 ${
            cardShake ? 'animate-shake' : ''
          }`}
        >
          <form onSubmit={handleLogin} noValidate>
            <label
              htmlFor="admin-password"
              className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600"
            >
              Password
            </label>

            <div className="relative mt-3">
              <input
                id="admin-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onFocus={() => setError(null)}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter admin password"
                aria-describedby="admin-error-message"
                className={`h-[54px] w-full rounded-[15px] border bg-white px-4 pr-12 text-[15px] text-[#0F172A] outline-none transition placeholder:text-slate-400 ${
                  error
                    ? 'border-red-400 focus:border-red-400 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.10)]'
                    : 'border-slate-200 focus:border-theme-primary focus:shadow-[0_0_0_4px_rgba(0,111,214,0.10)]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-50 hover:text-theme-primary cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>

            {error && (
              <p
                id="admin-error-message"
                role="alert"
                className="mt-2 text-[12px] font-medium text-red-500 animate-fade-up"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-theme-primary text-[15px] font-semibold text-white shadow-[0_7px_16px_rgba(0,111,214,0.22)] transition hover:bg-theme-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-75 cursor-pointer"
            >
              {loading && <Loader2 className="w-[18px] h-[18px] animate-spin" />}
              <span>{loading ? 'Signing In' : 'Sign In'}</span>
            </button>
          </form>
        </section>

        <div className="mt-6 text-center space-y-2">
          <p className="text-[11px] font-medium text-slate-400">
            Authorized event committee access only
          </p>
          <div>
            <Link
              href="/"
              className="text-xs font-semibold text-theme-primary hover:underline"
            >
              ← Back to Voter Screen
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
