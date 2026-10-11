import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";

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
  "application/octet-stream",
];

// Browser uploads straight to Vercel Blob; this route only issues a token after checking the admin code.
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const { code } = JSON.parse(clientPayload ?? "{}");
        if (!(await isAdmin(code))) throw new Error("unauthorized");
        return { allowedContentTypes: ALLOWED, maximumSizeInBytes: 200 * 1024 * 1024, addRandomSuffix: true };
      },
      onUploadCompleted: async () => undefined,
    });
    return NextResponse.json(json);
  } catch (e) {
    const unauthorized = e instanceof Error && e.message === "unauthorized";
    return NextResponse.json({ error: unauthorized ? "קוד עריכה שגוי" : "ההעלאה נכשלה" }, { status: unauthorized ? 401 : 400 });
  }
}
