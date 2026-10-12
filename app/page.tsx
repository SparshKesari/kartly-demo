import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { homeRows, type ProductSummary } from "@/lib/catalog";
import { read } from "@/lib/db";
import { viewerWishlist } from "@/lib/viewer";

function Row({ title, href, products, wishlist, testId }: { title: string; href: string; products: ProductSummary[]; wishlist: Set<string>; testId: string }) {
  if (products.length === 0) return null;
  return (
    <section data-testid={testId} className="card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">{title}</h2>
        <Link href={href} className="btn-link">
          See all
        </Link>
      </div>
      <ul className="flex gap-3 overflow-x-auto pb-2">
        {products.map((p) => (
          <li key={p.id} className="shrink-0">
            <ProductCard product={p} wishlisted={wishlist.has(p.id)} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function HomePage() {
  const db = read();
  const { deals, bestsellers, newArrivals, tiles } = homeRows(db);
  const wishlist = viewerWishlist(db);
  return (
    <div className="mx-auto max-w-[1500px] space-y-6 px-2 pb-6 md:px-4">
      <section
        data-testid="hero"
        className="relative mt-0 overflow-hidden rounded-b-lg bg-gradient-to-r from-sky-800 via-indigo-800 to-fuchsia-800 px-6 py-10 text-white md:px-12 md:py-16"
      >
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">Fall savings event</p>
        <h1 className="mt-2 max-w-xl text-3xl font-extrabold leading-tight md:text-5xl">Everything you need, delivered fast.</h1>
        <p className="mt-3 max-w-lg text-sm text-slate-100 md:text-base">
          Shop deals on phones, laptops, fashion and home. Free standard shipping on orders over $35.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/search?q=&tags=deal" className="btn-primary">
            Shop today&apos;s deals
          </Link>
          <Link href="/search?q=" className="btn bg-white/15 text-white hover:bg-white/25">
            Browse all products
          </Link>
        </div>
      </section>

      <Row title="Today's Deals" href="/search?q=&tags=deal&sort=discount" products={deals} wishlist={wishlist} testId="home-deals" />

      <section className="card p-4" data-testid="home-categories">
        <h2 className="mb-3 text-xl font-bold">Shop by category</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {tiles.map((c) => (
            <li key={c.slug}>
              <Link href={`/c/${c.slug}`} className="group block rounded-md border border-slate-200 p-2 hover:shadow-md">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded bg-slate-50">
                  <img src={c.image} alt="" loading="lazy" className="h-full w-full object-contain p-2 transition-transform group-hover:scale-105" />
                </div>
                <p className="mt-2 text-center text-sm font-semibold group-hover:text-orange-700">{c.name}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Row title="Bestsellers" href="/search?q=&tags=bestseller&sort=rating" products={bestsellers} wishlist={wishlist} testId="home-bestsellers" />
      <Row title="New arrivals" href="/search?q=&tags=new&sort=newest" products={newArrivals} wishlist={wishlist} testId="home-new-arrivals" />
    </div>
  );
}
