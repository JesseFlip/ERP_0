import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function createContext() {
  const session = await getSession();
  return { prisma, session };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
