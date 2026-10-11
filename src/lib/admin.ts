import { NextResponse } from "next/server";
import { supabase } from "./supabase";

/** The admin code is checked inside Postgres against a stored hash. It never lives in this repo. */
export async function isAdmin(code: unknown): Promise<boolean> {
  if (typeof code !== "string" || code.length < 8 || code.length > 64) return false;
  const { data, error } = await supabase().rpc("binyanit_admin_check", { p_code: code.trim().toUpperCase() });
  return !error && data === true;
}

export function normalizeCode(code: unknown): string {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

export const unauthorized = () => NextResponse.json({ error: "קוד עריכה שגוי" }, { status: 401 });

export function adminCode(req: Request): string {
  return normalizeCode(req.headers.get("x-admin-code"));
}
