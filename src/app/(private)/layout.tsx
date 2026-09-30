import { redirect } from "next/navigation";
import { authorizePage } from "@/server/auth/page";
import { connectionStatus } from "@/server/connection";
import { readBook } from "@/server/db";
export const dynamic = "force-dynamic";
export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await authorizePage();
  if (!(await connectionStatus()).connected || !(await readBook("live")).settings.setupDone)
    redirect("/setup");
  return children;
}
