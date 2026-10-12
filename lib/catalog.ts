import { z } from "zod";
import { KB } from "./kb";
import { discountPercent } from "./pricing";
import { slugify } from "./util";
import type { Category, DB, Product, ProductTag, Review } from "./types";

export const PAGE_SIZE = 24;

export const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Avg. Customer Review" },
  { value: "newest", label: "Newest Arrivals" },
  { value: "discount", label: "Biggest Discount" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const PRICE_PRESETS = [
  { key: "under-25", label: "Under $25", min: undefined, max: 25 },
  { key: "25-50", label: "$25 to $50", min: 25, max: 50 },
  { key: "50-100", label: "$50 to $100", min: 50, max: 100 },
  { key: "100-200", label: "$100 to $200", min: 100, max: 200 },
  { key: "200-plus", label: "$200 & above", min: 200, max: undefined },
] as const;

export const RATING_OPTIONS = [4, 3, 2, 1] as const;
export const DISCOUNT_OPTIONS = [10, 25, 50] as const;
export const TAG_OPTIONS: { value: ProductTag; label: string }[] = [
  { value: "bestseller", label: "Bestseller" },
  { value: "new", label: "New" },
  { value: "deal", label: "Deal" },
];

export type ProductSummary = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  categorySlug: string;
  categoryName: string;
  image: string;
  price: number;
  mrp: number;
  discountPercent: number;
  rating: number;
  ratingCount: number;
  stock: number;
  tags: ProductTag[];
  fastDelivery: boolean;
  deliveryDays: number;
  hasVariants: boolean;
};

export type ListingQuery = {
  q: string;
  category?: string;
  brands: string[];
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  discount?: number;
  fast: boolean;
  includeOutOfStock: boolean;
  tags: ProductTag[];
  sort: SortValue;
  page: number;
};

const csv = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const boolParam = z
  .enum(["1", "0", "true", "false", ""])
  .optional()
  .transform((v) => v === "1" || v === "true");

const money = z.coerce.number().finite().min(0).max(1_000_000);

export const listingSchema = z.object({
  q: z.string().max(200).optional().default(""),
  category: z.string().max(80).optional(),
  brand: z.string().max(2000).optional(),
  minPrice: z.union([z.literal(""), money]).optional(),
  maxPrice: z.union([z.literal(""), money]).optional(),
  rating: z.union([z.literal(""), z.coerce.number().int().min(1).max(4)]).optional(),
  discount: z.union([z.literal(""), z.coerce.number().int().refine((n) => [10, 25, 50].includes(n), "Invalid discount")]).optional(),
  fast: boolParam,
  includeOutOfStock: boolParam,
  tags: z.string().max(100).optional(),
  sort: z.enum(["featured", "price-asc", "price-desc", "rating", "newest", "discount"]).optional().default("featured"),
  page: z.coerce.number().int().min(1).max(10000).optional().default(1),
});

const VALID_TAGS: ProductTag[] = ["bestseller", "new", "deal"];

function fromParsed(p: z.infer<typeof listingSchema>): ListingQuery {
  const num = (v: number | "" | undefined) => (typeof v === "number" ? v : undefined);
  return {
    q: p.q.trim(),
    category: p.category || undefined,
    brands: csv(p.brand),
    minPrice: num(p.minPrice),
    maxPrice: num(p.maxPrice),
    rating: num(p.rating),
    discount: num(p.discount),
    fast: p.fast,
    includeOutOfStock: p.includeOutOfStock,
    tags: csv(p.tags).filter((t): t is ProductTag => VALID_TAGS.includes(t as ProductTag)),
    sort: p.sort,
    page: p.page,
  };
}

/** Strict parse used by the API: invalid input is an error. */
export function parseListingStrict(params: Record<string, string>) {
  const parsed = listingSchema.safeParse(params);
  if (!parsed.success) return { ok: false as const, error: parsed.error };
  return { ok: true as const, query: fromParsed(parsed.data) };
}

/** Lenient parse used by pages: invalid values are dropped. */
export function parseListingLenient(params: Record<string, string | string[] | undefined>): ListingQuery {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value === undefined) continue;
    const single = listingSchema.shape[k as keyof typeof listingSchema.shape];
    if (!single) continue;
    if (single.safeParse(value).success) flat[k] = value;
  }
  return fromParsed(listingSchema.parse(flat));
}

