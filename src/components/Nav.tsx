"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { GROUPS, HOME, pageOf } from "@/content/site";

export function Nav() {
  const path = usePathname();
  const current = pageOf(path)?.href;
  const ref = useRef<HTMLElement>(null);
  // On a phone the menu scrolls sideways: keep the current page in view.
  useEffect(() => {
    ref.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [current]);
  const link = (href: string, label: string) => (
    <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>
      {label}
    </Link>
  );
  return (
    <nav ref={ref} className="nav" aria-label="ניווט ראשי">
      {link(HOME.href, HOME.label)}
      {GROUPS.map((g) => (
        <div key={g.id} className="nav-group" role="group" aria-label={g.label}>
          {g.pages.map((p) => link(p.href, p.label))}
        </div>
      ))}
    </nav>
  );
}
