"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "ראשי" },
  { href: "/plan/603-0972307", label: "התכנית" },
  { href: "/check", label: "בדיקת כתובת" },
  { href: "/documents", label: "מסמכים" },
  { href: "/qa", label: "שאלות על התכנית" },
  { href: "/quarters", label: "מכסות ברובעים" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="ניווט ראשי">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={path === l.href || (l.href.startsWith("/plan") && path.startsWith("/plan")) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
