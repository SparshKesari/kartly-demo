/** Browser-side helper for calling the Kartly JSON API. */
export type ApiFailure = { code: string; message: string; fields?: Record<string, string>; [key: string]: unknown };
export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: ApiFailure };

export async function api<T = unknown>(
  url: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: {
        "x-kartly-client": "web",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { data?: T; error?: ApiFailure; status?: number };
    if (res.ok && !json.error) return { ok: true, status: res.status, data: json.data as T };
    return {
      ok: false,
      status: json.status ?? res.status,
      error: json.error ?? { code: "internal_error", message: "Something went wrong. Please try again." },
    };
  } catch {
    return { ok: false, status: 0, error: { code: "network_error", message: "Network error. Please check your connection and try again." } };
  }
}

export function loginUrl(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}
