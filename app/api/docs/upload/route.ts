import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

const ALLOWED = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.google-earth.kml+xml",
  "application/vnd.google-earth.kmz",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
];

// Browser uploads straight to Vercel Blob (store binyanit-docs); this route only issues a short-lived token.
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("docs/")) throw new Error("bad path");
        return { allowedContentTypes: ALLOWED, maximumSizeInBytes: 100 * 1024 * 1024, addRandomSuffix: true };
      },
      onUploadCompleted: async () => undefined,
    });
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ error: "ההעלאה נכשלה" }, { status: 400 });
  }
}
