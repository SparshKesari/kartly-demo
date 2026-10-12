"use client";

import { useState } from "react";
import { EMPTY_ADDRESS, validateAddress, type AddressForm } from "@/lib/address";
import { api } from "@/lib/client";
import type { Address } from "@/lib/types";
import { AddressFormFields } from "./AddressFormFields";
import { useApp } from "./Providers";

type Editing = { mode: "new" } | { mode: "edit"; id: string } | null;

function toForm(a: Address): AddressForm {
  return { fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2 ?? "", city: a.city, state: a.state, zip: a.zip, country: a.country };
}

export function AddressBook({ initial }: { initial: Address[] }) {
  const { toast } = useApp();
  const [addresses, setAddresses] = useState(initial);
  const [editing, setEditing] = useState<Editing>(initial.length === 0 ? { mode: "new" } : null);
  const [form, setForm] = useState<AddressForm>(EMPTY_ADDRESS);
  const [makeDefault, setMakeDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function reload() {
    const res = await api<Address[]>("/api/addresses");
    if (res.ok) setAddresses(res.data);
  }

  function startNew() {
    setEditing({ mode: "new" });
    setForm(EMPTY_ADDRESS);
    setMakeDefault(false);
    setErrors({});
  }

  function startEdit(a: Address) {
    setEditing({ mode: "edit", id: a.id });
    setForm(toForm(a));
    setMakeDefault(a.isDefault);
    setErrors({});
  }

  async function save() {
    const v = validateAddress(form);
    setErrors(v);
    if (Object.keys(v).length || !editing) return;
    setBusy(true);
    const body = { ...form, line2: form.line2, isDefault: makeDefault };
    const res =
      editing.mode === "new"
        ? await api<Address>("/api/addresses", { body: { ...body, line2: form.line2 || undefined } })
        : await api<Address>(`/api/addresses/${editing.id}`, { method: "PATCH", body });
    setBusy(false);
    if (!res.ok) {
      setErrors(res.error.fields ?? {});
      toast(res.error.message, "error");
      return;
    }
    toast(editing.mode === "new" ? "Address added" : "Address updated");
    setEditing(null);
    await reload();
  }

  async function remove(a: Address) {
    setBusy(true);
    const res = await api(`/api/addresses/${a.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      toast(res.error.message, "error");
      return;
    }
    toast("Address removed", "info");
    await reload();
  }

  async function setDefault(a: Address) {
    setBusy(true);
    const res = await api(`/api/addresses/${a.id}`, { method: "PATCH", body: { isDefault: true } });
    setBusy(false);
    if (!res.ok) {
      toast(res.error.message, "error");
      return;
    }
    toast("Default address updated");
    await reload();
  }

  return (
    <div className="space-y-4">
      {editing && (
        <section className="card p-4" aria-labelledby="address-form-title">
          <h2 id="address-form-title" className="mb-3 text-lg font-semibold">
            {editing.mode === "new" ? "Add a new address" : "Edit address"}
          </h2>
          <AddressFormFields
            value={form}
            errors={errors}
            idPrefix="book-addr"
            onChange={(next, key) => {
              setForm(next);
              setErrors((e) => ({ ...e, [key]: "" }));
            }}
          />
          <label className="mt-3 flex min-h-[40px] items-center gap-2 text-sm">
            <input type="checkbox" className="tap-input" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
            Make this my default address
          </label>
          <div className="mt-3 flex gap-2">
            <button type="button" data-testid="address-save-btn" onClick={save} disabled={busy} className="btn-primary">
              {busy ? "Saving…" : "Save address"}
            </button>
            {addresses.length > 0 && (
              <button type="button" onClick={() => setEditing(null)} className="btn-outline">
                Cancel
              </button>
            )}
          </div>
        </section>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {!editing && (
          <li>
            <button
              type="button"
              data-testid="add-address-btn"
              onClick={startNew}
              className="flex h-full min-h-[180px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white text-slate-600 hover:border-slate-400"
            >
              <span className="text-4xl" aria-hidden="true">
                +
              </span>
              <span className="font-semibold">Add address</span>
            </button>
          </li>
        )}
        {addresses.map((a) => (
          <li key={a.id} data-testid={`address-card-${a.id}`} className="card flex flex-col p-4">
            {a.isDefault && <span className="mb-2 w-fit rounded bg-slate-200 px-2 text-xs font-semibold">Default</span>}
            <p className="font-semibold">{a.fullName}</p>
            <p className="text-sm">
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ""}
            </p>
            <p className="text-sm">
              {a.city}, {a.state} {a.zip}
            </p>
            <p className="text-sm">{a.country}</p>
            <p className="text-sm">Phone: {a.phone}</p>
            <div className="mt-auto flex flex-wrap gap-x-3 pt-2">
              <button type="button" data-testid={`address-edit-${a.id}`} onClick={() => startEdit(a)} disabled={busy} className="btn-link">
                Edit
              </button>
              <button type="button" data-testid={`address-delete-${a.id}`} onClick={() => remove(a)} disabled={busy} className="btn-link">
                Remove
              </button>
              {!a.isDefault && (
                <button type="button" data-testid={`address-default-${a.id}`} onClick={() => setDefault(a)} disabled={busy} className="btn-link">
                  Set as default
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {addresses.length === 0 && !editing && <p data-testid="empty-addresses" className="text-slate-600">You have no saved addresses.</p>}
    </div>
  );
}
