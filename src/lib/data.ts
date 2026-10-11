import { supabase } from "./supabase";

export type DocCategory = "binding" | "background" | "historical" | "indirect";
export interface PlanDocument {
  id: string;
  title: string;
  category: DocCategory;
  description: string | null;
  file_url: string | null;
  source_url: string | null;
}
export interface QuarterCounter {
  quarter: string;
  sort: number;
  threshold: number | null;
  units_used: number | null;
  units_in_process: number | null;
  updated_at: string | null;
  note: string | null;
}

export const CATEGORY_LABEL: Record<DocCategory, string> = {
  binding: "מסמך מחייב",
  background: "רקע",
  historical: "היסטורי",
  indirect: "השפעה עקיפה",
};

export async function getDocuments(): Promise<{ data: PlanDocument[]; error: boolean }> {
  try {
    const { data, error } = await supabase()
      .from("binyanit_plan_documents")
      .select("id, title, category, description, file_url, source_url")
      .order("sort")
      .order("created_at");
    return { data: (data as PlanDocument[]) ?? [], error: Boolean(error) };
  } catch {
    return { data: [], error: true };
  }
}

export async function getQuarters(): Promise<{ data: QuarterCounter[]; error: boolean }> {
  try {
    const { data, error } = await supabase().from("binyanit_quarter_counters").select("*").order("sort");
    return { data: (data as QuarterCounter[]) ?? [], error: Boolean(error) };
  } catch {
    return { data: [], error: true };
  }
}
