import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      async authorize(credentials) {
        const username = credentials?.username;
        const password = credentials?.password;

        if (username === "admin" && password === "admin123") {
          return { name: "Admin", role: "admin" };
        }

        if (username === "user" && password === "user123") {
          return { name: "User", role: "user" };
        }

        return null;
      },
    }),
  ],
});
