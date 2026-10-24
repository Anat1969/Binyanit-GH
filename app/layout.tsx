import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans-hebrew/200.css";
import "@fontsource/ibm-plex-sans-hebrew/300.css";
import "@fontsource/ibm-plex-sans-hebrew/400.css";
import "@fontsource/ibm-plex-sans-hebrew/500.css";
import "@fontsource/ibm-plex-sans-hebrew/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { DISCLAIMER } from "@/engine/config";
import { PLAN } from "@/content/plan-meta";

export const metadata: Metadata = {
  title: `התחדשות בניינית אשדוד | תכנית ${PLAN.number}`,
  description: "בדיקת פוטנציאל תכנוני ראשוני לפי תכנית ההתחדשות הבניינית של אשדוד.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f1f1ee" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        {/* The A&I logo button: https://github.com/Anat1969/AppOfApp-GH/blob/main/docs/ai-menu-standard.md */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://appofapp-gh.vercel.app/ai-menu.js" />
      </head>
      <body>
        <a href="#main" className="label" style={{ position: "absolute", insetInlineStart: -9999 }}>
          דילוג לתוכן
        </a>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="brand">
              <b>התחדשות בניינית אשדוד</b>
              <span>PLAN {PLAN.number}</span>
            </Link>
            <Nav />
            <ai-menu />
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div className="wrap stack">
            <p style={{ margin: 0 }}>{DISCLAIMER}</p>
            <p style={{ margin: 0 }}>
              אתר מידע ציבורי. החישוב נעשה במנוע כללים קבוע ובדוק. המערכת אינה שומרת כתובות או פרטים אישיים.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "ai-menu": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { chat?: string; research?: string };
    }
  }
}
