/** Extracts text lines from a PDF in the browser. The file never leaves the user's device. */
export async function pdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Worker copied from node_modules/pdfjs-dist/build (version pinned in package.json).
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines: string[] = [];
  const pages = Math.min(doc.numPages, 30);
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Group text items into lines by their baseline.
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x: it.transform[4], s: it.str });
    }
    [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      // Hebrew reads right to left: higher x first.
      .forEach(([, items]) => lines.push(items.sort((a, b) => b.x - a.x).map((i) => i.s).join(" ")));
  }
  await doc.destroy();
  return lines.join("\n");
}
