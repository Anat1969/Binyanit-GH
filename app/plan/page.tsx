import { redirect } from "next/navigation";
import { PLAN } from "@/content/plan-meta";

export default function Page() {
  redirect(`/plan/${PLAN.number}`);
}
