"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, loginUrl } from "@/lib/client";
import { useApp } from "./Providers";

/** Toggle state for one product's wishlist heart. Guests are sent to login. */
export function useWishlistToggle(productId: string, initial: boolean) {
  const { user, toast } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!user) {
      const qs = searchParams.toString();
      router.push(loginUrl(pathname + (qs ? `?${qs}` : "")));
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !active;
    const res = await api(`/api/wishlist/${productId}`, { method: next ? "POST" : "DELETE" });
    setBusy(false);
    if (!res.ok) {
      if (res.status === 401) {
        router.push(loginUrl(pathname));
        return;
      }
      if (!(res.status === 404 && !next)) {
        toast(res.error.message, "error");
        return;
      }
    }
    setActive(next);
    toast(next ? "Added to your wishlist" : "Removed from your wishlist", next ? "success" : "info");
  }

  return { active, busy, toggle };
}
