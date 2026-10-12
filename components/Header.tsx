"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useApp } from "./Providers";
import { api } from "@/lib/client";

type Props = {
  user: { name: string } | null;
  categories: { slug: string; name: string }[];
};

export function Header({ user, categories }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { cartCount, toast } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const categoryFromPath = pathname.startsWith("/c/") ? decodeURIComponent(pathname.split("/")[2] ?? "") : "";
  const urlQ = pathname === "/search" ? searchParams.get("q") ?? "" : "";
  const urlCategory = pathname === "/search" ? searchParams.get("category") ?? "" : categoryFromPath;
  const [q, setQ] = useState(urlQ);
  const [category, setCategory] = useState(urlCategory);

  useEffect(() => {
    setQ(urlQ);
    setCategory(urlCategory);
  }, [urlQ, urlCategory]);

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    navRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAccountOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    sp.set("q", q.trim());
    if (category) sp.set("category", category);
    router.push(`/search?${sp.toString()}`);
  }

  async function logout() {
    setLoggingOut(true);
    const res = await api("/api/auth/logout", { method: "POST" });
    setLoggingOut(false);
    if (!res.ok) {
      toast(res.error.message, "error");
      return;
    }
    setMenuOpen(false);
    toast("You have been signed out.", "info");
    router.push("/");
    router.refresh();
  }

  const navLinkClass =
    "flex min-h-[44px] items-center rounded px-3 text-base text-slate-900 hover:bg-slate-100 md:min-h-[40px] md:px-2 md:text-sm md:text-white md:hover:bg-transparent md:hover:outline md:hover:outline-1 md:hover:outline-white";

  return (
    <header className="bg-brand-dark text-white">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-2 gap-y-2 px-2 py-2 md:flex-nowrap md:gap-x-3 md:px-4">
        <button
          ref={menuBtnRef}
          type="button"
          data-testid="mobile-menu-btn"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="primary-nav"
          onClick={() => setMenuOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded hover:bg-white/10 md:hidden"
        >
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>

        <Link
          href="/"
          data-testid="header-logo"
          className="flex min-h-[40px] items-center rounded px-1 text-2xl font-extrabold tracking-tight hover:outline hover:outline-1 hover:outline-white"
        >
          kartly<span className="text-brand-accent">.</span>
        </Link>

        <form
          role="search"
          action="/search"
          method="get"
          onSubmit={onSearch}
          className="order-last flex w-full overflow-hidden rounded-md bg-white focus-within:ring-2 focus-within:ring-brand-accent md:order-none md:w-auto md:flex-1"
        >
          <label htmlFor="search-category" className="sr-only">
            Search category
          </label>
          <select
            id="search-category"
            name="category"
            data-testid="search-category-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-h-[40px] w-20 shrink-0 cursor-pointer border-r border-slate-300 bg-slate-100 px-1 text-xs text-slate-700 md:w-auto md:max-w-[180px] md:px-2"
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <label htmlFor="search-input" className="sr-only">
            Search Kartly
          </label>
          <input
            id="search-input"
            name="q"
            data-testid="search-input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Kartly"
            autoComplete="off"
            className="min-h-[40px] min-w-0 flex-1 px-3 text-sm text-slate-900 outline-none"
          />
          <button
            type="submit"
            data-testid="search-submit"
            aria-label="Search"
            className="flex min-h-[40px] w-12 shrink-0 items-center justify-center bg-brand-accent text-slate-900 hover:bg-amber-400"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
        </form>

        <div ref={accountRef} data-testid="account-menu" className="relative ml-auto md:ml-0">
          {user ? (
            <>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((v) => !v)}
                className="flex min-h-[40px] max-w-[150px] flex-col items-start justify-center rounded px-2 text-left leading-tight hover:outline hover:outline-1 hover:outline-white md:max-w-[200px]"
              >
                <span className="w-full truncate text-xs text-slate-300">Hello, {user.name}</span>
                <span className="hidden text-sm font-bold md:block">Account &amp; Lists ▾</span>
              </button>
              {accountOpen && (
                <div role="menu" className="absolute right-0 z-50 mt-1 w-56 rounded-md bg-white py-2 text-slate-900 shadow-xl">
                  <Link role="menuitem" href="/account/orders" className="flex min-h-[40px] items-center px-4 text-sm hover:bg-slate-100">
                    Your Orders
                  </Link>
                  <Link role="menuitem" href="/account/addresses" className="flex min-h-[40px] items-center px-4 text-sm hover:bg-slate-100">
                    Your Addresses
                  </Link>
                  <Link role="menuitem" href="/account/wishlist" className="flex min-h-[40px] items-center px-4 text-sm hover:bg-slate-100">
                    Your Wishlist
                  </Link>
                </div>
              )}
            </>
          ) : (
            <Link
              href={pathname === "/login" ? "/login" : `/login?next=${encodeURIComponent(pathname + (searchParams.toString() ? `?${searchParams}` : ""))}`}
              data-testid="login-link"
              className="flex min-h-[40px] flex-col justify-center rounded px-2 leading-tight hover:outline hover:outline-1 hover:outline-white"
            >
              <span className="text-xs text-slate-300">Hello, sign in</span>
              <span className="hidden text-sm font-bold md:block">Account &amp; Lists</span>
            </Link>
          )}
        </div>

        {menuOpen && (
          <div className="fixed inset-0 z-40 bg-black/60 md:hidden" aria-hidden="true" onClick={() => setMenuOpen(false)} />
        )}
        <div
          id="primary-nav"
          ref={navRef}
          role={menuOpen ? "dialog" : undefined}
          aria-modal={menuOpen ? true : undefined}
          aria-label={menuOpen ? "Menu" : undefined}
          className={`${
            menuOpen ? "fixed inset-y-0 left-0 z-50 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-white p-2 text-slate-900 shadow-2xl" : "hidden"
          } md:static md:z-auto md:flex md:w-auto md:max-w-none md:flex-row md:items-center md:gap-1 md:overflow-visible md:bg-transparent md:p-0 md:text-white md:shadow-none`}
        >
          <div className="mb-2 flex items-center justify-between bg-brand-nav px-3 py-3 text-white md:hidden">
            <span className="font-bold">{user ? `Hello, ${user.name}` : "Hello, sign in"}</span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => {
                setMenuOpen(false);
                menuBtnRef.current?.focus();
              }}
              className="flex h-10 w-10 items-center justify-center rounded text-2xl hover:bg-white/10"
            >
              ×
            </button>
          </div>
          <Link href="/account/orders" data-testid="nav-orders" className={navLinkClass}>
            <span className="md:flex md:flex-col md:leading-tight">
              <span className="hidden text-xs text-slate-300 md:inline">Returns</span>
              <span className="md:text-sm md:font-bold">
                <span className="md:hidden">Returns &amp; Orders</span>
                <span className="hidden md:inline">&amp; Orders</span>
              </span>
            </span>
          </Link>
          <Link href="/account/wishlist" data-testid="nav-wishlist" className={navLinkClass}>
            <span className="md:font-bold">Wishlist</span>
          </Link>
          {user && (
            <Link href="/account/addresses" className={`${navLinkClass} md:hidden`}>
              Your Addresses
            </Link>
          )}
          <div className="mt-2 border-t border-slate-200 pt-2 md:hidden">
            <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Shop by category</p>
            {categories.map((c) => (
              <Link key={c.slug} href={`/c/${c.slug}`} className={navLinkClass}>
                {c.name}
              </Link>
            ))}
          </div>
          {user && (
            <button
              type="button"
              data-testid="logout-btn"
              onClick={logout}
              disabled={loggingOut}
              className={`${navLinkClass} mt-2 border-t border-slate-200 text-left md:mt-0 md:border-0`}
            >
              {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          )}
        </div>

        <Link
          href="/cart"
          data-testid="cart-link"
          aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
          className="relative flex min-h-[40px] items-end gap-1 rounded px-2 hover:outline hover:outline-1 hover:outline-white"
        >
          <span className="relative">
            <svg aria-hidden="true" width="34" height="30" viewBox="0 0 34 30" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 2h5l4 18h18l3-13H8" />
              <circle cx="12" cy="26" r="2" />
              <circle cx="26" cy="26" r="2" />
            </svg>
            <span
              data-testid="cart-count"
              className="absolute -top-1 left-1/2 -translate-x-1/2 text-sm font-bold text-brand-accent"
            >
              {cartCount}
            </span>
          </span>
          <span className="hidden pb-0.5 text-sm font-bold md:inline">Cart</span>
        </Link>
      </div>
      <nav aria-label="Categories" className="bg-brand-nav">
        <ul className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-2 text-sm md:px-4">
          {categories.map((c) => (
            <li key={c.slug} className="shrink-0">
              <Link
                href={`/c/${c.slug}`}
                className="flex min-h-[40px] items-center whitespace-nowrap rounded px-2 hover:outline hover:outline-1 hover:outline-white"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
