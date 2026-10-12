import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Providers } from "@/components/Providers";
import { getCurrentUser, getGuestId } from "@/lib/auth";
import { cartCount } from "@/lib/cart";
import { read } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Kartly: Online Shopping", template: "%s | Kartly" },
  description: "Kartly: shop electronics, fashion, beauty, groceries and more.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const db = read();
  const user = getCurrentUser();
  const guestId = getGuestId();
  const count = cartCount(db, user ? { userId: user.id } : { guestId });
  const categories = db.categories.map((c) => ({ slug: c.slug, name: c.name }));
  const clientUser = user ? { id: user.id, name: user.name } : null;

  return (
    <html lang="en">
      <body id="top" className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[70] focus:rounded focus:bg-white focus:p-2">
          Skip to main content
        </a>
        <Providers initialCartCount={count} user={clientUser}>
          <Header user={clientUser} categories={categories} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer categories={categories} />
        </Providers>
      </body>
    </html>
  );
}
