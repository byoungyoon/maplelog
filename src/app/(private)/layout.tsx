import { redirect } from "next/navigation";
import { authorizePage } from "@/server/auth/page";
import { connectionStatus } from "@/server/connection";
import { readBook } from "@/server/db";
import { withAccount } from "@/server/db";
export const dynamic = "force-dynamic";
export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await authorizePage();
  const ready = await withAccount(account, async () =>
    (await connectionStatus()).connected && (await readBook("live")).settings.setupDone);
  if (!ready)
    redirect("/setup");
  return children;
}
