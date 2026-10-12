/**
 * Builds the Kartly catalog and demo data deterministically.
 * Writes data/seed.json (pristine copy) and $KARTLY_DATA_DIR/db.json (live db).
 */
import fs from "fs";
import path from "path";
import { fallbackProducts, type RawProduct } from "./fallback-products";
import { computeTotals, evaluateCoupon, subtotalOf } from "../lib/pricing";
import { slugify, titleCaseFromSlug, addDays } from "../lib/util";
import type {
  Address,
  Cart,
  CartLine,
  Category,
  Coupon,
  DB,
  DeliveryOption,
  Order,
  OrderStatus,
  Product,
  ProductTag,
  Review,
  User,
  Wishlist,
} from "../lib/types";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const SOURCE_FILE = path.join(DATA_DIR, "source-products.json");
const SEED_FILE = path.join(DATA_DIR, "seed.json");
const LIVE_DIR = path.resolve(ROOT, process.env.KARTLY_DATA_DIR || "./data");
const LIVE_FILE = path.join(LIVE_DIR, "db.json");
const PUBLIC_PRODUCTS = path.join(ROOT, "public", "products");

const SEEDED_AT = "2026-10-01T00:00:00.000Z";
/** bcrypt hash of "Password@123" (fixed so the seed is byte-identical across runs). */
const PASSWORD_HASH = "$2a$10$Q5c6oYv3L0svBVKYX.BpU.Qg9vawLIxWo3.nauL3E99WRxp3RZYQ6";

const PHONE_TABLET_VARIANTS = [
  { name: "Color", options: ["Black", "Silver"] },
  { name: "Storage", options: ["128GB", "256GB"] },
];
const APPAREL_CATEGORIES = ["mens-shirts", "tops", "womens-dresses"];
const SHOE_CATEGORIES = ["mens-shoes", "womens-shoes"];
const STOCK_OVERRIDE_CATEGORIES = ["beauty", "groceries", "laptops", "smartphones", "tops"];

function log(msg: string) {
  process.stdout.write(`[seed] ${msg}\n`);
}

