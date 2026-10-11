import { NextResponse } from "next/server";

// Ashdod bounding box: west, north, east, south
const VIEWBOX = "34.58,31.87,34.72,31.73";

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
  }).toString();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "binyanit-ashdod/1.0 (public planning information site)" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    return NextResponse.json({
      results: data.map((d) => ({ label: d.display_name, lat: Number(d.lat), lon: Number(d.lon) })),
    });
  } catch {
    return NextResponse.json({ error: "שירות האיתור אינו זמין כרגע. אפשר לסמן את המיקום ישירות על המפה." }, { status: 502 });
  }
}
