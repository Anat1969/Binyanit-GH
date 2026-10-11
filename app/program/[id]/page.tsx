import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DATA_ERRORS, PROGRAM } from "@/program/data";
import { DataErrorState } from "@/program/ui";
import RovaClient from "./RovaClient";

export const dynamicParams = false;
export function generateStaticParams() {
  return PROGRAM.rovaim.map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = PROGRAM.rovaim.find((x) => x.id === id);
  return { title: r ? `${r.name}: צורכי ציבור | התחדשות בניינית אשדוד` : "רובע לא נמצא" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (DATA_ERRORS.length) return <DataErrorState errors={DATA_ERRORS} />;
  if (!PROGRAM.rovaim.some((r) => r.id === id)) notFound();
  return <RovaClient id={id} />;
}
