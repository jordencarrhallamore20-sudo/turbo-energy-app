import { auth } from "../auth";
import { redirect } from "next/navigation";
import DashboardClient from "./page-client";

export default async function Page() {
  const session = await auth();

  // 🚫 Stop flash of empty/basic page
  if (!session?.user) {
    redirect("/login");
  }

  // ✅ Only render dashboard AFTER session confirmed
  return (
    <DashboardClient
      role={(session.user as { role?: string }).role ?? "user"}
      username={session.user.name ?? "User"}
    />
  );
}
