"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import { KB } from "@/lib/kb";
import { useApp } from "./Providers";

export function LoginForm({ next, demoAccounts }: { next: string; demoAccounts: { email: string; note: string }[] | null }) {
  const router = useRouter();
  const { toast } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await api<{ user: { name: string }; mergedCount: number }>("/api/auth/login", { body: { email, password } });
    if (!res.ok) {
      setSubmitting(false);
      setError(res.error.message);
      return;
    }
    if (res.data.mergedCount > 0) {
      const n = res.data.mergedCount;
      toast(`${n} ${n === 1 ? "item" : "items"} from your guest cart ${n === 1 ? "was" : "were"} merged into your cart.`);
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} noValidate className="card space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        {error && (
          <p data-testid="login-error" role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="login-email" className="label">
            Email
          </label>
          <input
            id="login-email"
            data-testid="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (!KB.b10) setError("");
            }}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="label">
            Password
          </label>
          <input
            id="login-password"
            data-testid="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (!KB.b10) setError("");
            }}
            className="input"
          />
        </div>
        <button type="submit" data-testid="login-submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-sm text-slate-600">
          New to Kartly?{" "}
          <Link href={`/register?next=${encodeURIComponent(next)}`} className="inline-flex min-h-[40px] items-center text-brand-link hover:underline">
            Create your account
          </Link>
        </p>
      </form>

      {demoAccounts && (
        <section data-testid="demo-accounts" aria-labelledby="demo-accounts-title" className="card p-4 text-sm">
          <h2 id="demo-accounts-title" className="font-semibold">
            Demo accounts
          </h2>
          <p className="mt-1 text-slate-600">
            All passwords: <code className="rounded bg-slate-100 px-1">Password@123</code>
          </p>
          <ul className="mt-2 divide-y divide-slate-100">
            {demoAccounts.map((a) => (
              <li key={a.email} className="flex items-center justify-between gap-2 py-1">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{a.email}</span>
                  <span className="block text-xs text-slate-500">{a.note}</span>
                </span>
                <button
                  type="button"
                  className="btn-outline shrink-0 px-3 text-xs"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword("Password@123");
                    setError("");
                  }}
                >
                  Use
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
