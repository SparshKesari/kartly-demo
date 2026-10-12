import { ApiError } from "./api";
import { newId } from "./auth";
import { categoryMap } from "./catalog";
import { KB } from "./kb";
import { computeTotals, evaluateCoupon, lineTotal, subtotalOf, type CouponStatus, type Totals } from "./pricing";
import type { Cart, CartLine, DB, DeliveryOption, Product } from "./types";

export type CartOwner = { userId?: string; guestId?: string };

export type CartLineView = {
  lineId: string;
  productId: string;
  slug: string;
  title: string;
  brand: string;
  categorySlug: string;
  image: string;
  price: number;
  mrp: number;
  quantity: number;
  variant?: Record<string, string>;
  variantLabel: string;
  stock: number;
  maxQty: number;
  fastDelivery: boolean;
  deliveryDays: number;
  lineTotal: number;
  savedForLater: boolean;
  warning: string | null;
};

export type CartCouponView = { code: string; status: CouponStatus; message: string };

export type CartView = {
  id: string | null;
  items: CartLineView[];
  saved: CartLineView[];
  count: number;
  coupon: CartCouponView | null;
  totals: Totals;
  hasIssues: boolean;
  expressAvailable: boolean;
};

export function maxQtyFor(product: Product): number {
  return Math.max(0, Math.min(product.stock, product.maxPerOrder));
}

