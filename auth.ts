import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

type AppUser = {
  id: string;
  username: string;
  password: string;
  name: string;
  role: "admin" | "user";
};

const APP_USERS: AppUser[] = [
  {
    id: "1",
    username: "admin",
    password: "@workshop2121",
    name: "Workshop Admin",
    role: "admin",
  },
  {
    id: "2",
    username: "user",
    password: "user123",
    name: "General User",
    role: "user",
  },
  {
    id: "3",
    username: "jorden",
    password: "jorden123",
    name: "Jorden",
    role: "admin",
  },
  {
    id: "4",
    username: "viewer1",
    password: "viewer123",
    name: "Viewer 1",
    role: "user",
  },
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = String(credentials?.username ?? "").trim();
        const password = String(credentials?.password ?? "");

        const matchedUser = APP_USERS.find(
          (user) => user.username === username && user.password === password
        );

        if (!matchedUser) {
          return null;
        }

        return {
          id: matchedUser.id,
          name: matchedUser.name,
          role: matchedUser.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = (token.name as string | undefined) ?? session.user.name;
        (session.user as { role?: string }).role = token.role as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
