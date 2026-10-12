import Link from "next/link";

export function Footer({ categories }: { categories: { slug: string; name: string }[] }) {
  return (
    <footer className="mt-10 bg-brand-nav text-slate-200">
      <a href="#top" className="flex min-h-[44px] items-center justify-center bg-slate-700 text-sm hover:bg-slate-600">
        Back to top
      </a>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 text-sm md:grid-cols-4">
        <div>
          <h2 className="mb-2 font-bold text-white">Your account</h2>
          <ul>
            <li><Link className="inline-flex min-h-[40px] items-center hover:underline" href="/account/orders">Your Orders</Link></li>
            <li><Link className="inline-flex min-h-[40px] items-center hover:underline" href="/account/addresses">Your Addresses</Link></li>
            <li><Link className="inline-flex min-h-[40px] items-center hover:underline" href="/account/wishlist">Your Wishlist</Link></li>
            <li><Link className="inline-flex min-h-[40px] items-center hover:underline" href="/cart">Your Cart</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-2 font-bold text-white">Shop</h2>
          <ul>
            {categories.slice(0, 6).map((c) => (
              <li key={c.slug}><Link className="inline-flex min-h-[40px] items-center hover:underline" href={`/c/${c.slug}`}>{c.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 font-bold text-white">More to explore</h2>
          <ul>
            {categories.slice(6, 12).map((c) => (
              <li key={c.slug}><Link className="inline-flex min-h-[40px] items-center hover:underline" href={`/c/${c.slug}`}>{c.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 font-bold text-white">Let us help you</h2>
          <ul>
            <li><Link className="inline-flex min-h-[40px] items-center hover:underline" href="/search?q=&tags=deal">Today&apos;s Deals</Link></li>
            <li><Link className="inline-flex min-h-[40px] items-center hover:underline" href="/search?q=&tags=bestseller">Bestsellers</Link></li>
            <li><Link className="inline-flex min-h-[40px] items-center hover:underline" href="/search?q=&sort=newest">New Arrivals</Link></li>
          </ul>
        </div>
      </div>
      <p className="border-t border-slate-600 py-4 text-center text-xs text-slate-400">
        Kartly is a demo store. No real payments are processed.
      </p>
    </footer>
  );
}
