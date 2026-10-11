import Link from "next/link";
import { HOME, groupOf, pageOf } from "@/content/site";
import { Prose } from "./Prose";

/**
 * The same header on every inner page: path, title, what you do here, then page-specific extras.
 * Same order everywhere, so each page feels part of one flow; the content below differs.
 */
export function PageHead({
  href,
  title,
  lead,
  kicker,
  children,
}: {
  /** The page's own address in the site map (src/content/site.ts). */
  href: string;
  title: React.ReactNode;
  lead?: string;
  /** A short line under the path, e.g. the source document. */
  kicker?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const page = pageOf(href);
  const group = groupOf(page?.href ?? href);
  return (
    <header className="page-head">
      <nav className="crumbs" aria-label="מיקום באתר">
        <Link href={HOME.href}>{HOME.label}</Link>
        {group && <span>{group.label}</span>}
        {page && page.href !== href ? <Link href={page.href}>{page.label}</Link> : page && <span aria-current="page">{page.label}</span>}
      </nav>
      {kicker && <div className="label">{kicker}</div>}
      <h1 className="page-title">{title}</h1>
      {lead && <Prose text={lead} className="lead" />}
      {children}
    </header>
  );
}
