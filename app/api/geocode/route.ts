import { NextResponse } from "next/server";

// Ashdod bounding box: west, north, east, south
const VIEWBOX = "34.58,31.87,34.72,31.73";

/** OSM tags Ashdod quarters as suburb / neighbourhood named "רובע ט'". Returns the bare key ("ט", "יא"). */
function quarterFromAddress(a?: Record<string, string>): string | null {
  for (const v of [a?.suburb, a?.neighbourhood, a?.quarter, a?.city_district]) {
    const m = v?.match(/רובע\s*([א-ת]{1,2})["'׳״]?([א-ת])?/);
    if (m) return m[1] + (m[2] ?? "");
  }
  return null;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ error: "יש להזין כתובת" }, { status: 400 });
  const query = /אשדוד|ashdod/i.test(q) ? q : `${q}, אשדוד`;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "5",
    countrycodes: "il",
    viewbox: VIEWBOX,
    bounded: "1",
    "accept-language": "he",
    addressdetails: "1",
  }).toString();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "binyanit-ashdod/1.0 (public planning information site)" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { display_name: string; lat: string; lon: string; address?: Record<string, string> }[];
    return NextResponse.json({
      results: data.map((d) => ({
        label: d.display_name,
        lat: Number(d.lat),
        lon: Number(d.lon),
        quarter: quarterFromAddress(d.address),
      })),
    });
  } catch {
    return NextResponse.json({ error: "שירות האיתור אינו זמין כרגע. אפשר לסמן את המיקום ישירות על המפה." }, { status: 502 });
  }
}
