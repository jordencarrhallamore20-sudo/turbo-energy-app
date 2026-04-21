import { auth } from "../auth";
import { redirect } from "next/navigation";
import DashboardClient from "./page-client";

export default async function Page() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <DashboardClient role={(session.user as { role?: string }).role ?? "user"} />;
}
