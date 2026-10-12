import Link from "next/link";
import { ListingLayout } from "./ListingLayout";
import { ProductCard } from "./ProductCard";
import { listingToParams, searchProducts, type ListingQuery } from "@/lib/catalog";
import { read } from "@/lib/db";
import { viewerWishlist } from "@/lib/viewer";

function pageHref(query: ListingQuery, page: number, routeCategory?: string) {
  const next = { ...query, page };
  if (routeCategory) {
    const sp = listingToParams(next, { omitCategory: true });
    return `/c/${routeCategory}${sp.toString() ? `?${sp}` : ""}`;
  }
  const sp = listingToParams(next);
  if (!sp.has("q")) sp.set("q", "");
  return `/search?${sp}`;
}

function pageList(current: number, total: number): (number | "gap")[] {
  const pages = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function ListingPage({ query, routeCategory, heading }: { query: ListingQuery; routeCategory?: string; heading?: string }) {
  const db = read();
  const result = searchProducts(db, query);
  const wishlist = viewerWishlist(db);
  const categoryNames = Object.fromEntries(db.categories.map((c) => [c.slug, c.name]));
  const { items, total, page, totalPages } = result;
  const linkClass = "flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50";
  const disabledClass = "flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400";

  return (
    <ListingLayout
      query={result.query}
      facets={result.facets}
      total={total}
      page={page}
      pageSize={result.pageSize}
      routeCategory={routeCategory}
      categoryNames={categoryNames}
    >
      {heading && <h1 className="mb-3 text-2xl font-bold">{heading}</h1>}
      {items.length === 0 ? (
        <div data-testid="empty-results" className="card p-8 text-center">
          <p className="text-lg font-semibold">
            {query.q ? `No results for '${query.q}'` : "No products match these filters."}
          </p>
          <p className="mt-2 text-sm text-slate-600">Try checking your spelling, using fewer words, or removing some filters.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="Search results">
          {items.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} wishlisted={wishlist.has(p.id)} />
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {page > 1 ? (
            <Link href={pageHref(result.query, page - 1, routeCategory)} data-testid="pagination-prev" className={linkClass} scroll>
              ‹ Previous
            </Link>
          ) : (
            <button type="button" disabled data-testid="pagination-prev" className={disabledClass}>
              ‹ Previous
            </button>
          )}
          {pageList(page, totalPages).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-slate-500">
                …
              </span>
            ) : p === page ? (
              <span key={p} data-testid={`pagination-page-${p}`} aria-current="page" className={`${linkClass} border-slate-800 font-bold`}>
                {p}
              </span>
            ) : (
              <Link key={p} href={pageHref(result.query, p, routeCategory)} data-testid={`pagination-page-${p}`} className={linkClass}>
                {p}
              </Link>
            ),
          )}
          {page < totalPages ? (
            <Link href={pageHref(result.query, page + 1, routeCategory)} data-testid="pagination-next" className={linkClass}>
              Next ›
            </Link>
          ) : (
            <button type="button" disabled data-testid="pagination-next" className={disabledClass}>
              Next ›
            </button>
          )}
        </nav>
      )}
    </ListingLayout>
  );
}