async function loadSource(): Promise<{ products: RawProduct[]; offline: boolean }> {
  if (process.env.KARTLY_SEED_OFFLINE === "1") {
    log("KARTLY_SEED_OFFLINE=1: using the offline fallback catalog");
    return { products: fallbackProducts(), offline: true };
  }
  if (fs.existsSync(SOURCE_FILE)) {
    log(`using cached ${path.relative(ROOT, SOURCE_FILE)}`);
    const raw = JSON.parse(fs.readFileSync(SOURCE_FILE, "utf8")) as { products: RawProduct[] };
    return { products: raw.products, offline: false };
  }
  try {
    log("fetching https://dummyjson.com/products?limit=0");
    const res = await fetch("https://dummyjson.com/products?limit=0", { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const raw = JSON.parse(text) as { products: RawProduct[] };
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SOURCE_FILE, text);
    return { products: raw.products, offline: false };
  } catch (err) {
    log(`fetch failed (${(err as Error).message}); using offline fallback catalog`);
    return { products: fallbackProducts(), offline: true };
  }
}

function round2(n: number) {
  return Math.round(n * 100 + 1e-7) / 100;
}

const CATEGORY_COLORS = ["#0f766e", "#7c3aed", "#b45309", "#be123c", "#1d4ed8", "#15803d", "#a21caf", "#c2410c", "#0369a1", "#4d7c0f"];

function placeholderSvg(title: string, category: string): string {
  const initials = title
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  let hash = 0;
  for (const ch of category) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const color = CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="${color}"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="200" font-weight="700" fill="#ffffff">${initials || "K"}</text></svg>\n`;
}

async function downloadImage(url: string, destNoExt: string): Promise<string | null> {
  const ext = (path.extname(new URL(url).pathname) || ".jpg").toLowerCase();
  const dest = `${destNoExt}${ext}`;
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new Error("empty body");
      fs.writeFileSync(dest, buf);
      return dest;
    } catch {
      // retry
    }
  }
  return null;
}

async function resolveImages(raw: RawProduct, slug: string, offline: boolean): Promise<string[]> {
  const dir = path.join(PUBLIC_PRODUCTS, slug);
  fs.mkdirSync(dir, { recursive: true });
  const urls = offline ? [] : [raw.thumbnail, ...raw.images].filter(Boolean).slice(0, 4);
  const results: string[] = [];
  if (urls.length === 0) {
    const file = path.join(dir, "0.svg");
    fs.writeFileSync(file, placeholderSvg(raw.title, raw.category));
    return [`/products/${slug}/0.svg`];
  }
  for (let i = 0; i < urls.length; i++) {
    const existingSvg = path.join(dir, `${i}.svg`);
    const saved = await downloadImage(urls[i], path.join(dir, String(i)));
    if (saved) {
      if (fs.existsSync(existingSvg)) fs.unlinkSync(existingSvg);
      results.push(`/products/${slug}/${path.basename(saved)}`);
    } else {
      fs.writeFileSync(existingSvg, placeholderSvg(raw.title, raw.category));
      results.push(`/products/${slug}/${i}.svg`);
    }
  }
  return results;
}

async function mapPool<T, R>(items: T[], size: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

function firstSentence(text: string): string {
  const m = text.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : text).trim();
}

function buildCatalog(rawProducts: RawProduct[], perCategory: number) {
  const byCategory = new Map<string, RawProduct[]>();
  for (const p of [...rawProducts].sort((a, b) => a.id - b.id)) {
    const list = byCategory.get(p.category) ?? [];
    list.push(p);
    byCategory.set(p.category, list);
  }
  const categorySlugs = [...byCategory.keys()].sort();
  const picked: RawProduct[] = [];
  for (const slug of categorySlugs) picked.push(...byCategory.get(slug)!.slice(0, perCategory));

  const categories: Category[] = categorySlugs.map((slug) => ({ id: `c_${slug}`, name: titleCaseFromSlug(slug), slug }));
  const positions = new Map<number, number>();
  for (const slug of categorySlugs) byCategory.get(slug)!.slice(0, perCategory).forEach((p, i) => positions.set(p.id, i + 1));
  const newestInCategory = new Map<string, number>();
  for (const p of picked) newestInCategory.set(p.category, Math.max(newestInCategory.get(p.category) ?? 0, p.id));

  return { categories, picked, positions, newestInCategory };
}

function mapProduct(
  raw: RawProduct,
  images: string[],
  position: number,
  newestId: number,
  categoryName: string,
): Product {
  const slug = `${slugify(raw.title)}-${raw.id}`;
  const brand = raw.brand && raw.brand.trim() ? raw.brand.trim() : "Kartly Basics";
  const tags: ProductTag[] = [];
  if (raw.rating >= 4.5) tags.push("bestseller");
  if (raw.id === newestId) tags.push("new");
  if (raw.discountPercentage >= 15) tags.push("deal");

  let stock = raw.stock;
  if (STOCK_OVERRIDE_CATEGORIES.includes(raw.category)) {
    if (position === 2) stock = 0;
    if (position === 3) stock = 3;
  }

  let variants: Product["variants"];
  if (raw.category === "smartphones" || raw.category === "tablets") variants = PHONE_TABLET_VARIANTS.map((v) => ({ ...v, options: [...v.options] }));
  else if (APPAREL_CATEGORIES.includes(raw.category)) variants = [{ name: "Size", options: ["S", "M", "L"] }];
  else if (SHOE_CATEGORIES.includes(raw.category)) variants = [{ name: "Size", options: ["7", "8", "9", "10"] }];

  const d = raw.dimensions;
  const product: Product = {
    id: `p${raw.id}`,
    slug,
    title: raw.title,
    brand,
    categoryId: `c_${raw.category}`,
    description: raw.description,
    highlights: [
      firstSentence(raw.description),
      raw.warrantyInformation || "Standard manufacturer warranty",
      [raw.shippingInformation, raw.returnPolicy].filter(Boolean).join(". ") || "Ships with tracking",
    ],
    specs: {
      Brand: brand,
      Category: categoryName,
      Weight: `${raw.weight} kg`,
      Dimensions: d ? `${d.width} x ${d.height} x ${d.depth} cm` : "Not specified",
      SKU: raw.sku,
      Warranty: raw.warrantyInformation || "Not specified",
    },
    images,
    price: raw.price,
    mrp: round2(raw.price / (1 - raw.discountPercentage / 100)),
    stock,
    maxPerOrder: 10,
    rating: raw.rating,
    ratingCount: raw.reviews.length * 37,
    tags,
    fastDelivery: raw.id % 3 !== 0,
    deliveryDays: (raw.id % 5) + 1,
    createdAt: raw.meta.createdAt,
  };
  if (variants) product.variants = variants;
  return product;
}

function mapReviews(raw: RawProduct): Review[] {
  return raw.reviews.map((r, i) => ({
    id: `r_p${raw.id}_${i + 1}`,
    productId: `p${raw.id}`,
    userName: r.reviewerName,
    rating: r.rating,
    title: r.comment.split(/\s+/).slice(0, 5).join(" "),
    body: r.comment,
    createdAt: r.date,
  }));
}

function lineIdFor(productId: string, product: Product | undefined, variant?: Record<string, string>): string {
  if (!variant || !product?.variants) return productId;
  return [productId, ...product.variants.map((v) => variant[v.name].toLowerCase())].join("-");
}

async function main() {
  const { products: rawProducts, offline } = await loadSource();
  // Online: first 4 products per category. Offline fallback: keep all 60 generated products.
  const { categories, picked, positions, newestInCategory } = buildCatalog(rawProducts, offline ? Infinity : 4);
  const categoryName = new Map(categories.map((c) => [c.slug, c.name]));

  log(`${picked.length} products across ${categories.length} categories; resolving images`);
  let placeholders = 0;
  const imageLists = await mapPool(picked, 8, async (raw) => {
    const slug = `${slugify(raw.title)}-${raw.id}`;
    const imgs = await resolveImages(raw, slug, offline);
    placeholders += imgs.filter((i) => i.endsWith(".svg")).length;
    return imgs;
  });
  if (placeholders) log(`${placeholders} image(s) replaced by SVG placeholders`);

  const products = picked.map((raw, i) =>
    mapProduct(raw, imageLists[i], positions.get(raw.id)!, newestInCategory.get(raw.category)!, categoryName.get(raw.category)!),
  );
  const reviews = picked.flatMap(mapReviews);

  const nth = (category: string, n: number): Product | undefined =>
    products.filter((p) => p.categoryId === `c_${category}`)[n - 1];

  // Users
  const userRows: [string, string, string, User["status"]][] = [
    ["u_alice", "Alice Johnson", "alice@kartly.test", "active"],
    ["u_bob", "Bob Smith", "bob@kartly.test", "active"],
    ["u_carol", "Carol Diaz", "carol@kartly.test", "active"],
    ["u_dave", "Dave Wilson", "dave@kartly.test", "active"],
    ["u_erin", "Erin Lee", "erin@kartly.test", "active"],
    ["u_frank", "Frank Moore", "frank@kartly.test", "active"],
    ["u_locked", "Lena Locke", "locked@kartly.test", "locked"],
    ["u_c01", "Priya Raman", "priya.raman@example.com", "active"],
    ["u_c02", "Marcus Chen", "marcus.chen@example.com", "active"],
    ["u_c03", "Sofia Garcia", "sofia.garcia@example.com", "active"],
    ["u_c04", "Daniel Okafor", "daniel.okafor@example.com", "active"],
    ["u_c05", "Hannah Schmidt", "hannah.schmidt@example.com", "active"],
    ["u_c06", "Yuki Tanaka", "yuki.tanaka@example.com", "active"],
    ["u_c07", "Omar Haddad", "omar.haddad@example.com", "active"],
    ["u_c08", "Grace Williams", "grace.williams@example.com", "active"],
  ];
  const users: User[] = userRows.map(([id, name, email, status], i) => ({
    id,
    name,
    email,
    passwordHash: PASSWORD_HASH,
    status,
    createdAt: addDays(new Date("2025-01-15T09:00:00.000Z"), i * 7).toISOString(),
  }));

  // Addresses
  const addresses: Address[] = [
    { id: "a_alice_home", userId: "u_alice", fullName: "Alice Johnson", phone: "4155550101", line1: "742 Evergreen Terrace", line2: "Apt 2B", city: "San Francisco", state: "CA", zip: "94110", country: "United States", isDefault: true },
    { id: "a_alice_work", userId: "u_alice", fullName: "Alice Johnson", phone: "4155550102", line1: "1 Market Street", line2: "Floor 12", city: "San Francisco", state: "CA", zip: "94105", country: "United States", isDefault: false },
    { id: "a_bob_home", userId: "u_bob", fullName: "Bob Smith", phone: "2125550111", line1: "350 Fifth Avenue", city: "New York", state: "NY", zip: "10118", country: "United States", isDefault: true },
    { id: "a_carol_home", userId: "u_carol", fullName: "Carol Diaz", phone: "3125550122", line1: "233 S Wacker Drive", city: "Chicago", state: "IL", zip: "60606", country: "United States", isDefault: true },
    { id: "a_dave_home", userId: "u_dave", fullName: "Dave Wilson", phone: "2065550133", line1: "400 Broad Street", city: "Seattle", state: "WA", zip: "98109", country: "United States", isDefault: true },
    { id: "a_erin_home", userId: "u_erin", fullName: "Erin Lee", phone: "6175550144", line1: "100 Cambridge Street", city: "Boston", state: "MA", zip: "02114", country: "United States", isDefault: true },
  ];

  // Coupons
  const coupons: Coupon[] = [
    { code: "SAVE10", type: "percent", value: 10, minSubtotal: 50, expiresAt: "2099-12-31T23:59:59.000Z", active: true },
    { code: "FLAT20", type: "flat", value: 20, minSubtotal: 100, expiresAt: "2099-12-31T23:59:59.000Z", active: true },
    { code: "FREESHIP", type: "freeship", value: 0, minSubtotal: 0, expiresAt: "2099-12-31T23:59:59.000Z", active: true },
    { code: "EXPIRED15", type: "percent", value: 15, minSubtotal: 0, expiresAt: "2024-01-01T00:00:00.000Z", active: true },
  ];

  // Carts
  const line = (product: Product | undefined, quantity: number, addedAt: string, variant?: Record<string, string>, savedForLater = false): CartLine[] => {
    if (!product) return [];
    const l: CartLine = { lineId: lineIdFor(product.id, product, variant), productId: product.id, quantity, savedForLater, addedAt };
    if (variant && product.variants) l.variant = variant;
    return [l];
  };
  const carts: Cart[] = [
    {
      id: "cart_alice",
      userId: "u_alice",
      items: [
        ...line(nth("smartphones", 1), 1, "2026-09-28T10:00:00.000Z", { Color: "Black", Storage: "128GB" }),
        ...line(nth("laptops", 1), 1, "2026-09-28T10:05:00.000Z"),
        ...line(nth("mens-shoes", 1), 2, "2026-09-28T10:10:00.000Z", { Size: "9" }),
      ],
      updatedAt: "2026-09-28T10:10:00.000Z",
    },
    { id: "cart_bob", userId: "u_bob", items: [], updatedAt: SEEDED_AT },
    {
      id: "cart_carol",
      userId: "u_carol",
      items: [...line(nth("laptops", 2), 1, "2026-09-29T09:00:00.000Z"), ...line(nth("beauty", 3), 5, "2026-09-29T09:05:00.000Z")],
      updatedAt: "2026-09-29T09:05:00.000Z",
    },
    {
      id: "cart_dave",
      userId: "u_dave",
      items: [
        ...line(nth("furniture", 1), 1, "2026-09-30T08:00:00.000Z"),
        ...line(nth("sunglasses", 1), 1, "2026-09-30T08:05:00.000Z", undefined, true),
        ...line(nth("womens-bags", 1), 1, "2026-09-30T08:10:00.000Z", undefined, true),
      ],
      couponCode: "SAVE10",
      updatedAt: "2026-09-30T08:10:00.000Z",
    },
  ];

  // Wishlists
  const wishlists: Wishlist[] = [
    {
      userId: "u_alice",
      productIds: ["beauty", "fragrances", "furniture", "sunglasses", "womens-bags"].map((c) => nth(c, 1)?.id).filter((x): x is string => Boolean(x)),
    },
  ];

  // Orders
  const addressSnapshot = (id: string) => {
    const a = addresses.find((x) => x.id === id)!;
    const snap: Order["shippingAddress"] = { fullName: a.fullName, phone: a.phone, line1: a.line1, city: a.city, state: a.state, zip: a.zip, country: a.country };
    if (a.line2) snap.line2 = a.line2;
    return snap;
  };
  const orders: Order[] = [];
  const makeOrder = (
    userId: string,
    addressId: string,
    createdAt: string,
    status: OrderStatus,
    lines: { product: Product | undefined; quantity: number; variant?: Record<string, string> }[],
    deliveryOption: DeliveryOption = "standard",
    couponCode?: string,
  ) => {
    const items = lines
      .filter((l): l is { product: Product; quantity: number; variant?: Record<string, string> } => Boolean(l.product))
      .map((l) => {
        const item: Order["items"][number] = { productId: l.product.id, title: l.product.title, image: l.product.images[0], price: l.product.price, quantity: l.quantity };
        if (l.variant) item.variant = l.variant;
        return item;
      });
    if (items.length === 0) return;
    const n = orders.length + 1;
    const subtotal = subtotalOf(items);
    const evaluation = couponCode ? evaluateCoupon(couponCode, coupons, subtotal, new Date(createdAt)) : undefined;
    const coupon = evaluation?.status === "applied" ? evaluation.coupon : undefined;
    const totals = computeTotals({ subtotal, coupon, deliveryOption });
    const created = new Date(createdAt);
    const history: Order["statusHistory"] = [{ status: "placed", at: createdAt }];
    if (status === "shipped" || status === "delivered") history.push({ status: "shipped", at: addDays(created, 1).toISOString() });
    if (status === "delivered") history.push({ status: "delivered", at: addDays(created, 4).toISOString() });
    if (status === "cancelled") history.push({ status: "cancelled", at: new Date(created.getTime() + 2 * 3600 * 1000).toISOString() });
    const days = deliveryOption === "express" ? 1 : Math.max(...lines.map((l) => l.product?.deliveryDays ?? 1));
    const order: Order = {
      id: `o_seed_${String(n).padStart(4, "0")}`,
      orderNumber: `KRT-${String(n).padStart(6, "0")}`,
      userId,
      items,
      shippingAddress: addressSnapshot(addressId),
      deliveryOption,
      payment: { method: "card", last4: "4242", status: "paid", transactionId: `txn_seed_${String(n).padStart(4, "0")}` },
      ...totals,
      status,
      statusHistory: history,
      estimatedDelivery: addDays(created, days).toISOString(),
      createdAt,
    };
    if (coupon) order.couponCode = coupon.code;
    orders.push(order);
  };

  makeOrder("u_alice", "a_alice_home", "2026-08-02T15:20:00.000Z", "delivered", [
    { product: nth("sunglasses", 2), quantity: 1 },
    { product: nth("skin-care", 1), quantity: 2 },
  ]);
  makeOrder("u_alice", "a_alice_work", "2026-09-20T11:45:00.000Z", "shipped", [{ product: nth("fragrances", 2), quantity: 1 }], "express");
  makeOrder("u_alice", "a_alice_home", "2026-09-25T18:30:00.000Z", "cancelled", [{ product: nth("kitchen-accessories", 1), quantity: 3 }]);
  makeOrder("u_alice", "a_alice_home", "2026-10-05T09:15:00.000Z", "placed", [{ product: nth("mobile-accessories", 1), quantity: 1 }], "standard", "SAVE10");

  const erinStatuses: OrderStatus[] = ["placed", "shipped", "delivered", "cancelled"];
  const erinCategories = ["groceries", "home-decoration", "kitchen-accessories", "sports-accessories", "skin-care", "womens-jewellery", "sunglasses", "fragrances", "beauty", "mobile-accessories", "womens-bags", "furniture"];
  erinCategories.forEach((cat, i) => {
    const created = addDays(new Date("2026-06-01T12:00:00.000Z"), i * 9).toISOString();
    makeOrder("u_erin", "a_erin_home", created, erinStatuses[i % 4], [{ product: nth(cat, 1) ?? nth(cat, 2) ?? products[i], quantity: (i % 3) + 1 }]);
  });

  const db: DB = {
    users,
    sessions: [],
    categories,
    products,
    reviews,
    carts,
    wishlists,
    addresses,
    orders,
    coupons,
    meta: { version: 1, seededAt: SEEDED_AT },
  };

  const json = JSON.stringify(db, null, 2);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SEED_FILE, json);
  fs.mkdirSync(LIVE_DIR, { recursive: true });
  fs.writeFileSync(`${LIVE_FILE}.tmp`, json);
  fs.renameSync(`${LIVE_FILE}.tmp`, LIVE_FILE);
  log(`wrote ${path.relative(ROOT, SEED_FILE)} and ${LIVE_FILE}`);
  log(`${products.length} products, ${reviews.length} reviews, ${users.length} users, ${orders.length} orders`);
}

main().catch((err) => {
  process.stderr.write(`[seed] failed: ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});