/** Serializes a query back to URL params, omitting defaults. */
export function listingToParams(query: Partial<ListingQuery>, opts: { omitCategory?: boolean } = {}): URLSearchParams {
  const sp = new URLSearchParams();
  if (query.q) sp.set("q", query.q);
  if (query.category && !opts.omitCategory) sp.set("category", query.category);
  if (query.brands?.length) sp.set("brand", query.brands.join(","));
  if (query.minPrice !== undefined) sp.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) sp.set("maxPrice", String(query.maxPrice));
  if (query.rating) sp.set("rating", String(query.rating));
  if (query.discount) sp.set("discount", String(query.discount));
  if (query.fast) sp.set("fast", "1");
  if (query.includeOutOfStock) sp.set("includeOutOfStock", "1");
  if (query.tags?.length) sp.set("tags", query.tags.join(","));
  if (query.sort && query.sort !== "featured") sp.set("sort", query.sort);
  if (query.page && query.page > 1) sp.set("page", String(query.page));
  return sp;
}

export function brandSlug(brand: string): string {
  return slugify(brand);
}

export function numericId(id: string): number {
  return Number(id.replace(/^p/, "")) || 0;
}

export function categoryMap(db: DB): Map<string, Category> {
  return new Map(db.categories.map((c) => [c.id, c]));
}

export function toSummary(p: Product, categories: Map<string, Category>): ProductSummary {
  const cat = categories.get(p.categoryId);
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    brand: p.brand,
    categorySlug: cat?.slug ?? "",
    categoryName: cat?.name ?? "",
    image: p.images[0] ?? "",
    price: p.price,
    mrp: p.mrp,
    discountPercent: discountPercent(p.price, p.mrp),
    rating: p.rating,
    ratingCount: p.ratingCount,
    stock: p.stock,
    tags: p.tags,
    fastDelivery: p.fastDelivery,
    deliveryDays: p.deliveryDays,
    hasVariants: Boolean(p.variants && p.variants.length),
  };
}

type Predicate = (p: Product) => boolean;

type FilterGroup = "q" | "category" | "brand" | "price" | "rating" | "discount" | "fast" | "stock" | "tags";

function buildPredicates(query: ListingQuery, categories: Map<string, Category>): Record<FilterGroup, Predicate> {
  const tokens = query.q.toLowerCase().split(/\s+/).filter(Boolean);
  return {
    q: (p) => {
      if (!tokens.length) return true;
      const hay = [p.title, p.brand, categories.get(p.categoryId)?.name ?? "", ...p.tags].join(" ").toLowerCase();
      return tokens.every((t) => hay.includes(t));
    },
    category: (p) => !query.category || categories.get(p.categoryId)?.slug === query.category,
    brand: (p) => !query.brands.length || query.brands.includes(brandSlug(p.brand)),
    price: (p) =>
      (query.minPrice === undefined || p.price >= query.minPrice) && (query.maxPrice === undefined || p.price < query.maxPrice),
    rating: (p) => !query.rating || p.rating >= query.rating,
    discount: (p) => !query.discount || discountPercent(p.price, p.mrp) >= query.discount,
    fast: (p) => !query.fast || p.fastDelivery,
    stock: (p) => query.includeOutOfStock || p.stock > 0,
    tags: (p) => !query.tags.length || query.tags.some((t) => p.tags.includes(t)),
  };
}

function matchesExcept(p: Product, preds: Record<FilterGroup, Predicate>, except: FilterGroup[] = []): boolean {
  return (Object.keys(preds) as FilterGroup[]).every((k) => except.includes(k) || preds[k](p));
}

function sortProducts(list: Product[], sort: SortValue): Product[] {
  const byId = (a: Product, b: Product) => numericId(a.id) - numericId(b.id);
  const sorted = [...list];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price || byId(a, b));
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price || byId(a, b));
    case "rating":
      return sorted.sort((a, b) => b.rating - a.rating || byId(a, b));
    case "newest":
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || byId(a, b));
    case "discount":
      return sorted.sort((a, b) => (b.mrp - b.price) / b.mrp - (a.mrp - a.price) / a.mrp || byId(a, b));
    default:
      return sorted.sort(byId);
  }
}

export type FacetOption = { value: string; label: string; count: number };

export type Facets = {
  categories: FacetOption[];
  brands: FacetOption[];
  prices: FacetOption[];
  ratings: FacetOption[];
  discounts: FacetOption[];
  tags: FacetOption[];
  fast: number;
  outOfStock: number;
};

export type ListingResult = {
  items: ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: Facets;
  query: ListingQuery;
};

