/**
 * Explanatory text laid out for reading: every sentence is its own paragraph with space after it,
 * and every comma starts a new line. Commas inside numbers (22,565) and periods inside
 * section numbers (4.1.2) are left alone, since only a comma or period followed by a space breaks.
 * Not for binding plan text or table cells.
 */
export function sentences(text: string): string[][] {
  return text
    .split(/\n+/)
    .flatMap((block) => block.split(/(?<=[.!?])\s+(?=\S)/))
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.split(/(?<=,)\s+/));
}

export function Prose({ text, className, as = "div" }: { text: string; className?: string; as?: "div" | "span" }) {
  const Tag = as;
  return (
    <Tag className={`prose ${className ?? ""}`.trim()}>
      {sentences(text).map((lines, i, all) => (
        <span key={i} className="prose-s">
          {lines.map((l, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {l}
              {/* Keep the space, so copied text and screen readers read whole sentences. */}
              {(j < lines.length - 1 || i < all.length - 1) && " "}
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}
