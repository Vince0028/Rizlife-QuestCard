import { PrismaClient } from "@prisma/client";
import { createSupabasePrismaClient } from "./supabase-adapter";

const globalForPrisma = globalThis as unknown as {
  rizlifePrismaV4: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  if (process.env.DATABASE_URL?.trim()) {
    return new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }
  return createSupabasePrismaClient() as unknown as PrismaClient;
}

export const prisma: PrismaClient =
  globalForPrisma.rizlifePrismaV4 ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.rizlifePrismaV4 = prisma;
}
