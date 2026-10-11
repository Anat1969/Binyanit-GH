import type { Metadata } from "next";
import { getDocuments } from "@/lib/data";
import DocumentsClient from "./DocumentsClient";
import { PageHead } from "@/components/PageHead";
import { PAGE } from "@/content/site";

export const metadata: Metadata = { title: "מסמכי התכנית | התחדשות בניינית אשדוד" };
export const revalidate = 300;

export default async function Page() {
  const { data, error } = await getDocuments();
  return (
    <div className="wrap section stack">
      <PageHead
        href={PAGE.documents.href}
        kicker="ספריית מסמכים"
        title="מסמכי התכנית"
        lead={'כל מסמך מסווג לפי מעמדו: מחייב, רקע, היסטורי, או בעל השפעה עקיפה. רק מסמכים מחייבים קובעים זכויות. אפשר להוסיף מסמכים בתחתית הדף, ולשנות שם או סיווג בכפתור "עריכה" שליד כל מסמך.'}
      />
      <DocumentsClient docs={data} error={error} />
    </div>
  );
}
