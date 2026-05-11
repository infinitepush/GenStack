import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { compare } from "bcryptjs";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { appConfig } from "./app-config";
import { logger } from "./logger";
import { prisma } from "./prisma";

const providers: NextAuthOptions["providers"] = [];

if (appConfig.auth.enabled && appConfig.auth.methods.includes("email")) {
  providers.push(
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          const email = credentials?.email?.trim().toLowerCase();
          const password = credentials?.password;

          if (!email || !password) {
            return null;
          }

          const user = await prisma.user.findUnique({ where: { email } });
          if (!user?.passwordHash) {
            return null;
          }

          const isValid = await compare(password, user.passwordHash);
          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image
          };
        } catch (error: unknown) {
          logger.error({ error }, "Credentials authorization failed");
          return null;
        }
      }
    })
  );
}

if (appConfig.auth.enabled && appConfig.auth.methods.includes("github")) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (clientId && clientSecret) {
    providers.push(GitHubProvider({ clientId, clientSecret }));
  } else {
    logger.warn("GitHub auth is enabled in config but OAuth environment variables are missing.");
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: `/${appConfig.app.locale}/auth`
  },
  callbacks: {
    async session({ session, token, user }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: user?.id ?? token.sub ?? ""
        }
      };
    }
  }
};
