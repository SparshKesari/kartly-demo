"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import { useApp } from "./Providers";

type Fields = { name: string; email: string; password: string; confirmPassword: string };

function validate(f: Fields): Partial<Fields> {
  const errors: Partial<Fields> = {};
  if (!f.name.trim()) errors.name = "Enter your name.";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) errors.email = "Enter a valid email address.";
  if (f.password.length < 8) errors.password = "Password must be at least 8 characters.";
  else if (!/[A-Z]/.test(f.password)) errors.password = "Password must include an uppercase letter.";
  else if (!/[0-9]/.test(f.password)) errors.password = "Password must include a number.";
  if (f.confirmPassword !== f.password) errors.confirmPassword = "Passwords do not match.";
  return errors;
}

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const { toast } = useApp();
  const [fields, setFields] = useState<Fields>({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Partial<Fields>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
    setFormError("");
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const v = validate(fields);
    setErrors(v);
    if (Object.keys(v).length) {
      setFormError("Please fix the highlighted fields.");
      return;
    }
    setSubmitting(true);
    const res = await api<{ user: { name: string }; mergedCount: number }>("/api/auth/register", { body: fields });
    if (!res.ok) {
      setSubmitting(false);
      setFormError(res.error.message);
      if (res.error.fields) setErrors(res.error.fields as Partial<Fields>);
      return;
    }
    toast(`Welcome to Kartly, ${res.data.user.name}!`);
    router.replace(next);
    router.refresh();
  }

  const field = (key: keyof Fields, label: string, testId: string, type: string, autoComplete: string, hint?: string) => (
    <div>
      <label htmlFor={testId} className="label">
        {label}
      </label>
      <input
        id={testId}
        data-testid={testId}
        type={type}
        autoComplete={autoComplete}
        value={fields[key]}
        onChange={set(key)}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `${testId}-error` : hint ? `${testId}-hint` : undefined}
        className="input"
      />
      {hint && !errors[key] && (
        <p id={`${testId}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {errors[key] && (
        <p id={`${testId}-error`} className="field-error">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="card space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Create account</h1>
      {formError && (
        <p data-testid="register-error" role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {formError}
        </p>
      )}
      {field("name", "Your name", "register-name", "text", "name")}
      {field("email", "Email", "register-email", "email", "email")}
      {field("password", "Password", "register-password", "password", "new-password", "At least 8 characters, with one uppercase letter and one number.")}
      {field("confirmPassword", "Re-enter password", "register-confirm", "password", "new-password")}
      <button type="submit" data-testid="register-submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? "Creating account…" : "Create your Kartly account"}
      </button>
      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="inline-flex min-h-[40px] items-center text-brand-link hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
