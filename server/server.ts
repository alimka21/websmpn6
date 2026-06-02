import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { readFile as fsReadFile } from "fs/promises";
import os from "os";

// ── Load .env from multiple possible locations ───────
console.log("[startup] __dirname:", __dirname);
console.log("[startup] cwd:", process.cwd());
console.log("[startup] os.homedir():", os.homedir());
console.log("[startup] process.env.HOME:", process.env.HOME);

const envCandidates = [
  path.join(__dirname, "../.env"),
  path.join(__dirname, "../../.env"),
  path.join(__dirname, "../../server/.env"),
  path.join(os.homedir(), ".env"),
  path.join(process.cwd(), ".env"),
  "/home/u120188252/.env",
  "/home/u120188252/domains/mediumaquamarine-camel-941738.hostingersite.com/.env",
];
let envLoadedFrom: string | null = null;
for (const p of envCandidates) {
  const exists = fs.existsSync(p);
  console.log(`[startup] check ${p}: ${exists ? "EXISTS" : "no"}`);
  if (exists && !envLoadedFrom) {
    // override:true → .env selalu menang atas env var yang sudah di-set Hostinger panel
    dotenv.config({ path: p, override: true });
    envLoadedFrom = p;
  }
}
console.log("[startup] .env loaded from:", envLoadedFrom || "(none — using process.env from system)");

// Debug: tampilkan DATABASE_URL dengan password disensor supaya bisa diverifikasi tanpa bocor kredensial
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const sanitized = dbUrl.replace(/:([^:@\/]+)@/, ":***@");
  console.log(`[startup] DATABASE_URL preview: ${sanitized}`);
  console.log(`[startup] DATABASE_URL length: ${dbUrl.length} chars`);
  console.log(`[startup] DATABASE_URL starts with: "${dbUrl.slice(0, 8)}"`);
} else {
  console.log("[startup] DATABASE_URL: (NOT SET)");
}
console.log("[startup] NODE_ENV:", process.env.NODE_ENV);

import { logger, errorHandler, extractUserId } from './middleware';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import guruRoutes from './routes/guru';
import siswaRoutes from './routes/siswa';
import publicRoutes from './routes/public';
import presensiRoutes, { startAutoCheckoutCron } from './routes/presensi';

// ── Bootstrap DB in-process (no child process spawning) ──────────
// LiteSpeed FastCGI spawn beberapa worker; spawning `prisma db push` lewat
// execSync sering hit EAGAIN. Solusinya: pakai Prisma client langsung untuk
// eksekusi migration.sql. Bersifat idempotent — per-statement "already
// exists" error di-swallow, jadi aman dijalankan setiap startup dan
// migration baru otomatis ter-apply tanpa perlu drop table.

