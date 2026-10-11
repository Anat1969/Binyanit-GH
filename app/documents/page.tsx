import type { Metadata } from "next";
import { getDocuments } from "@/lib/data";
import AdminPanel from "./AdminPanel";
import DocumentsClient from "./DocumentsClient";

export const metadata: Metadata = { title: "מסמכי התכנית | התחדשות בניינית אשדוד" };
export const revalidate = 300;

export default async function Page() {
  const { data, error } = await getDocuments();
  return (
    <div className="wrap section stack">
      <div className="label">ספריית מסמכים</div>
      <h1 className="h2">מסמכי התכנית</h1>
      <p className="lead" style={{ margin: 0 }}>
        כל מסמך מסווג לפי מעמדו: מסמך מחייב, רקע, היסטורי או בעל השפעה עקיפה. רק מסמכים מחייבים קובעים זכויות.
      </p>
      <DocumentsClient docs={data} error={error} />
      <AdminPanel />
    </div>
  );
}
