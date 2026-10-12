"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { EMPTY_ADDRESS, validateAddress, type AddressForm } from "@/lib/address";
import { TEST_CARDS, digitsOnly, formatCardNumber, formatExpiry, validateCard, type CardErrors, type CardInput } from "@/lib/card";
import type { CartView } from "@/lib/cart";
import { api } from "@/lib/client";
import { KB } from "@/lib/kb";
import { formatMoney, type Totals } from "@/lib/pricing";
import type { Address, DeliveryOption } from "@/lib/types";
import { AddressFormFields } from "./AddressFormFields";
import { OrderSummary } from "./OrderSummary";
import { OtpDialog } from "./OtpDialog";
import { useApp } from "./Providers";

type Step = "address" | "delivery" | "payment" | "review";
const STEPS: { key: Step; title: string }[] = [
  { key: "address", title: "Shipping address" },
  { key: "delivery", title: "Delivery option" },
  { key: "payment", title: "Payment method" },
  { key: "review", title: "Review your order" },
];

const KEY_STORAGE = "kartly-checkout-key";

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replace(/-/g, "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function getCheckoutKey(): string {
  let key = sessionStorage.getItem(KEY_STORAGE);
  if (!key) {
    key = newKey();
    sessionStorage.setItem(KEY_STORAGE, key);
  }
  return key;
}

function clearCheckoutKey() {
  sessionStorage.removeItem(KEY_STORAGE);
}

function AddressBlock({ a }: { a: Pick<Address, "fullName" | "line1" | "line2" | "city" | "state" | "zip" | "country" | "phone"> }) {
  return (
    <span className="block text-sm leading-snug">
      <span className="font-semibold">{a.fullName}</span>
      <br />
      {a.line1}
      {a.line2 ? `, ${a.line2}` : ""}
      <br />
      {a.city}, {a.state} {a.zip}, {a.country}
      <br />
      Phone: {a.phone}
    </span>
  );
}

