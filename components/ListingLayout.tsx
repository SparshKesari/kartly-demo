"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import {
  PRICE_PRESETS,
  SORT_OPTIONS,
  listingToParams,
  type FacetOption,
  type Facets,
  type ListingQuery,
  type SortValue,
} from "@/lib/catalog";
import { KB } from "@/lib/kb";
import { formatMoney } from "@/lib/pricing";

type Props = {
  query: ListingQuery;
  facets: Facets;
  total: number;
  page: number;
  pageSize: number;
  /** Category fixed by the route (/c/[slug]); undefined on /search. */
  routeCategory?: string;
  categoryNames: Record<string, string>;
  children: ReactNode;
};

function FilterCheckbox({
  testId,
  label,
  count,
  checked,
  onChange,
  disabled,
}: {
  testId: string;
  label: ReactNode;
  count?: number;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      data-testid={testId}
      className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded px-1 text-sm hover:bg-slate-50 ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <input type="checkbox" className="tap-input" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-xs text-slate-500">({count})</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-b border-slate-200 py-3 last:border-0">
      <legend className="mb-1 text-sm font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

export function ListingLayout({ query: serverQuery, facets, total, page, pageSize, routeCategory, categoryNames, children }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Optimistic copy of the query so controls reflect a click immediately, before the new page arrives.
  const [optimistic, setOptimistic] = useState<ListingQuery | null>(null);
  const query = optimistic ?? serverQuery;
  useEffect(() => {
    setOptimistic(null);
  }, [serverQuery]);
  const [open, setOpen] = useState(false);
  const [minPrice, setMinPrice] = useState(query.minPrice?.toString() ?? "");
  const [maxPrice, setMaxPrice] = useState(query.maxPrice?.toString() ?? "");
  const [priceError, setPriceError] = useState("");
  const openBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMinPrice(query.minPrice?.toString() ?? "");
    setMaxPrice(query.maxPrice?.toString() ?? "");
    setPriceError("");
  }, [query.minPrice, query.maxPrice]);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function close() {
    setOpen(false);
    openBtnRef.current?.focus();
  }

  function navigate(next: Partial<ListingQuery>, opts: { keepPage?: boolean } = {}) {
    const merged: ListingQuery = { ...query, ...next, page: opts.keepPage ? next.page ?? query.page : 1 };
    setOptimistic(merged);
    const targetCategory = merged.category;
    let url: string;
    if (routeCategory && targetCategory) {
      const sp = listingToParams(merged, { omitCategory: true });
      url = `/c/${targetCategory}${sp.toString() ? `?${sp}` : ""}`;
    } else {
      const sp = listingToParams(merged);
      if (!sp.has("q")) sp.set("q", "");
      url = `/search?${sp.toString()}`;
    }
    startTransition(() => {
      router.push(url, { scroll: false });
    });
  }

  const toggleIn = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const activePreset = PRICE_PRESETS.find((p) => p.min === query.minPrice && p.max === query.maxPrice)?.key;

  function applyCustomPrice() {
    const min = minPrice.trim() === "" ? undefined : Number(minPrice);
    const max = maxPrice.trim() === "" ? undefined : Number(maxPrice);
    if ((min !== undefined && (!Number.isFinite(min) || min < 0)) || (max !== undefined && (!Number.isFinite(max) || max < 0))) {
      setPriceError("Enter a valid price.");
      return;
    }
    if (min !== undefined && max !== undefined && min >= max) {
      setPriceError("Min must be less than max.");
      return;
    }
    setPriceError("");
    navigate({ minPrice: min, maxPrice: max });
  }

  const chips: { key: string; label: string; remove: Partial<ListingQuery> }[] = [];
  if (query.category && !routeCategory) chips.push({ key: "category", label: categoryNames[query.category] ?? query.category, remove: { category: undefined } });
  if (query.brands.length) {
    const names = query.brands.map((b) => facets.brands.find((f) => f.value === b)?.label ?? b);
    chips.push({ key: "brand", label: `Brand: ${names.join(", ")}`, remove: { brands: [] } });
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const label =
      PRICE_PRESETS.find((p) => p.key === activePreset)?.label ??
      (query.minPrice !== undefined && query.maxPrice !== undefined
        ? `${formatMoney(query.minPrice)} to ${formatMoney(query.maxPrice)}`
        : query.minPrice !== undefined
          ? `${formatMoney(query.minPrice)} & above`
          : `Under ${formatMoney(query.maxPrice!)}`);
    chips.push({ key: "price", label: `Price: ${label}`, remove: { minPrice: undefined, maxPrice: undefined } });
  }
  if (query.rating) chips.push({ key: "rating", label: `${query.rating} stars & up`, remove: { rating: undefined } });
  if (query.discount) chips.push({ key: "discount", label: `${query.discount}% off or more`, remove: { discount: undefined } });
  if (query.fast) chips.push({ key: "fast", label: "Fast delivery", remove: { fast: false } });
  if (query.includeOutOfStock) chips.push({ key: "includeOutOfStock", label: "Including out of stock", remove: { includeOutOfStock: false } });
  if (query.tags.length) chips.push({ key: "tags", label: `Tags: ${query.tags.map((t) => t[0].toUpperCase() + t.slice(1)).join(", ")}`, remove: { tags: [] } });

  function clearAll() {
    navigate({
      category: routeCategory ? query.category : undefined,
      brands: [],
      minPrice: undefined,
      maxPrice: undefined,
      rating: undefined,
      discount: undefined,
      fast: false,
      includeOutOfStock: false,
      tags: [],
    });
  }

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const renderFacet = (opts: FacetOption[], render: (o: FacetOption) => ReactNode) => opts.map(render);

  return (
    <div className="mx-auto max-w-[1500px] px-2 py-3 md:px-4">
      <div className="card mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        <p className="text-sm">
          <span data-testid="results-count" className="font-semibold">
            {total === 0 ? "0 results" : `${first}-${last} of ${total} results`}
          </span>
          {query.q && (
            <span className="text-slate-600">
              {" "}
              for <span className="font-semibold text-orange-700">&quot;{query.q}&quot;</span>
            </span>
          )}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button
            ref={openBtnRef}
            type="button"
            data-testid="mobile-filters-btn"
            aria-expanded={open}
            aria-controls="filters-panel"
            onClick={() => setOpen(true)}
            className="btn-outline md:hidden"
          >
            Filters{chips.length ? ` (${chips.length})` : ""}
          </button>
          <label htmlFor="sort-select" className="sr-only md:not-sr-only md:text-sm">
            Sort by
          </label>
          <select
            id="sort-select"
            data-testid="sort-select"
            value={query.sort}
            onChange={(e) => navigate({ sort: e.target.value as SortValue })}
            className="min-h-[40px] rounded-md border border-slate-300 bg-slate-50 px-2 text-sm shadow-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              data-testid={`filter-chip-${chip.key}`}
              onClick={() => navigate(chip.remove)}
              aria-label={`Remove filter ${chip.label}`}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50"
            >
              {chip.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" data-testid="clear-filters" onClick={clearAll} className="btn-link px-2">
            Clear all
          </button>
        </div>
      )}

      <div className="flex gap-4">
        {open && <div className="fixed inset-0 z-40 bg-black/60 md:hidden" aria-hidden="true" data-testid="mobile-filters-backdrop" onClick={close} />}
        <aside
          id="filters-panel"
          data-testid="mobile-filters-panel"
          aria-label="Filters"
          role={open ? "dialog" : undefined}
          aria-modal={open ? true : undefined}
          className={`${
            open ? "fixed inset-y-0 left-0 z-50 block w-[88%] max-w-sm overflow-y-auto bg-white p-4 shadow-2xl" : "hidden"
          } md:static md:z-auto md:block md:w-60 md:max-w-none md:shrink-0 md:overflow-visible md:rounded-lg md:p-3 md:shadow-sm md:bg-white`}
        >
          <div className="mb-2 flex items-center justify-between md:hidden">
            <h2 className="text-lg font-bold">Filters</h2>
            <button
              ref={closeBtnRef}
              type="button"
              data-testid="mobile-filters-close"
              aria-label="Close filters"
              onClick={() => {
                if (KB.b07 && window.matchMedia("(max-width: 639px)").matches) return;
                close();
              }}
              className="flex h-10 w-10 items-center justify-center rounded text-2xl hover:bg-slate-100"
            >
              ×
            </button>
          </div>

          <Section title="Category">
            {renderFacet(facets.categories, (c) => (
              <FilterCheckbox
                key={c.value}
                testId={`filter-category-${c.value}`}
                label={c.label}
                count={c.count}
                checked={query.category === c.value}
                onChange={() => navigate({ category: query.category === c.value ? undefined : c.value })}
              />
            ))}
          </Section>

          <Section title="Price">
            {renderFacet(facets.prices, (p) => {
              const preset = PRICE_PRESETS.find((x) => x.key === p.value)!;
              return (
                <FilterCheckbox
                  key={p.value}
                  testId={`filter-price-${p.value}`}
                  label={p.label}
                  count={p.count}
                  checked={activePreset === p.value}
                  onChange={() =>
                    navigate(activePreset === p.value ? { minPrice: undefined, maxPrice: undefined } : { minPrice: preset.min, maxPrice: preset.max })
                  }
                />
              );
            })}
            <form
              className="mt-2 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                applyCustomPrice();
              }}
            >
              <div className="w-20">
                <label htmlFor="price-min" className="text-xs text-slate-600">
                  Min $
                </label>
                <input
                  id="price-min"
                  data-testid="filter-price-min"
                  inputMode="decimal"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="input px-2"
                />
              </div>
              <div className="w-20">
                <label htmlFor="price-max" className="text-xs text-slate-600">
                  Max $
                </label>
                <input
                  id="price-max"
                  data-testid="filter-price-max"
                  inputMode="decimal"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="input px-2"
                />
              </div>
              <button type="submit" data-testid="filter-price-apply" className="btn-outline px-3">
                Go
              </button>
            </form>
            {priceError && (
              <p role="alert" className="field-error">
                {priceError}
              </p>
            )}
          </Section>

          {facets.brands.length > 0 && (
            <Section title="Brand">
              <div className="max-h-72 overflow-y-auto md:max-h-80">
                {renderFacet(facets.brands, (b) => (
                  <FilterCheckbox
                    key={b.value}
                    testId={`filter-brand-${b.value}`}
                    label={b.label}
                    count={b.count}
                    checked={query.brands.includes(b.value)}
                    onChange={() => navigate({ brands: toggleIn(query.brands, b.value) })}
                  />
                ))}
              </div>
            </Section>
          )}

          <Section title="Customer rating">
            {renderFacet(facets.ratings, (r) => (
              <FilterCheckbox
                key={r.value}
                testId={`filter-rating-${r.value}`}
                label={
                  <span className="flex items-center gap-1">
                    <span aria-hidden="true" className="text-amber-500">
                      {"★".repeat(Number(r.value))}
                      <span className="text-slate-300">{"★".repeat(5 - Number(r.value))}</span>
                    </span>
                    <span>{r.value} &amp; up</span>
                  </span>
                }
                count={r.count}
                checked={query.rating === Number(r.value)}
                onChange={() => navigate({ rating: query.rating === Number(r.value) ? undefined : Number(r.value) })}
              />
            ))}
          </Section>

          <Section title="Discount">
            {renderFacet(facets.discounts, (d) => (
              <FilterCheckbox
                key={d.value}
                testId={`filter-discount-${d.value}`}
                label={`${d.value}% off or more`}
                count={d.count}
                checked={query.discount === Number(d.value)}
                onChange={() => navigate({ discount: query.discount === Number(d.value) ? undefined : Number(d.value) })}
              />
            ))}
          </Section>

          <Section title="Availability & delivery">
            <FilterCheckbox
              testId="filter-include-out-of-stock"
              label="Include out of stock"
              count={facets.outOfStock}
              checked={query.includeOutOfStock}
              onChange={() => navigate({ includeOutOfStock: !query.includeOutOfStock })}
            />
            <FilterCheckbox
              testId="filter-fast-delivery"
              label="Fast delivery only"
              count={facets.fast}
              checked={query.fast}
              onChange={() => navigate({ fast: !query.fast })}
            />
          </Section>

          <Section title="Tags">
            {renderFacet(facets.tags, (t) => (
              <FilterCheckbox
                key={t.value}
                testId={`filter-tag-${t.value}`}
                label={t.label}
                count={t.count}
                checked={query.tags.includes(t.value as ListingQuery["tags"][number])}
                onChange={() => navigate({ tags: toggleIn(query.tags, t.value as ListingQuery["tags"][number]) })}
              />
            ))}
          </Section>

          <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white p-3 md:hidden">
            <button type="button" onClick={close} className="btn-primary w-full">
              Show {total} {total === 1 ? "result" : "results"}
            </button>
          </div>
        </aside>

        <div className={`min-w-0 flex-1 transition-opacity ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
          {children}
        </div>
      </div>
    </div>
  );
}
