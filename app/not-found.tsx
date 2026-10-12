import Link from "next/link";

export default function NotFound() {
  return (
    <div data-testid="not-found" className="mx-auto max-w-xl px-4 py-16 text-center">
      <p className="text-6xl font-extrabold text-amber-500">404</p>
      <h1 className="mt-4 text-2xl font-bold">Sorry, we couldn&apos;t find that page</h1>
      <p className="mt-2 text-slate-600">The page you&apos;re looking for may have moved, or the link might be wrong.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">
          Go to the Kartly home page
        </Link>
        <Link href="/search?q=" className="btn-outline">
          Browse all products
        </Link>
      </div>
    </div>
  );
}