export function CheckoutClient({ initialAddresses, cart }: { initialAddresses: Address[]; cart: CartView }) {
  const router = useRouter();
  const { setCartCount, toast } = useApp();
  const [step, setStep] = useState<Step>("address");
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState<string>(initialAddresses.find((a) => a.isDefault)?.id ?? initialAddresses[0]?.id ?? "");
  const [showForm, setShowForm] = useState(initialAddresses.length === 0);
  const [form, setForm] = useState<AddressForm>(EMPTY_ADDRESS);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [savingAddress, setSavingAddress] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryOption>("standard");
  const [card, setCard] = useState<CardInput>({ cardNumber: "", nameOnCard: "", expiry: "", cvv: "" });
  const [cardErrors, setCardErrors] = useState<CardErrors>({});
  const [paymentError, setPaymentError] = useState("");
  const [totals, setTotals] = useState<Totals>(cart.totals);
  const [placeError, setPlaceError] = useState("");
  const [placing, setPlacing] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const paymentIdRef = useRef<string | null>(null);
  const placingRef = useRef(false);
  const verifyingRef = useRef(false);
  const doneRef = useRef(false);
  const placeBtnRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef(false);

  // Return focus to Place order in the same commit that closes the OTP dialog.
  useLayoutEffect(() => {
    if (otpOpen || !returnFocusRef.current) return;
    returnFocusRef.current = false;
    placeBtnRef.current?.focus();
  }, [otpOpen]);
  const stepRefs = useRef<Record<Step, HTMLElement | null>>({ address: null, delivery: null, payment: null, review: null });

  const selectedAddress = addresses.find((a) => a.id === addressId);
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  useEffect(() => {
    if (!addressId) return;
    let cancelled = false;
    api<{ totals: Totals }>("/api/checkout/quote", { body: { addressId, deliveryOption: delivery } }).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setTotals(res.data.totals);
        setPlaceError("");
      } else {
        setPlaceError(res.error.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [addressId, delivery]);

  function goTo(next: Step) {
    setStep(next);
    requestAnimationFrame(() => {
      const el = stepRefs.current[next];
      el?.scrollIntoView({ block: "start", behavior: "smooth" });
      el?.querySelector<HTMLElement>("h2")?.focus();
    });
  }

  async function saveAddress() {
    const errors = validateAddress(form);
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    setSavingAddress(true);
    const res = await api<Address>("/api/addresses", { body: { ...form, line2: form.line2 || undefined } });
    setSavingAddress(false);
    if (!res.ok) {
      setFormErrors(res.error.fields ?? { fullName: res.error.message });
      return;
    }
    const created = res.data;
    setAddresses((list) => (created.isDefault ? list.map((a) => ({ ...a, isDefault: false })) : list).concat(created));
    setAddressId(created.id);
    setShowForm(false);
    setForm(EMPTY_ADDRESS);
    toast("Address saved");
  }

  function continueFromPayment() {
    const errors = validateCard(card);
    setCardErrors(errors);
    if (Object.keys(errors).length) return;
    setPaymentError("");
    goTo("review");
  }

  function finish(orderId: string) {
    doneRef.current = true;
    clearCheckoutKey();
    setOtpOpen(false);
    setCartCount(0);
    router.push(`/order/${orderId}/confirmation`);
  }

  function failBackToPayment(message: string) {
    clearCheckoutKey();
    paymentIdRef.current = null;
    setOtpOpen(false);
    setOtp("");
    setOtpError("");
    setPaymentError(message);
    goTo("payment");
  }

  async function placeOrder() {
    if (placingRef.current || doneRef.current) return;
    placingRef.current = true;
    setPlacing(true);
    setPlaceError("");
    const res = await api<{ paymentId: string; otpRequired: boolean; orderId?: string }>("/api/checkout/payment", {
      body: { ...card, cardNumber: digitsOnly(card.cardNumber), deliveryOption: delivery, addressId },
      headers: { "Idempotency-Key": getCheckoutKey() },
    });
    placingRef.current = false;
    setPlacing(false);
    if (!res.ok) {
      const code = res.error.code;
      if (code === "card_declined" || code === "card_unsupported" || code === "validation_error") {
        if (res.error.fields) setCardErrors(res.error.fields as CardErrors);
        failBackToPayment(res.error.message);
      } else {
        setPlaceError(res.error.message);
      }
      return;
    }
    if (res.data.orderId) {
      finish(res.data.orderId);
      return;
    }
    paymentIdRef.current = res.data.paymentId;
    setOtp("");
    setOtpError("");
    setOtpOpen(true);
  }

  async function verify() {
    if (verifyingRef.current || doneRef.current || !paymentIdRef.current) return;
    if (!/^\d{6}$/.test(otp)) {
      setOtpError("Enter the 6-digit OTP.");
      return;
    }
    verifyingRef.current = true;
    setOtpBusy(true);
    const res = await api<{ orderId: string; orderNumber: string }>("/api/checkout/verify-otp", {
      body: { paymentId: paymentIdRef.current, otp },
    });
    verifyingRef.current = false;
    setOtpBusy(false);
    if (res.ok) {
      finish(res.data.orderId);
      return;
    }
    const code = res.error.code;
    if (code === "otp_incorrect") {
      const left = Number(res.error.attemptsLeft ?? 0);
      setOtpError(`Incorrect OTP. ${left} ${left === 1 ? "attempt" : "attempts"} left.`);
      setOtp("");
    } else if (code === "otp_failed" || code === "payment_failed") {
      failBackToPayment(res.error.message);
    } else {
      clearCheckoutKey();
      paymentIdRef.current = null;
      setOtpError(res.error.message);
    }
  }

  function cancelOtp() {
    setOtpOpen(false);
    setOtp("");
    setOtpError("");
    returnFocusRef.current = !KB.b08;
  }

  const standardShipping = totals.subtotal - totals.discount >= 35 || cart.coupon?.status === "applied" && cart.coupon.code === "FREESHIP" ? 0 : 5.99;

  function StepShell({ s, summary, children }: { s: (typeof STEPS)[number]; summary?: ReactNode; children: ReactNode }) {
    const idx = STEPS.findIndex((x) => x.key === s.key);
    const active = s.key === step;
    const done = idx < stepIndex;
    return (
      <section
        ref={(el) => {
          stepRefs.current[s.key] = el;
        }}
        data-testid={`checkout-step-${s.key}`}
        aria-labelledby={`step-${s.key}-title`}
        className={`card scroll-mt-4 p-4 ${active ? "ring-2 ring-amber-400" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={`step-${s.key}-title`} tabIndex={-1} className={`text-lg font-bold outline-none ${active ? "text-orange-700" : done ? "" : "text-slate-500"}`}>
            {idx + 1}. {s.title}
          </h2>
          {done && s.key !== "review" && (
            <button type="button" onClick={() => goTo(s.key)} className="btn-link shrink-0">
              Change
            </button>
          )}
        </div>
        {done && summary && <div className="mt-2">{summary}</div>}
        {active && <div className="mt-3">{children}</div>}
      </section>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-2 py-4 md:px-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        <h1 className="text-2xl font-semibold">Checkout ({cart.count} {cart.count === 1 ? "item" : "items"})</h1>

        {StepShell({
          s: STEPS[0],
          summary: selectedAddress && <AddressBlock a={selectedAddress} />,
          children: (
            <div className="space-y-3">
              {addresses.length > 0 && (
                <fieldset>
                  <legend className="sr-only">Choose a shipping address</legend>
                  <div className="space-y-2">
                    {addresses.map((a) => (
                      <label
                        key={a.id}
                        data-testid={`address-option-${a.id}`}
                        className={`flex min-h-[44px] cursor-pointer gap-3 rounded-md border p-3 ${addressId === a.id ? "border-amber-500 bg-amber-50" : "border-slate-300"}`}
                      >
                        <input type="radio" name="address" className="tap-input" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                        <span className="min-w-0">
                          <AddressBlock a={a} />
                          {a.isDefault && <span className="mt-1 inline-block rounded bg-slate-200 px-1.5 text-xs">Default</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {addresses.length > 0 && !showForm && (
                <button type="button" data-testid="add-address-btn" onClick={() => setShowForm(true)} className="btn-outline">
                  + Add a new address
                </button>
              )}
              {showForm && (
                <div className="rounded-md border border-slate-300 p-3">
                  <h3 className="mb-2 font-semibold">{addresses.length === 0 ? "Enter a shipping address" : "Add a new address"}</h3>
                  <AddressFormFields
                    value={form}
                    errors={formErrors}
                    idPrefix="checkout-addr"
                    onChange={(next, key) => {
                      setForm(next);
                      setFormErrors((e) => ({ ...e, [key]: "" }));
                    }}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" data-testid="address-save-btn" onClick={saveAddress} disabled={savingAddress} className="btn-primary">
                      {savingAddress ? "Saving…" : "Save address"}
                    </button>
                    {addresses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowForm(false);
                          setFormErrors({});
                        }}
                        className="btn-outline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
              {addresses.length > 0 && (
                <button type="button" data-testid="address-continue" disabled={!selectedAddress} onClick={() => goTo("delivery")} className="btn-primary w-full sm:w-auto">
                  Use this address
                </button>
              )}
            </div>
          ),
        })}

        {StepShell({
          s: STEPS[1],
          summary: <p className="text-sm">{delivery === "express" ? "Express delivery (1 business day)" : "Standard delivery"}</p>,
          children: (
            <div className="space-y-2">
              <fieldset className="space-y-2">
                <legend className="sr-only">Choose a delivery option</legend>
                <label
                  data-testid="delivery-standard"
                  className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-md border p-3 ${delivery === "standard" ? "border-amber-500 bg-amber-50" : "border-slate-300"}`}
                >
                  <input type="radio" name="delivery" className="tap-input" checked={delivery === "standard"} onChange={() => setDelivery("standard")} />
                  <span className="text-sm">
                    <span className="font-semibold">Standard delivery</span> ({standardShipping === 0 ? "FREE" : formatMoney(standardShipping)})
                    <span className="block text-slate-600">Arrives in up to {Math.max(1, ...cart.items.map((i) => i.deliveryDays))} days. Free on orders of $35 or more.</span>
                  </span>
                </label>
                <label
                  data-testid="delivery-express"
                  className={`flex min-h-[44px] items-start gap-3 rounded-md border p-3 ${
                    !cart.expressAvailable ? "cursor-not-allowed bg-slate-50 text-slate-500" : delivery === "express" ? "cursor-pointer border-amber-500 bg-amber-50" : "cursor-pointer border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="delivery"
                    className="tap-input"
                    checked={delivery === "express"}
                    disabled={!cart.expressAvailable}
                    aria-describedby={!cart.expressAvailable ? "express-reason" : undefined}
                    onChange={() => setDelivery("express")}
                  />
                  <span className="text-sm">
                    <span className="font-semibold">Express delivery</span> ($9.99)
                    <span className="block">Arrives in 1 business day.</span>
                    {!cart.expressAvailable && (
                      <span id="express-reason" className="block text-red-700">
                        Not available: some items in your cart don&apos;t qualify for fast delivery.
                      </span>
                    )}
                  </span>
                </label>
              </fieldset>
              <button type="button" data-testid="delivery-continue" onClick={() => goTo("payment")} className="btn-primary w-full sm:w-auto">
                Continue to payment
              </button>
            </div>
          ),
        })}

        {StepShell({
          s: STEPS[2],
          summary: card.cardNumber && <p className="text-sm">Card ending in {digitsOnly(card.cardNumber).slice(-4)}</p>,
          children: (
            <div className="space-y-3">
              <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm" role="note" aria-label="Test cards">
                <p className="font-semibold">Test cards</p>
                <ul className="mt-1 space-y-0.5">
                  {TEST_CARDS.map((c) => (
                    <li key={c.number}>
                      <code>{c.number}</code>: {c.result}
                    </li>
                  ))}
                  <li>Any other valid card: not supported in test mode</li>
                  <li>Use any future expiry (MM/YY), any 3-digit CVV. OTP: 123456</li>
                </ul>
              </div>
              {paymentError && (
                <p data-testid="payment-error" role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {paymentError}
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="card-number" className="label">
                    Card number
                  </label>
                  <input
                    id="card-number"
                    data-testid="card-number"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={card.cardNumber}
                    onChange={(e) => {
                      setCard({ ...card, cardNumber: formatCardNumber(e.target.value) });
                      setCardErrors({ ...cardErrors, cardNumber: undefined });
                    }}
                    aria-invalid={Boolean(cardErrors.cardNumber)}
                    aria-describedby={cardErrors.cardNumber ? "card-number-error" : undefined}
                    className="input"
                  />
                  {cardErrors.cardNumber && <p id="card-number-error" className="field-error">{cardErrors.cardNumber}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="card-name" className="label">
                    Name on card
                  </label>
                  <input
                    id="card-name"
                    data-testid="card-name"
                    autoComplete="cc-name"
                    value={card.nameOnCard}
                    onChange={(e) => {
                      setCard({ ...card, nameOnCard: e.target.value });
                      setCardErrors({ ...cardErrors, nameOnCard: undefined });
                    }}
                    aria-invalid={Boolean(cardErrors.nameOnCard)}
                    aria-describedby={cardErrors.nameOnCard ? "card-name-error" : undefined}
                    className="input"
                  />
                  {cardErrors.nameOnCard && <p id="card-name-error" className="field-error">{cardErrors.nameOnCard}</p>}
                </div>
                <div>
                  <label htmlFor="card-expiry" className="label">
                    Expiry (MM/YY)
                  </label>
                  <input
                    id="card-expiry"
                    data-testid="card-expiry"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM/YY"
                    value={card.expiry}
                    onChange={(e) => {
                      setCard({ ...card, expiry: formatExpiry(e.target.value) });
                      setCardErrors({ ...cardErrors, expiry: undefined });
                    }}
                    aria-invalid={Boolean(cardErrors.expiry)}
                    aria-describedby={cardErrors.expiry ? "card-expiry-error" : undefined}
                    className="input"
                  />
                  {cardErrors.expiry && <p id="card-expiry-error" className="field-error">{cardErrors.expiry}</p>}
                </div>
                <div>
                  <label htmlFor="card-cvv" className="label">
                    CVV
                  </label>
                  <input
                    id="card-cvv"
                    data-testid="card-cvv"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    type="password"
                    maxLength={4}
                    value={card.cvv}
                    onChange={(e) => {
                      setCard({ ...card, cvv: digitsOnly(e.target.value).slice(0, 4) });
                      setCardErrors({ ...cardErrors, cvv: undefined });
                    }}
                    aria-invalid={Boolean(cardErrors.cvv)}
                    aria-describedby={cardErrors.cvv ? "card-cvv-error" : undefined}
                    className="input"
                  />
                  {cardErrors.cvv && <p id="card-cvv-error" className="field-error">{cardErrors.cvv}</p>}
                </div>
              </div>
              <button type="button" data-testid="payment-continue" onClick={continueFromPayment} className="btn-primary w-full sm:w-auto">
                Continue to review
              </button>
            </div>
          ),
        })}

        {StepShell({
          s: STEPS[3],
          children: (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Ship to</h3>
                    <button type="button" data-testid="review-edit-address" onClick={() => goTo("address")} className="btn-link">
                      Edit
                    </button>
                  </div>
                  {selectedAddress && <AddressBlock a={selectedAddress} />}
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Delivery</h3>
                    <button type="button" data-testid="review-edit-delivery" onClick={() => goTo("delivery")} className="btn-link">
                      Edit
                    </button>
                  </div>
                  <p className="text-sm">{delivery === "express" ? "Express (1 business day)" : "Standard"}</p>
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Payment</h3>
                    <button type="button" data-testid="review-edit-payment" onClick={() => goTo("payment")} className="btn-link">
                      Edit
                    </button>
                  </div>
                  <p className="text-sm">Card ending in {digitsOnly(card.cardNumber).slice(-4)}</p>
                  <p className="text-sm text-slate-600">{card.nameOnCard}</p>
                </div>
              </div>
              <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
                {cart.items.map((line) => (
                  <li key={line.lineId} className="flex gap-3 p-3">
                    <img src={line.image} alt={line.title} className="h-16 w-16 shrink-0 rounded bg-slate-50 object-contain" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="line-clamp-2 font-medium">{line.title}</p>
                      {line.variantLabel && <p className="text-slate-600">{line.variantLabel}</p>}
                      <p>
                        Qty {line.quantity} × {formatMoney(line.price)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">{formatMoney(line.lineTotal)}</p>
                  </li>
                ))}
              </ul>
              {placeError && (
                <div role="alert" data-testid="checkout-error" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {placeError}{" "}
                  <Link href="/cart" className="font-semibold underline">
                    Go to cart
                  </Link>
                </div>
              )}
              <div className="flex flex-col gap-3 rounded-md bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-lg font-bold text-brand-price">
                  Order total: <span data-testid="review-total">{formatMoney(totals.total)}</span>
                </p>
                <button
                  ref={placeBtnRef}
                  type="button"
                  data-testid="place-order-btn"
                  aria-busy={placing}
                  onClick={placeOrder}
                  className="btn-primary w-full sm:w-auto"
                >
                  {placing ? "Placing order…" : "Place your order"}
                </button>
              </div>
            </div>
          ),
        })}
      </div>

      <aside className="h-fit space-y-3 lg:sticky lg:top-4" aria-label="Order summary">
        <section className="card p-4">
          <OrderSummary totals={totals} couponCode={cart.coupon?.status === "applied" ? cart.coupon.code : undefined} />
          <p className="mt-2 text-xs text-slate-600">
            {cart.count} {cart.count === 1 ? "item" : "items"} · {delivery === "express" ? "Express" : "Standard"} delivery
          </p>
        </section>
      </aside>

      {otpOpen && <OtpDialog value={otp} error={otpError} busy={otpBusy} onChange={setOtp} onSubmit={verify} onCancel={cancelOtp} />}
    </div>
  );
}
