import { redirect } from "next/navigation";
import { getActor } from "@/lib/security/actor";
import { Landing } from "@/components/shared/landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  const actor = await getActor().catch(() => null);
  if (actor) redirect(actor.role === "STUDENT" ? "/student" : "/parent");
  return <Landing />;
}
