#!/bin/bash
# scripts/hostinger-cleanup.sh
#
# Cleanup storage Hostinger setelah deploy berulang.
# Jalankan via SSH:
#   ssh u120188252@HOSTINGER_HOST
#   cd ~/domains/SITUS/nodejs   (atau folder app Node.js kamu)
#   bash scripts/hostinger-cleanup.sh
#
# AMAN — tidak hapus source code, .env, atau database. Hanya cleanup
# build artifacts + caches + logs lama.

set -e

echo "═══════════════════════════════════════════════════════"
echo "  Hostinger Storage Cleanup"
echo "═══════════════════════════════════════════════════════"
echo

# 1) Size sebelum cleanup
echo "📊 Disk usage SEKARANG di app folder:"
du -sh . 2>/dev/null || true
echo

echo "📁 Folder terbesar:"
du -sh */ 2>/dev/null | sort -hr | head -10
echo

# 2) Hapus build artifacts
if [ -d "dist" ]; then
  size=$(du -sh dist 2>/dev/null | cut -f1)
  echo "🗑️  Hapus ./dist (frontend build, $size)..."
  rm -rf dist
fi

if [ -d "server/dist" ]; then
  size=$(du -sh server/dist 2>/dev/null | cut -f1)
  echo "🗑️  Hapus ./server/dist (server tsc output, $size)..."
  rm -rf server/dist
fi

# 3) Prisma engine binaries platform yg tidak dipakai di production.
#    Hostinger CloudLinux pakai rhel-openssl-1.1.x. Sisanya bisa dihapus.
PRISMA_DIR="server/node_modules/.prisma/client"
if [ -d "$PRISMA_DIR" ]; then
  echo "🗑️  Hapus Prisma engine binary non-rhel di $PRISMA_DIR..."
  cd "$PRISMA_DIR"
  ls libquery_engine-* 2>/dev/null | grep -v "rhel-openssl-1.1.x" | xargs -r rm -v
  cd - >/dev/null
fi

# 4) npm cache user-level
NPM_CACHE="$HOME/.npm"
if [ -d "$NPM_CACHE" ]; then
  size=$(du -sh "$NPM_CACHE" 2>/dev/null | cut -f1)
  echo "🗑️  Bersihkan npm cache ($size)..."
  npm cache clean --force 2>&1 | tail -3 || true
fi

# 5) Hostinger node logs (kalau ada)
for log_dir in "$HOME/logs" "./logs" "./.pm2/logs"; do
  if [ -d "$log_dir" ]; then
    size=$(du -sh "$log_dir" 2>/dev/null | cut -f1)
    echo "🗑️  Hapus log lama di $log_dir ($size, simpan 7 hari terakhir)..."
    find "$log_dir" -type f -name "*.log" -mtime +7 -delete 2>/dev/null || true
    find "$log_dir" -type f -name "*.gz" -mtime +7 -delete 2>/dev/null || true
  fi
done

# 6) Size setelah cleanup
echo
echo "═══════════════════════════════════════════════════════"
echo "✅ Cleanup selesai."
echo "📊 Disk usage SESUDAH cleanup:"
du -sh . 2>/dev/null || true
echo

echo "💡 Langkah selanjutnya:"
echo "   1. Restart Node.js app dari Hostinger Panel"
echo "   2. Build ulang akan otomatis trigger saat next deploy"
echo
