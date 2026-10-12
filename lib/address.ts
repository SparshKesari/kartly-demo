import { z } from "zod";

const required = (label: string, max = 100) => z.string().trim().min(1, `Enter ${label}.`).max(max, `${label[0].toUpperCase()}${label.slice(1)} is too long.`);

export const addressFields = {
  fullName: required("a full name", 80),
  phone: z.string().trim().regex(/^\d{10}$/, "Phone must be 10 digits."),
  line1: required("an address", 120),
  line2: z.string().trim().max(120, "Address line 2 is too long.").optional(),
  city: required("a city", 60),
  state: required("a state", 60),
  zip: z.string().trim().regex(/^\d{5}$/, "ZIP must be 5 digits."),
  country: required("a country", 60),
};

export const addressSchema = z.object({ ...addressFields, isDefault: z.boolean().optional() });

export const addressPatchSchema = z
  .object({
    fullName: addressFields.fullName.optional(),
    phone: addressFields.phone.optional(),
    line1: addressFields.line1.optional(),
    line2: addressFields.line2,
    city: addressFields.city.optional(),
    state: addressFields.state.optional(),
    zip: addressFields.zip.optional(),
    country: addressFields.country.optional(),
    isDefault: z.boolean().optional(),
  })
  .strict();

export type AddressInput = z.infer<typeof addressSchema>;

export const EMPTY_ADDRESS = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  zip: "",
  country: "United States",
};

export type AddressForm = typeof EMPTY_ADDRESS;

/** Client-side validation mirroring the API rules. Returns field errors. */
export function validateAddress(form: AddressForm): Record<string, string> {
  const parsed = addressSchema.safeParse(form);
  if (parsed.success) return {};
  const out: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0]);
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