function splitSqlStatements(sql: string): string[] {
  // Buang line comments & blok komentar, lalu split by ;
  const cleaned = sql
    .replace(/\/\*[\s\S]*?\*\//g, "")        // /* ... */
    .replace(/^\s*--.*$/gm, "");              // -- line comment
  return cleaned
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function runInitMigration(prisma: any): Promise<void> {
  // Lokasi migration.sql relatif ke server/dist (file ada di server/prisma/migrations/...)
  const migrationDir = path.join(__dirname, "../prisma/migrations");
  if (!fs.existsSync(migrationDir)) {
    throw new Error(`Migration dir tidak ditemukan: ${migrationDir}`);
  }
  const subdirs = fs.readdirSync(migrationDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  if (subdirs.length === 0) {
    throw new Error(`Tidak ada migration di ${migrationDir}`);
  }

  // Pastikan tabel tracking ada — small, idempotent.
  await prisma.$executeRawUnsafe(
    "CREATE TABLE IF NOT EXISTS `_app_migrations` (" +
    "  `name` VARCHAR(255) NOT NULL," +
    "  `applied_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)," +
    "  PRIMARY KEY (`name`)" +
    ") DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
  );

  // Cek migration mana yg sudah ter-apply
  const appliedRows = (await prisma.$queryRawUnsafe(
    "SELECT `name` FROM `_app_migrations`"
  )) as { name: string }[];
  const applied = new Set(appliedRows.map((r: { name: string }) => r.name));

  const pending = subdirs.filter(s => !applied.has(s));
  if (pending.length === 0) {
    console.log(`[startup] ✅ All ${subdirs.length} migrations already applied — nothing to do.`);
    return;
  }
  console.log(`[startup] ${applied.size} applied, ${pending.length} pending: ${pending.join(", ")}`);

  for (const sub of pending) {
    const sqlFile = path.join(migrationDir, sub, "migration.sql");
    if (!fs.existsSync(sqlFile)) {
      console.warn(`[startup]   Skip ${sub}: migration.sql tidak ada`);
      continue;
    }
    const sql = fs.readFileSync(sqlFile, "utf8");
    const stmts = splitSqlStatements(sql);
    console.log(`[startup]   Applying ${sub}: ${stmts.length} statement(s)`);
    let migrationFailed = false;
    for (let i = 0; i < stmts.length; i++) {
      try {
        await prisma.$executeRawUnsafe(stmts[i]);
      } catch (err: any) {
        const msg = err?.message ?? "";
        // Idempotent: swallow no-op error untuk statement yang mungkin sudah
        // jalan parsial dari attempt sebelumnya yg ke-kill di tengah.
        if (
          /already exists/i.test(msg) ||
          /check that .* exists/i.test(msg) ||
          /no such index/i.test(msg) ||
          /doesn'?t exist/i.test(msg) ||
          /\b1091\b/.test(msg)
        ) {
          continue;
        }
        console.error(`[startup]   ❌ ${sub} statement #${i + 1} gagal:\n${stmts[i].slice(0, 200)}...`);
        migrationFailed = true;
        break;
      }
    }
    if (!migrationFailed) {
      // Tandai migration sebagai applied — supaya worker berikutnya skip.
      await prisma.$executeRawUnsafe(
        "INSERT IGNORE INTO `_app_migrations` (`name`) VALUES (?)",
        sub
      );
      console.log(`[startup]   ✅ ${sub} applied`);
    }
  }
}

// Module-level guard supaya bootstrap maksimal 1x per worker process.
let bootstrapStarted = false;

async function bootstrapDatabase() {
  if (process.env.NODE_ENV !== "production") return;

  // Bootstrap di-disable secara default karena Prisma engine pada beberapa
  // shared hosting (Hostinger CloudLinux) panic "timer has gone away" saat
  // dipakai untuk $executeRawUnsafe. Migration & seed dijalankan manual
  // lewat phpMyAdmin (lihat server/prisma/migrations/*/migration.sql dan
  // server/prisma/seed.sql).
  // Untuk meng-enable lagi: set ENABLE_BOOTSTRAP=true di environment.
  if (process.env.ENABLE_BOOTSTRAP !== "true") {
    console.log("[startup] Bootstrap di-skip (ENABLE_BOOTSTRAP != true). Pakai phpMyAdmin untuk migration/seed manual.");
    return;
  }

  if (bootstrapStarted) {
    console.log("[startup] Bootstrap sudah berjalan di proses ini — skip.");
    return;
  }
  bootstrapStarted = true;
  try {
    const { prisma } = await import("./lib/prisma");
    await runInitMigration(prisma);

    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log("[startup] Database empty, running seed (in-process)...");
      const { runSeed } = await import("./prisma/seed");
      await runSeed(prisma);
      console.log("[startup] ✅ Seed complete.");
    } else {
      console.log(`[startup] ✅ Database has ${userCount} users — seed skipped.`);
    }
  } catch (err: any) {
    console.error("[startup] ❌ Bootstrap failed:", err?.message ?? err);
    if (err?.stack) console.error(err.stack);
  }
}

const app = express();
const PORT = process.env.NODE_ENV === "production" ? (Number(process.env.PORT) || 3001) : 3001;

// ── Security headers (helmet) ────────────────────────
// CSP & COEP di-disable: CSP butuh whitelist inline-style/iframe yg belum
// disiapkan; COEP off supaya Google Maps iframe di footer tidak ke-block.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ── Gzip compression — kurangi ukuran response 60-80% ─
app.use(compression({
  level: 6,        // balance kompresi vs CPU
  threshold: 1024, // hanya compress response > 1KB
}));

// Flag: bootstrap belum selesai → request ke /api/* (selain /health) dapat 503
let bootstrapDone = false;

// ── CORS dinamis: dev + production ────────────────────
// FRONTEND_URL dukung multi-domain dipisah koma: "https://a.com,https://b.com"
const envOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  ...envOrigins,
];

// Domain Hostinger sekolah ini: main custom + preview subdomain
const ALLOWED_DOMAIN_SUFFIXES = [
  '.hostingersite.com',     // Hostinger preview subdomain (rosybrown-crab-*, dst)
  'smknegeriayamaru.sch.id', // Production custom domain
];

function isOriginAllowed(origin: string): boolean {
  if (allowedOrigins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    return ALLOWED_DOMAIN_SUFFIXES.some(suffix =>
      url.hostname === suffix || url.hostname.endsWith(suffix)
    );
  } catch {
    return false;
  }
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin (Postman, curl, same-origin) di semua env
    if (!origin) return callback(null, true);
    if (isOriginAllowed(origin)) return callback(null, true);
    // Block silent (return false bukan throw) — hindari spam stack trace
    // di log untuk preflight yg sah-sah saja di-reject.
    console.warn(`[CORS] Block origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.set("trust proxy", 1);
app.use(logger);

// ── Health check (Hostinger butuh) ────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    bootstrapDone,
    timestamp: new Date().toISOString(),
  });
});

// ── Soft JWT decode → req.userId — dipasang SEBELUM rate limiter supaya
// bucket di-key per user, bukan per IP. Tanpa ini, 500 siswa di belakang
// 1 NAT sekolah jadi 1 IP → bucket 200/min habis dalam 12 detik.
app.use("/api", extractUserId);

// ── Rate limiting ─────────────────────────────────────
// Sengaja sebelum bootstrap gate supaya brute-force tidak bisa nge-hit gate berulang.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit." },
  standardHeaders: true,
  legacyHeaders: false,
  // Pre-login req.userId undefined → fallback ke IP (brute force protection)
  keyGenerator: (req) => req.userId || ipKeyGenerator(req.ip || '0.0.0.0'),
});
app.use("/api/auth/login", authLimiter);

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { error: "Terlalu banyak request. Coba lagi sebentar." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || ipKeyGenerator(req.ip || '0.0.0.0'),
  skip: (req) => req.path.includes("/assets"),
});
app.use("/api", generalLimiter);

// Sesi ujian — bucket per-user terpisah supaya auto-save intensif
// (debounce 500ms = max 2 req/s/siswa) tidak menggerus quota endpoint lain.
// Double-limit dengan generalLimiter: traffic /sesi tidak makan jatah 200/min
// untuk endpoint dashboard biasa.
const ujianLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  message: { error: "Aktivitas ujian terlalu cepat. Tunggu sebentar." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || ipKeyGenerator(req.ip || '0.0.0.0'),
});
app.use("/api/siswa/sesi", ujianLimiter);

// ── Cache-Control headers per kategori endpoint ───────
// URUTAN PENTING: middleware Express tidak short-circuit. Yang lebih spesifik
// HARUS declared SETELAH yang lebih umum supaya menang override.

// 1. Dashboard private (guru/siswa/admin) — default 30 detik di browser
app.use(["/api/guru", "/api/siswa", "/api/admin"], (req, res, next) => {
  if (req.method === "GET") {
    res.set("Cache-Control", "private, max-age=30");
  } else {
    res.set("Cache-Control", "no-store");
  }
  next();
});
// 2. Override: sesi ujian aktif TIDAK BOLEH di-cache (jawaban/timer/anti-cheat)
app.use("/api/siswa/sesi", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  next();
});
// 2b. Override: list ujian aktif siswa — admin reset sesi siswa harus
// langsung terlihat (siswa dapat list fresh). 30s default terlalu lama.
app.use("/api/siswa/ujian-aktif", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  next();
});
// 3. Auth → no cache
app.use("/api/auth", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
// 4. Public (berita, alumni stats) → cache 5 menit di browser, SWR 1 menit
app.use(["/api/berita", "/api/alumni"], (req, res, next) => {
  if (req.method === "GET") {
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
  } else {
    res.set("Cache-Control", "no-store");
  }
  next();
});

// ── Gate: blok /api/* sampai bootstrap selesai ────────
app.use("/api", (_req, res, next) => {
  if (bootstrapDone) return next();
  res.status(503).json({
    error: "Database sedang disiapkan, coba lagi sebentar",
    retry_after_seconds: 5,
  });
});

// ── Mount routes ──────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/guru", guruRoutes);
app.use("/api/siswa", siswaRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/presensi", presensiRoutes);
app.use("/api", publicRoutes);

startAutoCheckoutCron();

// Global Error Handler
app.use(errorHandler);

// ── Error handler global ──────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[ERROR]", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// ── Serve frontend (production only) ─────────────────
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.join(__dirname, "../../dist");

  // Asset hash-filename: aman cache 1 tahun (Vite gen hash per build).
  // index.html DI-EXCLUDE via setHeaders — harus selalu fresh supaya
  // browser dapat referensi filename hash terbaru setelah re-deploy.
  app.use(express.static(frontendDist, {
    maxAge: "1y",
    immutable: true,
    etag: true,
    // index: false — supaya request "/" tidak langsung di-serve index.html
    // oleh express.static (melewati handler meta-inject kita). Semua
    // navigasi SPA — termasuk root "/" — ditangani app.get("*") di bawah
    // yg inject og:title, og:description, dll dari SiteConfig.
    index: false,
  }));

  // SPA fallback — HANYA untuk route navigasi (tanpa file extension).
  // Kalau request asset (.js/.css/.png/dll) yg tidak ditemukan, return
  // 404 supaya browser tidak salah parse HTML sbg JavaScript module.
  // Saat serve index.html, inject meta tag SEO (OG/Twitter) dari SiteConfig
  // supaya bot WhatsApp/Google/Facebook baca nama sekolah + tagline secara
  // langsung tanpa perlu eksekusi JavaScript.
  const indexHtmlPath = path.join(frontendDist, "index.html");
  const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let siteMetaCache: { tags: string; expireAt: number } | null = null;

  async function buildMetaTags(): Promise<string> {
    const now = Date.now();
    if (siteMetaCache && now < siteMetaCache.expireAt) return siteMetaCache.tags;
    try {
      const { prisma } = await import("./lib/prisma");
      const cfg = await prisma.siteConfig.findFirst();
      const nama = escHtml(cfg?.namaSekolah || "Website Sekolah");
      const tagline = escHtml(cfg?.tagline || "Website Resmi Sekolah");
      const deskripsi = escHtml(cfg?.deskripsi || tagline);
      const siteUrl = process.env.FRONTEND_URL || "";
      const logo = cfg?.logoUrl && !cfg.logoUrl.startsWith("data:")
        ? escHtml(cfg.logoUrl)
        : `${siteUrl}/favicon.ico`;
      const tags = `
    <!-- SEO & Open Graph — di-inject server-side supaya terbaca bot -->
    <title>${nama} — ${tagline}</title>
    <meta name="description" content="${deskripsi}" />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${nama}" />
    <meta property="og:title" content="${nama} — ${tagline}" />
    <meta property="og:description" content="${deskripsi}" />
    <meta property="og:url" content="${siteUrl}/" />
    <meta property="og:image" content="${logo}" />
    <meta property="og:locale" content="id_ID" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${nama} — ${tagline}" />
    <meta name="twitter:description" content="${deskripsi}" />
    <meta name="twitter:image" content="${logo}" />`;
      siteMetaCache = { tags, expireAt: now + 5 * 60 * 1000 };
      return tags;
    } catch {
      return "";
    }
  }

  app.get("*", async (req, res) => {
    if (/\.[a-zA-Z0-9]+$/.test(req.path)) {
      return res.status(404).send("Not found");
    }
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    try {
      const [html, metaTags] = await Promise.all([
        fsReadFile(indexHtmlPath, "utf-8"),
        buildMetaTags(),
      ]);
      const injected = html.replace("<!--META_INJECT-->", metaTags);
      res.type("html").send(injected);
    } catch {
      res.sendFile(indexHtmlPath);
    }
  });
}

// LiteSpeed FastCGI punya startup timeout pendek. Listen DULU supaya tidak
// di-kill, lalu bootstrap jalan di background. Sementara bootstrap belum
// selesai, request DB-aware akan dapat 503 dari middleware di bawah.
app.listen(PORT, () => {
  console.log(`✅ Backend siap di http://localhost:${PORT}`);
  console.log(`   Mode: ${process.env.NODE_ENV || "development"}`);

  // ── Pre-warm Prisma engine (cegah PANIC "timer has gone away") ──
  // CloudLinux LiteSpeed FastCGI spawn beberapa worker. Tanpa pre-warm,
  // request konkuren pertama trigger lazy library init bareng-bareng →
  // race condition → engine PANIC ("library already starting").
  // Solusi: jalankan dummy query saat startup supaya engine sudah ready
  // sebelum traffic masuk. Tidak block listen — async fire-and-forget.
  (async () => {
    try {
      const { prisma, diagnoseConnection } = await import("./lib/prisma");

      // Test raw mysql2 connection dulu — kalau gagal di sini, error
      // sebenarnya (auth/host/port) muncul jelas, tidak di-swallow
      // jadi generic "pool timeout" oleh adapter mariadb.
      const diag = await diagnoseConnection();
      if (diag) {
        console.error("[startup] ❌ DIAGNOSTIC mysql2 GAGAL:", diag);
        console.error("[startup] → Cek DATABASE_URL di env. Verifikasi user/password/host/database benar.");
        console.error("[startup] → Hostinger: hostname biasanya 'localhost' (auto rewrite ke 127.0.0.1).");
        return;
      }
      console.log("[startup] ✅ Diagnostic mysql2: koneksi raw OK.");

      await prisma.$queryRawUnsafe("SELECT 1");
      console.log("[startup] ✅ Prisma engine warmed up.");
    } catch (err: any) {
      console.error("[startup] ⚠️ Prisma warmup gagal:", err?.message ?? err);
    }
  })();

  // Bootstrap async di background — TIDAK boleh block listen
  console.log("[startup] Starting database bootstrap in background...");
  bootstrapDatabase()
    .then(() => {
      bootstrapDone = true;
      console.log("[startup] ✅ Bootstrap completed.");
    })
    .catch((err) => {
      bootstrapDone = true; // tetap tandai selesai supaya tidak block selamanya
      console.error("[startup] ❌ Bootstrap rejected:", err?.message ?? err);
    });
});
