import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyBox, ProductGallery } from "@/components/ProductDetail";
import { ProductCard } from "@/components/ProductCard";
import { Stars } from "@/components/Stars";
import { brandSlug, categoryMap, findProductBySlug, productReviews, relatedProducts } from "@/lib/catalog";
import { read } from "@/lib/db";
import { discountPercent, formatMoney, round2 } from "@/lib/pricing";
import { addDays, formatDate, formatDeliveryDate } from "@/lib/util";
import { viewerWishlist } from "@/lib/viewer";

type Props = { params: { slug: string } };

export function generateMetadata({ params }: Props): Metadata {
  const product = findProductBySlug(read(), params.slug);
  return { title: product ? product.title : "Product not found" };
}

export default function ProductPage({ params }: Props) {
  const db = read();
  const product = findProductBySlug(db, params.slug);
  if (!product) notFound();
  const category = categoryMap(db).get(product.categoryId);
  const reviews = productReviews(db, product.id);
  const related = relatedProducts(db, product);
  const wishlist = viewerWishlist(db);
  const pct = discountPercent(product.price, product.mrp);
  const savings = round2(product.mrp - product.price);
  const now = new Date();
  const standardDate = formatDeliveryDate(addDays(now, product.deliveryDays).toISOString());
  const expressDate = formatDeliveryDate(addDays(now, 1).toISOString());
  const outOfStock = product.stock <= 0;

  return (
    <div className="mx-auto max-w-[1500px] px-2 py-4 md:px-4">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-slate-600">
        <Link href="/" className="inline-flex min-h-[40px] min-w-[40px] items-center hover:underline">
          Home
        </Link>
        {" › "}
        {category && (
          <Link href={`/c/${category.slug}`} className="inline-flex min-h-[40px] items-center hover:underline">
            {category.name}
          </Link>
        )}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)]">
        <ProductGallery title={product.title} images={product.images} />

        <section className="min-w-0 space-y-3">
          <h1 data-testid="pdp-title" className="text-2xl font-medium leading-snug">
            {product.title}
          </h1>
          <p className="text-sm">
            Brand:{" "}
            <Link data-testid="pdp-brand" href={`/search?q=&brand=${brandSlug(product.brand)}`} className="inline-flex min-h-[40px] min-w-[40px] items-center text-brand-link hover:underline">
              {product.brand}
            </Link>
          </p>
          <div data-testid="pdp-rating" className="flex items-center gap-2 text-sm">
            <span className="font-semibold">{product.rating}</span>
            <Stars rating={product.rating} />
            <span className="text-brand-link">{product.ratingCount.toLocaleString("en-US")} ratings</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {product.tags.includes("bestseller") && <span className="rounded bg-orange-600 px-2 py-0.5 text-xs font-semibold text-white">#1 Bestseller</span>}
            {product.tags.includes("deal") && <span className="rounded bg-red-700 px-2 py-0.5 text-xs font-semibold text-white">Limited time deal</span>}
            {product.tags.includes("new") && <span className="rounded bg-sky-700 px-2 py-0.5 text-xs font-semibold text-white">New arrival</span>}
          </div>
          <hr />
          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              {pct > 0 && (
                <span data-testid="pdp-discount" className="text-2xl font-light text-red-700">
                  -{pct}%
                </span>
              )}
              <span data-testid="pdp-price" className="text-3xl font-medium">
                {formatMoney(product.price)}
              </span>
            </div>
            {pct > 0 && (
              <p className="text-sm text-slate-600">
                List Price:{" "}
                <s data-testid="pdp-mrp">{formatMoney(product.mrp)}</s>
                <span className="ml-2 text-red-700">You save {formatMoney(savings)}</span>
              </p>
            )}
          </div>
          <div className="space-y-1 rounded-md bg-slate-50 p-3 text-sm">
            <p
              data-testid="pdp-stock-status"
              className={`text-lg font-semibold ${outOfStock ? "text-red-700" : product.stock < 5 ? "text-red-700" : "text-emerald-700"}`}
            >
              {outOfStock ? "Out of stock" : product.stock < 5 ? `Only ${product.stock} left in stock - order soon.` : "In stock"}
            </p>
            <p data-testid="pdp-delivery-estimate">
              {outOfStock ? (
                "Currently unavailable. We don't know when or if this item will be back in stock."
              ) : (
                <>
                  Standard delivery <strong>{standardDate}</strong>. FREE on orders over $35.
                  {product.fastDelivery ? (
                    <>
                      {" "}
                      Or Express delivery <strong>{expressDate}</strong>.
                    </>
                  ) : (
                    " Express delivery is not available for this item."
                  )}
                </>
              )}
            </p>
          </div>
          <div>
            <h2 className="mt-4 text-lg font-bold">About this item</h2>
            <ul className="ml-5 list-disc space-y-1 text-sm">
              {product.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        </section>

        <aside className="card h-fit space-y-3 p-4" aria-label="Purchase options">
          <p className="text-2xl font-medium">{formatMoney(product.price)}</p>
          <BuyBox
            product={{
              id: product.id,
              slug: product.slug,
              title: product.title,
              images: product.images,
              price: product.price,
              stock: product.stock,
              maxPerOrder: product.maxPerOrder,
              variants: product.variants,
            }}
            wishlisted={wishlist.has(product.id)}
          />
        </aside>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-bold">Product description</h2>
          <p className="text-sm leading-relaxed">{product.description}</p>
        </section>
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-bold">Specifications</h2>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(product.specs).map(([k, v]) => (
                <tr key={k} className="border-b border-slate-100 last:border-0">
                  <th scope="row" className="w-1/3 bg-slate-50 px-3 py-2 text-left font-semibold">
                    {k}
                  </th>
                  <td className="px-3 py-2">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="card mt-6 p-4" aria-labelledby="reviews-title">
        <h2 id="reviews-title" className="mb-3 text-lg font-bold">
          Customer reviews
        </h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-slate-600">No reviews yet.</p>
        ) : (
          <ul className="space-y-4">
            {reviews.map((r) => (
              <li key={r.id} data-testid="review-item" className="border-b border-slate-100 pb-3 last:border-0">
                <p className="text-sm font-semibold">{r.userName}</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="sr-only">{r.rating} out of 5 stars</span>
                  <Stars rating={r.rating} size={14} />
                  <span className="font-bold">{r.title}</span>
                </div>
                <p className="text-xs text-slate-500">Reviewed on {formatDate(r.createdAt, { month: "long", day: "numeric", year: "numeric" })}</p>
                <p className="mt-1 text-sm">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {related.length > 0 && (
        <section data-testid="related-products" className="card mt-6 p-4" aria-labelledby="related-title">
          <h2 id="related-title" className="mb-3 text-lg font-bold">
            Related products
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {related.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} wishlisted={wishlist.has(p.id)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
