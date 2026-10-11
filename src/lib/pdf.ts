/**
 * Renders a DOM element to a multi-page A4 PDF. Hebrew is rendered by the browser, so RTL stays exact.
 * Pages break only between blocks (headings, paragraphs, table rows, list items), never through a line of text.
 */
const MARGIN_MM = 10;
const BREAK_SELECTOR = "h1, h3, h4, p, tr, li, .pdf-block";

/** Candidate break positions in CSS px from the top of `el`. A heading stays with what follows it. */
function breakPoints(el: HTMLElement): number[] {
  const top = el.getBoundingClientRect().top;
  const pts = new Set<number>();
  const headings: number[] = [];
  el.querySelectorAll<HTMLElement>(BREAK_SELECTOR).forEach((n) => {
    const r = n.getBoundingClientRect();
    if (/^H[1-4]$/.test(n.tagName)) headings.push(r.top - top);
    pts.add(Math.round(r.top - top));
    pts.add(Math.round(r.bottom - top));
  });
  return [...pts].filter((p) => !headings.some((h) => p > h + 1 && p < h + 48)).sort((a, b) => a - b);
}

export async function downloadPdf(el: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  const breaks = breakPoints(el);
  const cssH = el.getBoundingClientRect().height;
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const pxPerMm = canvas.width / pageW;
  const pxPerCss = canvas.height / cssH;
  const pagePx = Math.floor((pageH - 2 * MARGIN_MM) * pxPerMm);
  const cuts = breaks.map((b) => Math.round(b * pxPerCss));
  let y = 0;
  let first = true;
  while (y < canvas.height - 2) {
    let end = Math.min(y + pagePx, canvas.height);
    if (end < canvas.height) {
      // Last block boundary that fits, as long as it fills at least 40% of the page.
      const fit = cuts.filter((c) => c > y + pagePx * 0.4 && c <= end).pop();
      if (fit) end = fit;
    }
    const h = end - y;
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = h;
    const ctx = slice.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, h);
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (!first) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, first ? 0 : MARGIN_MM, pageW, h / pxPerMm);
    first = false;
    y = end;
  }
  pdf.save(filename);
}