export function variantLabel(variant?: Record<string, string>): string {
  if (!variant) return "";
  return Object.entries(variant)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

/** lineId = productId plus variant option values (in the product's variant order), lowercased, joined with "-". */
export function computeLineId(product: Product, variant?: Record<string, string>): string {
  if (!product.variants?.length || !variant) return product.id;
  return [product.id, ...product.variants.map((v) => String(variant[v.name] ?? "").toLowerCase())].join("-");
}

/** Validates a variant selection against the product, returning it in canonical form. */
export function normalizeVariant(product: Product, input?: Record<string, string>): Record<string, string> | undefined {
  if (!product.variants?.length) return undefined;
  const out: Record<string, string> = {};
  for (const v of product.variants) {
    const raw = input ? Object.entries(input).find(([k]) => k.toLowerCase() === v.name.toLowerCase())?.[1] : undefined;
    const option = raw ? v.options.find((o) => o.toLowerCase() === String(raw).toLowerCase()) : undefined;
    if (!option) {
      throw new ApiError(422, "unprocessable", `Please select ${v.name}.`, { [`variant.${v.name}`]: `Please select ${v.name}.` });
    }
    out[v.name] = option;
  }
  return out;
}

export function findCart(db: DB, owner: CartOwner): Cart | undefined {
  if (owner.userId) return db.carts.find((c) => c.userId === owner.userId);
  if (owner.guestId) return db.carts.find((c) => !c.userId && c.guestId === owner.guestId);
  return undefined;
}

export function getOrCreateCart(db: DB, owner: CartOwner): Cart {
  const existing = findCart(db, owner);
  if (existing) return existing;
  if (!owner.userId && !owner.guestId) throw new ApiError(400, "bad_request", "No cart owner.");
  const cart: Cart = { id: newId("cart"), items: [], updatedAt: new Date().toISOString() };
  if (owner.userId) cart.userId = owner.userId;
  else cart.guestId = owner.guestId;
  db.carts.push(cart);
  return cart;
}

function requireProduct(db: DB, productId: string): Product {
  const product = db.products.find((p) => p.id === productId);
  if (!product) throw new ApiError(404, "not_found", "Product not found.");
  return product;
}

function touch(cart: Cart) {
  cart.updatedAt = new Date().toISOString();
}

export type AddResult = { lineId: string; quantity: number; added: number; capped: boolean; message: string };

/** Adds a product to the cart, capping the line at min(stock, maxPerOrder). */
export function addItem(db: DB, cart: Cart, productId: string, quantity: number, variantInput?: Record<string, string>): AddResult {
  const product = requireProduct(db, productId);
  const variant = normalizeVariant(product, variantInput);
  const max = maxQtyFor(product);
  if (product.stock <= 0) throw new ApiError(409, "out_of_stock", "This item is out of stock.");
  const lineId = computeLineId(product, variant);
  let line = cart.items.find((l) => l.lineId === lineId);
  const current = line && !line.savedForLater ? line.quantity : 0;
  if (line?.savedForLater) {
    line.savedForLater = false;
  }
  if (current >= max) {
    throw new ApiError(409, "out_of_stock", `You already have the maximum quantity (${max}) of this item in your cart.`);
  }
  const target = Math.min(current + quantity, max);
  const capped = current + quantity > max;
  if (!line) {
    line = { lineId, productId, quantity: target, savedForLater: false, addedAt: new Date().toISOString() };
    if (variant) line.variant = variant;
    cart.items.push(line);
  } else {
    line.quantity = target;
  }
  touch(cart);
  const added = target - current;
  return {
    lineId,
    quantity: target,
    added,
    capped,
    message: capped ? `Only ${max} available. Quantity set to ${max}.` : "Added to cart",
  };
}

export function updateItem(db: DB, cart: Cart, lineId: string, patch: { quantity?: number; savedForLater?: boolean }): CartLine {
  const line = cart.items.find((l) => l.lineId === lineId);
  if (!line) throw new ApiError(404, "not_found", "Cart item not found.");
  const product = requireProduct(db, line.productId);
  if (patch.quantity !== undefined && patch.quantity !== line.quantity) {
    const max = maxQtyFor(product);
    if (patch.quantity > line.quantity && patch.quantity > max) {
      throw new ApiError(409, "out_of_stock", max > 0 ? `Only ${max} available.` : "This item is out of stock.", undefined, { available: max });
    }
    line.quantity = patch.quantity;
  }
  if (patch.savedForLater !== undefined) line.savedForLater = patch.savedForLater;
  touch(cart);
  return line;
}

export function removeItem(cart: Cart, lineId: string): void {
  const before = cart.items.length;
  cart.items = cart.items.filter((l) => l.lineId !== lineId);
  if (cart.items.length === before) throw new ApiError(404, "not_found", "Cart item not found.");
  touch(cart);
}

export function activeSubtotal(db: DB, cart: Cart): number {
  const lines = cart.items
    .filter((l) => !l.savedForLater)
    .map((l) => ({ price: db.products.find((p) => p.id === l.productId)?.price ?? 0, quantity: l.quantity }));
  return subtotalOf(lines);
}

/** Applies a coupon; only succeeds when it is valid for the current subtotal. */
export function applyCoupon(db: DB, cart: Cart, code: string) {
  const evaluation = evaluateCoupon(code, db.coupons, activeSubtotal(db, cart));
  if (evaluation.status === "invalid") throw new ApiError(422, "coupon_invalid", evaluation.message);
  if (evaluation.status === "expired") throw new ApiError(422, "coupon_expired", evaluation.message);
  if (evaluation.status === "min_not_met") throw new ApiError(422, "coupon_min_not_met", evaluation.message);
  cart.couponCode = evaluation.code;
  touch(cart);
  return evaluation;
}

export function removeCoupon(cart: Cart): void {
  delete cart.couponCode;
  touch(cart);
}

function lineWarning(product: Product, quantity: number): string | null {
  if (product.stock <= 0) return "This item is out of stock. Remove it to continue.";
  if (quantity > product.stock) return `Only ${product.stock} left. Please update your cart.`;
  if (quantity > product.maxPerOrder) return `Limit ${product.maxPerOrder} per order. Please update your cart.`;
  return null;
}

export function emptyCartView(): CartView {
  return {
    id: null,
    items: [],
    saved: [],
    count: 0,
    coupon: null,
    totals: { subtotal: 0, discount: 0, shipping: 0, tax: 0, total: 0 },
    hasIssues: false,
    expressAvailable: false,
  };
}

/** Builds the cart as shown to the shopper: live prices, stock warnings, coupon state and totals. */
export function buildCartView(db: DB, cart: Cart | undefined, deliveryOption: DeliveryOption = "standard"): CartView {
  if (!cart) return emptyCartView();
  const categories = categoryMap(db);
  const views: CartLineView[] = [];
  for (const line of cart.items) {
    const product = db.products.find((p) => p.id === line.productId);
    if (!product) continue;
    views.push({
      lineId: line.lineId,
      productId: product.id,
      slug: product.slug,
      title: product.title,
      brand: product.brand,
      categorySlug: categories.get(product.categoryId)?.slug ?? "",
      image: product.images[0] ?? "",
      price: product.price,
      mrp: product.mrp,
      quantity: line.quantity,
      variant: line.variant,
      variantLabel: variantLabel(line.variant),
      stock: product.stock,
      maxQty: maxQtyFor(product),
      fastDelivery: product.fastDelivery,
      deliveryDays: product.deliveryDays,
      lineTotal: lineTotal(product.price, line.quantity),
      savedForLater: line.savedForLater,
      warning: line.savedForLater ? null : lineWarning(product, line.quantity),
    });
  }
  const items = views.filter((v) => !v.savedForLater);
  const saved = views.filter((v) => v.savedForLater);
  const subtotal = subtotalOf(items);
  let coupon: CartCouponView | null = null;
  let appliedCoupon;
  if (cart.couponCode) {
    const evaluation = evaluateCoupon(cart.couponCode, db.coupons, subtotal);
    coupon = { code: evaluation.code, status: evaluation.status, message: evaluation.message };
    if (evaluation.status === "applied") appliedCoupon = evaluation.coupon;
  }
  const totals = computeTotals({ subtotal, coupon: appliedCoupon, deliveryOption });
  return {
    id: cart.id,
    items,
    saved,
    count: items.reduce((n, l) => n + l.quantity, 0),
    coupon,
    totals,
    hasIssues: items.some((l) => l.warning !== null),
    expressAvailable: items.length > 0 && items.every((l) => l.fastDelivery),
  };
}

export function cartCount(db: DB, owner: CartOwner): number {
  const cart = findCart(db, owner);
  if (!cart) return 0;
  return cart.items.filter((l) => !l.savedForLater).reduce((n, l) => n + l.quantity, 0);
}

/**
 * Merges the guest cart into the user's cart. Quantities of matching lines add up,
 * capped at min(stock, maxPerOrder). The guest cart is deleted. Returns the number
 * of units merged.
 */
export function mergeGuestCart(db: DB, guestId: string | undefined, userId: string): number {
  if (!guestId) return 0;
  const guestCart = db.carts.find((c) => !c.userId && c.guestId === guestId);
  if (!guestCart) return 0;
  db.carts = db.carts.filter((c) => c !== guestCart);
  if (guestCart.items.length === 0) return 0;
  const userCart = getOrCreateCart(db, { userId });
  let merged = 0;
  for (const line of guestCart.items) {
    const product = db.products.find((p) => p.id === line.productId);
    if (!product) continue;
    const max = maxQtyFor(product);
    const existing = userCart.items.find((l) => l.lineId === line.lineId);
    if (existing) {
      const before = existing.quantity;
      const combined = KB.b02 ? Math.min(line.quantity, max) : Math.min(before + line.quantity, Math.max(max, before));
      existing.quantity = combined;
      if (!line.savedForLater) existing.savedForLater = false;
      merged += combined - before;
    } else {
      const quantity = max > 0 ? Math.min(line.quantity, max) : line.quantity;
      userCart.items.push({ ...line, quantity });
      merged += quantity;
    }
  }
  if (!userCart.couponCode && guestCart.couponCode) userCart.couponCode = guestCart.couponCode;
  touch(userCart);
  return merged;
}
