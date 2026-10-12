/** Card validation shared by the checkout form and the payment API. Pure functions only. */

export const SUCCESS_CARD = "4242424242424242";
export const DECLINED_CARD = "4000000000000002";

export const TEST_CARDS = [
  { number: "4242 4242 4242 4242", result: "Success after OTP" },
  { number: "4000 0000 0000 0002", result: "Declined" },
];

export const DECLINED_MESSAGE = "Your card was declined.";
export const UNSUPPORTED_MESSAGE = "This card is not supported in test mode.";

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCardNumber(value: string): string {
  return digitsOnly(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function formatExpiry(value: string): string {
  const d = digitsOnly(value).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

export function luhnValid(number: string): boolean {
  const digits = digitsOnly(number);
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Expiry in MM/YY; valid through the last day of that month. */
export function expiryValid(expiry: string, now: Date = new Date()): boolean {
  const m = /^(\d{2})\/(\d{2})$/.exec(expiry.trim());
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth() + 1;
  return year > nowYear || (year === nowYear && month >= nowMonth);
}

export type CardInput = { cardNumber: string; nameOnCard: string; expiry: string; cvv: string };

export type CardErrors = Partial<Record<keyof CardInput, string>>;

export function validateCard(input: CardInput, now: Date = new Date()): CardErrors {
  const errors: CardErrors = {};
  const number = digitsOnly(input.cardNumber);
  if (!number) errors.cardNumber = "Enter your card number.";
  else if (!luhnValid(number)) errors.cardNumber = "Enter a valid card number.";
  if (!input.nameOnCard.trim()) errors.nameOnCard = "Enter the name on the card.";
  if (!input.expiry.trim()) errors.expiry = "Enter the expiry date.";
  else if (!/^\d{2}\/\d{2}$/.test(input.expiry.trim())) errors.expiry = "Use the format MM/YY.";
  else if (!expiryValid(input.expiry, now)) errors.expiry = "This card has expired.";
  if (!/^\d{3}$/.test(input.cvv.trim())) errors.cvv = "CVV must be 3 digits.";
  return errors;
}
