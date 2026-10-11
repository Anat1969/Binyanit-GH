import type { Metadata } from "next";
import { PlanText } from "@/components/PlanText";
import { getPlanText } from "@/lib/data";
import QaClient from "./QaClient";

export const metadata: Metadata = { title: "שאלות על התכנית | התחדשות בניינית אשדוד" };
export const revalidate = 300;

export default async function Page() {
  const { data, error } = await getPlanText();
  return (
    <>
      <QaClient />
      <div className="wrap" style={{ maxWidth: 900, paddingBottom: 40 }}>
        <PlanText rows={data} error={error} />
      </div>
    </>
  );
}
