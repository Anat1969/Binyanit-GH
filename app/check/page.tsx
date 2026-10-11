import type { Metadata } from "next";
import CheckClient from "./CheckClient";

export const metadata: Metadata = { title: "בדיקת כתובת | התחדשות בניינית אשדוד" };

export default function Page() {
  return <CheckClient />;
}
