import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authorize } from "./index";
export async function authorizePage() {
  const h = await headers();
  try {
    await authorize(
      new Request(`http://${h.get("host") || "localhost"}`, { headers: h }),
    );
  } catch {
    redirect("/login");
  }
}
