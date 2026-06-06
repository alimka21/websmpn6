# SRS Index — Web Ujian Sekolah Modern

> **Panduan untuk Claude Code:**  
> Sebelum memulai task apapun, baca file ini untuk cek requirement yang relevan.  
> **JANGAN** baca semua file sekaligus — hanya baca yang diperlukan untuk task saat ini.

---

## 📚 Daftar Requirement (SRS)

| ID | Nama File | Deskripsi | Status |
|----|-----------|-----------|--------|
| REQ-001 | [auth.md](requirements/REQ-001-auth.md) | Autentikasi & Authorization (Login, Role, JWT) | ✅ Implemented |
| REQ-002 | [ujian.md](requirements/REQ-002-ujian.md) | Sistem Ujian (Buat Ujian, Kelola Soal, Anti-Cheat) | ✅ Implemented |
| REQ-003 | [presensi.md](requirements/REQ-003-presensi.md) | Presensi Guru & Siswa (Kiosk, Face Detection) | ✅ Implemented |
| REQ-004 | [alumni.md](requirements/REQ-004-alumni.md) | Alumni Tracer System | ✅ Implemented |
| REQ-005 | [cms.md](requirements/REQ-005-cms.md) | CMS (Berita, Agenda, Dokumen, Site Config) | ✅ Implemented |
| REQ-006 | [deploy.md](requirements/REQ-006-deploy.md) | Deployment & Production (Hostinger, MySQL) | ✅ Implemented |

---

## 🐛 Issue Tracker

| ID | Nama File | Deskrippo | Status | Prioritas |
|----|-----------|-----------|--------|-----------|
| ISS-001 | [anti-cheat-not-working.md](issues/ISS-001-anti-cheat-not-working.md) | Anti-cheat tidak tercatat & audio tidak bunyi | 🔧 Fixed | High |
| ISS-002 | [hostinger-firewall.md](issues/ISS-002-hostinger-firewall.md) | Firewall Hostinger block API create ujian | 🔧 Fixed | High |
| ISS-003 | [cache-bust-failed-fetch.md](issues/ISS-003-cache-bust-failed-fetch.md) | Failed to fetch module after deploy | 🔧 Fixed | Medium |

---

## 🎯 Cara Penggunaan untuk Claude

### **Saat Menerima Task Baru:**

1. **Identifikasi kategori task:**
   - Autentikasi/Login → Baca `REQ-001`
   - Ujian/Soal → Baca `REQ-002`
   - Presensi → Baca `REQ-003`
   - Alumni → Baca `REQ-004`
   - CMS/Konten → Baca `REQ-005`
   - Deploy/Error → Baca `REQ-006`

2. **Baca HANYA file requirement yang relevan:**
   ```
   Contoh: User minta "tambah fitur export nilai ujian"
   → Baca: REQ-002-ujian.md (cek existing export feature)
   → JANGAN baca: REQ-003, REQ-004, dll yang tidak relevan
   ```

3. **Cek apakah ada issue terkait:**
   - Jika task adalah bug fix → Cek folder `issues/`
   - Jika issue sudah ada → Baca issue file-nya
   - Jika issue baru → Buat file issue baru

4. **Update dokumentasi setelah selesai:**
   - Update status di SRS_INDEX.md
   - Update detail di requirement file yang relevan
   - Tandai issue sebagai Fixed jika applicable

### **Template Penamaan File:**

**Requirements:**
- Format: `REQ-XXX-nama-singkat.md`
- Contoh: `REQ-007-rapor.md`, `REQ-008-pembayaran.md`

**Issues:**
- Format: `ISS-XXX-deskripsi-singkat.md`
- Contoh: `ISS-004-presensi-timezone.md`

---

## 📊 Status Legend

- ✅ **Implemented** — Fitur sudah ada dan berjalan
- 🚧 **In Progress** — Sedang dikerjakan
- 📝 **Planned** — Direncanakan tapi belum mulai
- 🔧 **Fixed** — Bug sudah diperbaiki
- ⚠️ **Known Issue** — Bug diketahui tapi belum diperbaiki
- ❌ **Deprecated** — Sudah tidak dipakai lagi

---

## 🔄 Update Log

| Tanggal | Perubahan | File Terkait |
|---------|-----------|--------------|
| 2026-06-06 | Initial SRS structure created | All REQ-* files |
| 2026-06-06 | Fix anti-cheat not recording violations | ISS-001 |
| 2026-06-06 | Fix Hostinger firewall blocking API | ISS-002 |
| 2026-06-06 | Fix cache busting for lazy-loaded modules | ISS-003 |

---

**Last Updated:** 2026-06-06  
**Maintainer:** Claude Code + User (alimka)
