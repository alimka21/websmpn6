// server/lib/prisma.ts
// PRISMA NO-RUST MODE — query engine via custom mysql2 driver adapter.
//
// HISTORY:
//   1. Awalnya pakai default Prisma engine (Rust binary). Block oleh
//      Hostinger CloudLinux shared (syscall clock_gettime).
//   2. Pindah ke @prisma/adapter-mariadb (driver `mariadb` npm package).
//      Gagal di Hostinger — pool selalu active=0 idle=0, tidak bisa create
//      koneksi baru (bug di paket `mariadb` npm dgn environment Hostinger).
//   3. Sekarang: custom adapter pakai mysql2/promise. mysql2 sukses connect
//      ke MySQL Hostinger dgn kredensial yg sama (terbukti via diagnostic).

import { PrismaClient } from "../generated/prisma/client";
import { PrismaMysql2 } from "./prisma-mysql2-adapter";

function createPrismaClient(): PrismaClient {
  const raw = process.env.DATABASE_URL || "";
  if (!raw) {
    throw new Error("DATABASE_URL belum di-set di environment");
  }
  const url = new URL(raw);

  // Paksa TCP — localhost kadang trigger Unix socket attempt yg gagal di
  // CloudLinux container.
  let host = url.hostname;
  if (host === "localhost") {
    host = "127.0.0.1";
    console.log("[prisma] host=localhost → di-rewrite ke 127.0.0.1 (paksa TCP)");
  }

  const port = url.port ? Number(url.port) : 3306;
  const user = decodeURIComponent(url.username);
  const database = url.pathname.slice(1);
  const connectionLimit = Number(url.searchParams.get("connection_limit") || 10);
  const connectTimeoutMs =
    Number(url.searchParams.get("connect_timeout") || 10) * 1000;

  console.log(
    `[prisma] connect (mysql2) → mysql://${user}:***@${host}:${port}/${database} ` +
    `(pool=${connectionLimit}, connect=${connectTimeoutMs}ms)`
  );

  const adapter = new PrismaMysql2({
    host,
    port,
    user,
    password: decodeURIComponent(url.password),
    database,
    connectionLimit,
    connectTimeout: connectTimeoutMs,
    multipleStatements: true,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Diagnostic — test koneksi raw lewat mysql2 (terpisah dari Prisma adapter).
 * Dipakai saat startup untuk verifikasi kredensial & jaringan OK.
 */
export async function diagnoseConnection(): Promise<string | null> {
  try {
    const raw = process.env.DATABASE_URL || "";
    if (!raw) return "DATABASE_URL kosong";
    const url = new URL(raw);
    const host = url.hostname === "localhost" ? "127.0.0.1" : url.hostname;

    const mysql = await import("mysql2/promise");
    const conn = await mysql.createConnection({
      host,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      connectTimeout: 10000,
    });
    await conn.query("SELECT 1");
    await conn.end();
    return null;
  } catch (err: any) {
    return `[${err?.code || "ERR"}] ${err?.message || String(err)}`;
  }
}
