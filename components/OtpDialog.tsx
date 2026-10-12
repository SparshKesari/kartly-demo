"use client";

import { useEffect, useRef, type FormEvent } from "react";
import { KB } from "@/lib/kb";

type Props = {
  value: string;
  error: string;
  busy: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

/** Modal OTP prompt: traps focus, closes on Esc. The caller restores focus on close. */
export function OtpDialog({ value, error, busy, onChange, onSubmit, onCancel }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (error) inputRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (!KB.b08) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (KB.b08) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4" onKeyDown={onKeyDown}>
      <div
        ref={dialogRef}
        data-testid="otp-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="otp-title"
        aria-describedby="otp-desc"
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-2xl"
      >
        <h2 id="otp-title" className="text-xl font-bold">
          Verify your payment
        </h2>
        <p id="otp-desc" className="mt-1 text-sm text-slate-600">
          Enter the 6-digit one-time password sent to your phone. (Test mode: use <strong>123456</strong>.)
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="otp-input" className="label">
              One-time password
            </label>
            <input
              ref={inputRef}
              id="otp-input"
              data-testid="otp-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              readOnly={busy}
              value={value}
              onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "otp-error" : undefined}
              className="input text-center text-lg tracking-[0.4em]"
            />
          </div>
          {error && (
            <p id="otp-error" data-testid="otp-error" role="alert" className="rounded border border-red-300 bg-red-50 px-2 py-1 text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" data-testid="otp-cancel" onClick={onCancel} className="btn-outline flex-1">
              Cancel
            </button>
            <button type="submit" data-testid="otp-submit" aria-busy={busy} className="btn-primary flex-1">
              {busy ? "Verifying…" : "Verify & pay"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
