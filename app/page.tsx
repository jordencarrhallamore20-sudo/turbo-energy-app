import { auth } from "../auth";
import { redirect } from "next/navigation";
import DashboardClient from "./page-client";

type SessionUserWithRole = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

export default async function Page() {
  const session = await auth();

  // Stop dashboard opening without login
  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as SessionUserWithRole;

  const role = user.role === "admin" ? "admin" : "user";
  const username = user.name || user.email || "User";

  return <DashboardClient role={role} username={username} />;
}
