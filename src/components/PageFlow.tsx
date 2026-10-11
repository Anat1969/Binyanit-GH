"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FLOW, pageOf } from "@/content/site";

/** Previous / next page in the visitor's path, at the bottom of every page. */
export function PageFlow() {
  const path = usePathname();
  const page = pageOf(path);
  const i = page ? FLOW.indexOf(page) : -1;
  if (i < 0) return null;
  const prev = FLOW[i - 1];
  const next = FLOW[i + 1];
  return (
    <nav className="wrap page-flow" aria-label="המשך באתר">
      {prev ? (
        <Link href={prev.href} className="flow-card prev" rel="prev">
          <span className="label">הקודם</span>
          <b>{prev.label}</b>
          <span className="muted">{prev.blurb}</span>
        </Link>
      ) : <span />}
      {next && (
        <Link href={next.href} className="flow-card next" rel="next">
          <span className="label">הבא</span>
          <b>{next.label}</b>
          <span className="muted">{next.blurb}</span>
        </Link>
      )}
    </nav>
  );
}
