import type { ReactNode } from "react";
import type { SummaryBlock } from "@/lib/summary";

/** Numbered route blocks with bold values. Markers are written out, so RTL renders the same on screen and in the PDF. */
export function SummaryView({ blocks }: { blocks: SummaryBlock[] }) {
  return (
    <div className="sum" data-testid="summary">
      {blocks.map((b, i) => (
        <section key={b.title} className={`sum-block pdf-block ${b.eligible ? "" : "off"}`}>
          <div className="sum-head">
            <h4>
              <span className="num">{i + 1}.</span> {b.title}
            </h4>
            <span className={`chip ${b.eligible ? "ok" : "bad"}`}>{b.status}</span>
          </div>
          <ul className="plain">
            {b.items.map((it, j) => (
              <li key={j}>
                <span className="mark" aria-hidden="true">•</span>
                <span>
                  {it.label}: <b>{it.value}</b>
                  {it.section && <span className="cite"> ({it.section})</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : part,
  );
}

/** Minimal Markdown for model-written explanations: headings, numbered items, bullets, bold. */
export function RichText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  text.split(/\n+/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#{1,4}\s*(.+)$/))) out.push(<h4 key={i} className="rich-h">{inline(m[1].replace(/\*\*/g, ""))}</h4>);
    else if ((m = line.match(/^(\d+)[.)]\s+(.+)$/)))
      out.push(
        <div key={i} className="rich-li">
          <span className="mark num">{m[1]}.</span>
          <span>{inline(m[2])}</span>
        </div>,
      );
    else if ((m = line.match(/^[-*•]\s+(.+)$/)))
      out.push(
        <div key={i} className="rich-li sub">
          <span className="mark">•</span>
          <span>{inline(m[1])}</span>
        </div>,
      );
    else out.push(<p key={i} className="rich-p">{inline(line)}</p>);
  });
  return <div className="rich" data-testid="explain">{out}</div>;
}
