import type { Metadata } from "next";
import QaClient from "./QaClient";

export const metadata: Metadata = { title: "שאלות על התכנית | התחדשות בניינית אשדוד" };

export default function Page() {
  return <QaClient />;
}
