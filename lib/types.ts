export type UserStatus = "active" | "locked";

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  createdAt: string;
};

export type Session = { token: string; userId: string; createdAt: string; expiresAt: string };

export type Category = { id: string; name: string; slug: string };

export type ProductTag = "bestseller" | "new" | "deal";

export type Variant = { name: string; options: string[] };

export type Product = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  categoryId: string;
  description: string;
  highlights: string[];
  specs: Record<string, string>;
  images: string[];
  price: number;
  mrp: number;
  stock: number;
  maxPerOrder: number;
  rating: number;
  ratingCount: number;
  tags: ProductTag[];
  fastDelivery: boolean;
  deliveryDays: number;
  variants?: Variant[];
  createdAt: string;
};

export type Review = {
  id: string;
  productId: string;
  userName: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
};

export type CartLine = {
  lineId: string;
  productId: string;
  quantity: number;
  variant?: Record<string, string>;
  savedForLater: boolean;
  addedAt: string;
};

export type Cart = {
  id: string;
  userId?: string;
  guestId?: string;
  items: CartLine[];
  couponCode?: string;
  updatedAt: string;
};

export type Wishlist = { userId: string; productIds: string[] };

export type Address = {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault: boolean;
};

export type ShippingAddress = Omit<Address, "id" | "userId" | "isDefault">;

export type OrderStatus = "placed" | "shipped" | "delivered" | "cancelled";

export type DeliveryOption = "standard" | "express";

export type OrderItem = {
  productId: string;
  title: string;
  image: string;
  price: number;
  quantity: number;
  variant?: Record<string, string>;
};

export type Order = {
  id: string;
  orderNumber: string;
  userId: string;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  deliveryOption: DeliveryOption;
  payment: { method: "card"; last4: string; status: "paid"; transactionId: string };
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  couponCode?: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string }[];
  estimatedDelivery: string;
  createdAt: string;
};

export type CouponType = "percent" | "flat" | "freeship";

export type Coupon = {
  code: string;
  type: CouponType;
  value: number;
  minSubtotal: number;
  expiresAt: string;
  active: boolean;
};

export type DB = {
  users: User[];
  sessions: Session[];
  categories: Category[];
  products: Product[];
  reviews: Review[];
  carts: Cart[];
  wishlists: Wishlist[];
  addresses: Address[];
  orders: Order[];
  coupons: Coupon[];
  meta: { version: number; seededAt: string };
};

export type PublicUser = { id: string; name: string; email: string };
