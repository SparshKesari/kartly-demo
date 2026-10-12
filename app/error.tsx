"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-slate-600">Please try again. If the problem continues, head back to the home page.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" className="btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/" className="btn-outline">
          Home
        </Link>
      </div>
    </div>
  );
}
