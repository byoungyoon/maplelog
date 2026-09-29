import SetupArea from "@/features/setup/_area/Setup.area";
import { authorizePage } from "@/server/auth/page";
export const dynamic = "force-dynamic";
export default async function Page() {
  await authorizePage();
  return <SetupArea />;
}
