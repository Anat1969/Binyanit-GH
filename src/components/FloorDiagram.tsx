import type { BuildingInput, RouteResult } from "@/engine";

type Row = { kind: "pilotis" | "existing" | "added" | "partial" | "ghost"; width: number; ext?: number; label?: string };

const COLORS = {
  existing: "#c9cbc6",
  added: "#26313d",
  partial: "#56636f",
  ext: "#8c97a3",
  ghost: "none",
};

/** Section diagram in the spirit of the plan's building appendix. Purely visual: reads engine output only. */
export function FloorDiagram({ r, b }: { r: RouteResult; b: BuildingInput }) {
  const W = 400;
  const bodyW = 210;
  const x0 = 16;
  const rows: Row[] = [];
  let ghostFloors = 0;
  let maxLine: number | null = null;

  if (r.route === "demolish") {
    const exact = r.footprintArea > 0 ? r.totalRights / r.footprintArea : 0;
    const full = Math.floor(exact + 1e-9);
    const part = exact - full;
    const scale = Math.max(r.footprintArea, b.typicalFloorArea);
    const w = r.footprintArea / scale;
    for (let i = 0; i < full; i++) rows.push({ kind: "added", width: w, label: i === 0 ? "קומה מורחבת" : i === full - 1 ? `${full} קומות` : undefined });
    if (part >= 0.1) rows.push({ kind: "partial", width: w * part, label: `חלקית ${Math.round(part * 100)}%` });
    ghostFloors = b.existingFloors;
    maxLine = r.maxFloors;
  } else {
    const units = b.residential ? b.existingUnits / b.existingFloors : 0;
    const ext = Math.min(0.35, (r.m2PerUnit * units) / b.typicalFloorArea);
    const w = 1 / (1 + ext);
    if (b.groundFloor === "pilotis") rows.push({ kind: "pilotis", width: w, label: "קומת עמודים" });
    for (let i = 0; i < b.existingFloors; i++)
      rows.push({ kind: "existing", width: w, ext: ext * w, label: i === 0 ? `קיים: ${b.existingFloors} קומות` : undefined });
    let n = 0;
    for (const s of r.floorSteps) {
      if (s.label.includes("חלקית")) continue;
      for (let i = 0; i < s.floors; i++) {
        n += 1;
        rows.push({ kind: "added", width: w + ext * w, label: i === 0 ? `+${n} ${s.label}` : undefined });
      }
    }
    if (r.partialRoofFraction > 0)
      rows.push({ kind: "partial", width: (w + ext * w) * r.partialRoofFraction, label: `גג חלקי ${Math.round(r.partialRoofFraction * 100)}%` });
  }

  const totalRows = Math.max(rows.length, maxLine ?? 0, ghostFloors);
  const fh = Math.max(7, Math.min(16, 260 / Math.max(totalRows, 1)));
  const H = totalRows * fh + 34;
  const base = H - 18;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`חתך סכמטי: ${r.title}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <pattern id={`hatch-${r.route}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#9a9d98" strokeWidth="1.2" />
        </pattern>
        <linearGradient id={`g-${r.route}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#34414f" />
          <stop offset="1" stopColor="#1f2832" />
        </linearGradient>
      </defs>
      <line x1={0} x2={W} y1={base} y2={base} stroke="#17181a" strokeWidth="1.5" />
      {ghostFloors > 0 && (
        <rect
          x={x0}
          y={base - ghostFloors * fh}
          width={bodyW * Math.min(1, b.typicalFloorArea / Math.max(r.footprintArea, b.typicalFloorArea))}
          height={ghostFloors * fh}
          fill="none"
          stroke="#92292a"
          strokeDasharray="4 3"
        />
      )}
      {maxLine != null && (
        <g>
          <line x1={x0} x2={x0 + bodyW + 10} y1={base - maxLine * fh} y2={base - maxLine * fh} stroke="#7a4f00" strokeDasharray="6 4" />
          <text x={W - 4} y={base - maxLine * fh + 4} fontSize="11" textAnchor="start" direction="rtl" fill="#7a4f00" fontFamily="IBM Plex Sans Hebrew">
            {`מרבי ${maxLine} קומות`}
          </text>
        </g>
      )}
      {rows.map((row, i) => {
        const y = base - (i + 1) * fh;
        const w = bodyW * row.width;
        return (
          <g key={i}>
            {row.kind === "pilotis" ? (
              <rect x={x0} y={y + 1} width={w} height={fh - 2} fill={`url(#hatch-${r.route})`} stroke="#9a9d98" />
            ) : (
              <rect
                x={x0}
                y={y + 0.5}
                width={w}
                height={fh - 1}
                rx={1.5}
                fill={row.kind === "existing" ? COLORS.existing : row.kind === "partial" ? COLORS.partial : `url(#g-${r.route})`}
              />
            )}
            {row.ext ? <rect x={x0 + w} y={y + 0.5} width={bodyW * row.ext} height={fh - 1} fill={COLORS.ext} /> : null}
            {row.label && (
              <text x={W - 4} y={y + fh / 2 + 4} fontSize="11" textAnchor="start" direction="rtl" fill="#3f4247" fontFamily="IBM Plex Sans Hebrew">
                {row.label}
              </text>
            )}
          </g>
        );
      })}
      <text x={x0} y={H - 3} fontSize="10" fill="#5f636a" fontFamily="IBM Plex Mono">
        {r.route === "demolish" ? "מקווקו אדום: הבניין הקיים" : r.m2PerUnit ? `+${r.m2PerUnit} m2/unit` : ""}
      </text>
    </svg>
  );
}
