"use client";

import type { AddressForm } from "@/lib/address";

const FIELDS: { key: keyof AddressForm; label: string; testId: string; autoComplete: string; inputMode?: "numeric" | "tel"; optional?: boolean; half?: boolean }[] = [
  { key: "fullName", label: "Full name", testId: "address-fullname", autoComplete: "name" },
  { key: "phone", label: "Phone number (10 digits)", testId: "address-phone", autoComplete: "tel-national", inputMode: "tel" },
  { key: "line1", label: "Address line 1", testId: "address-line1", autoComplete: "address-line1" },
  { key: "line2", label: "Address line 2 (optional)", testId: "address-line2", autoComplete: "address-line2", optional: true },
  { key: "city", label: "City", testId: "address-city", autoComplete: "address-level2", half: true },
  { key: "state", label: "State", testId: "address-state", autoComplete: "address-level1", half: true },
  { key: "zip", label: "ZIP code (5 digits)", testId: "address-zip", autoComplete: "postal-code", inputMode: "numeric", half: true },
  { key: "country", label: "Country", testId: "address-country", autoComplete: "country-name", half: true },
];

export function AddressFormFields({
  value,
  errors,
  onChange,
  idPrefix = "addr",
}: {
  value: AddressForm;
  errors: Record<string, string>;
  onChange: (next: AddressForm, changedKey: keyof AddressForm) => void;
  idPrefix?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {FIELDS.map((f) => {
        const id = `${idPrefix}-${f.key}`;
        const err = errors[f.key];
        return (
          <div key={f.key} className={f.half ? "" : "sm:col-span-2"}>
            <label htmlFor={id} className="label">
              {f.label}
            </label>
            <input
              id={id}
              data-testid={f.testId}
              value={value[f.key]}
              autoComplete={f.autoComplete}
              inputMode={f.inputMode}
              required={!f.optional}
              aria-invalid={Boolean(err)}
              aria-describedby={err ? `${id}-error` : undefined}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.value }, f.key)}
              className="input"
            />
            {err && (
              <p id={`${id}-error`} className="field-error">
                {err}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