export function searchProducts(db: DB, query: ListingQuery): ListingResult {
  const categories = categoryMap(db);
  const preds = buildPredicates(query, categories);
  const products = db.products;

  const resultPreds: Record<FilterGroup, Predicate> = KB.b05
    ? { ...preds, price: (p) => (query.minPrice === undefined || p.price >= query.minPrice) && (query.maxPrice === undefined || p.price <= query.maxPrice) }
    : preds;
  const matched = products.filter((p) => matchesExcept(p, resultPreds));
  const sorted = sortProducts(matched, query.sort);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), totalPages);
  const items = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((p) => toSummary(p, categories));

  const pool = (except: FilterGroup[]) => products.filter((p) => matchesExcept(p, preds, except));

  const catPool = pool(["category"]);
  const categoryFacets = db.categories
    .map((c) => ({ value: c.slug, label: c.name, count: catPool.filter((p) => p.categoryId === c.id).length }))
    .filter((f) => f.count > 0 || f.value === query.category);

  const brandPool = pool(["brand"]);
  const brandCounts = new Map<string, { label: string; count: number }>();
  for (const p of brandPool) {
    const slug = brandSlug(p.brand);
    const entry = brandCounts.get(slug) ?? { label: p.brand, count: 0 };
    entry.count += 1;
    brandCounts.set(slug, entry);
  }
  for (const b of query.brands) {
    if (!brandCounts.has(b)) {
      const product = products.find((p) => brandSlug(p.brand) === b);
      brandCounts.set(b, { label: product?.brand ?? b, count: 0 });
    }
  }
  const brandFacets = [...brandCounts.entries()]
    .map(([value, v]) => ({ value, label: v.label, count: v.count }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const pricePool = pool(["price"]);
  const priceFacets = PRICE_PRESETS.map((pr) => ({
    value: pr.key,
    label: pr.label,
    count: pricePool.filter((p) => (pr.min === undefined || p.price >= pr.min) && (pr.max === undefined || p.price < pr.max)).length,
  }));

  const ratingPool = pool(["rating"]);
  const ratingFacets = RATING_OPTIONS.map((r) => ({ value: String(r), label: `${r} & up`, count: ratingPool.filter((p) => p.rating >= r).length }));

  const discountPool = pool(["discount"]);
  const discountFacets = DISCOUNT_OPTIONS.map((d) => ({
    value: String(d),
    label: `${d}% off or more`,
    count: discountPool.filter((p) => discountPercent(p.price, p.mrp) >= d).length,
  }));

  const tagPool = pool(["tags"]);
  const tagFacets = TAG_OPTIONS.map((t) => ({ value: t.value, label: t.label, count: tagPool.filter((p) => p.tags.includes(t.value)).length }));

  const fast = pool(["fast"]).filter((p) => p.fastDelivery).length;
  const outOfStock = pool(["stock"]).filter((p) => p.stock <= 0).length;

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages,
    query: { ...query, page },
    facets: {
      categories: categoryFacets,
      brands: brandFacets,
      prices: priceFacets,
      ratings: ratingFacets,
      discounts: discountFacets,
      tags: tagFacets,
      fast,
      outOfStock,
    },
  };
}

export function findProductBySlug(db: DB, slug: string): Product | undefined {
  return db.products.find((p) => p.slug === slug);
}

export function findProduct(db: DB, id: string): Product | undefined {
  return db.products.find((p) => p.id === id);
}

export function productReviews(db: DB, productId: string): Review[] {
  return db.reviews.filter((r) => r.productId === productId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function relatedProducts(db: DB, product: Product, limit = 6): ProductSummary[] {
  const categories = categoryMap(db);
  return db.products
    .filter((p) => p.categoryId === product.categoryId && p.id !== product.id)
    .sort((a, b) => numericId(a.id) - numericId(b.id))
    .slice(0, limit)
    .map((p) => toSummary(p, categories));
}

/** Home page rows. Each product appears in at most one row. */
export function homeRows(db: DB, perRow = 12) {
  const categories = categoryMap(db);
  const used = new Set<string>();
  const take = (list: Product[]) => {
    const out = list.filter((p) => !used.has(p.id) && p.stock > 0).slice(0, perRow);
    out.forEach((p) => used.add(p.id));
    return out.map((p) => toSummary(p, categories));
  };
  const deals = take(sortProducts(db.products.filter((p) => p.tags.includes("deal")), "discount"));
  const bestsellers = take(sortProducts(db.products.filter((p) => p.tags.includes("bestseller")), "rating"));
  const newArrivals = take(sortProducts(db.products.filter((p) => p.tags.includes("new")), "newest"));
  const tiles = db.categories.map((c) => {
    const first = db.products.filter((p) => p.categoryId === c.id).sort((a, b) => numericId(a.id) - numericId(b.id))[0];
    return { ...c, image: first?.images[0] ?? "" };
  });
  return { deals, bestsellers, newArrivals, tiles };
}
