/**
 * Independent oracle over data/seed.json for checking what the UI shows.
 * Deliberately re-implements the rules from the spec instead of importing app code.
 */
import fs from "fs";
import path from "path";

type SeedProduct = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  categoryId: string;
  price: number;
  mrp: number;
  stock: number;
  rating: number;
  tags: string[];
  fastDelivery: boolean;
  createdAt: string;
  variants?: { name: string; options: string[] }[];
};

type Seed = { products: SeedProduct[]; categories: { id: string; name: string; slug: string }[] };

let cached: Seed | null = null;
export function seed(): Seed {
  if (!cached) cached = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "seed.json"), "utf8")) as Seed;
  return cached;
}

export function nth(categorySlug: string, n: number): SeedProduct {
  const s = seed();
  const cat = s.categories.find((c) => c.slug === categorySlug)!;
  return s.products.filter((p) => p.categoryId === cat.id)[n - 1];
}

export function bySlug(slug: string): SeedProduct {
  return seed().products.find((p) => p.slug === slug)!;
}

export type OracleQuery = {
  q?: string;
  category?: string;
  brands?: string[];
  min?: number;
  max?: number;
  rating?: number;
  includeOutOfStock?: boolean;
  sort?: "featured" | "price-asc" | "price-desc";
};

const num = (id: string) => Number(id.slice(1));
const kebab = (s: string) => s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function expectedSlugs(q: OracleQuery): string[] {
  const s = seed();
  const catName = (id: string) => s.categories.find((c) => c.id === id)!.name;
  const words = (q.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  let list = s.products.filter((p) => {
    const hay = `${p.title} ${p.brand} ${catName(p.categoryId)} ${p.tags.join(" ")}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) return false;
    if (q.category && s.categories.find((c) => c.id === p.categoryId)!.slug !== q.category) return false;
    if (q.brands?.length && !q.brands.includes(kebab(p.brand))) return false;
    if (q.min !== undefined && p.price < q.min) return false;
    if (q.max !== undefined && p.price >= q.max) return false;
    if (q.rating !== undefined && p.rating < q.rating) return false;
    if (!q.includeOutOfStock && p.stock <= 0) return false;
    return true;
  });
  if (q.sort === "price-asc") list = list.sort((a, b) => a.price - b.price || num(a.id) - num(b.id));
  else if (q.sort === "price-desc") list = list.sort((a, b) => b.price - a.price || num(a.id) - num(b.id));
  else list = list.sort((a, b) => num(a.id) - num(b.id));
  return list.map((p) => p.slug);
}

/** Spec section 7, re-implemented for the tests. */
export function r2(n: number): number {
  return Math.round(n * 100 + 1e-7) / 100;
}

export function expectedTotals(subtotal: number, coupon: "SAVE10" | "FLAT20" | "FREESHIP" | null, delivery: "standard" | "express") {
  const discount = coupon === "SAVE10" ? r2(subtotal * 0.1) : coupon === "FLAT20" ? 20 : 0;
  const discounted = r2(subtotal - discount);
  const shipping = delivery === "express" ? 9.99 : coupon === "FREESHIP" || discounted >= 35 ? 0 : 5.99;
  const tax = r2(discounted * 0.08);
  const total = r2(discounted + shipping + tax);
  return { subtotal: r2(subtotal), discount, shipping, tax, total };
}

export const $ = (n: number) => `$${n.toFixed(2)}`;
