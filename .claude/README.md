# 📚 Dokumentasi Referensi - Web Ujian Sekolah Modern

> **Panduan Lengkap untuk Claude Code & Developer**

---

## 📂 Struktur Folder

```
.claude/
├── README.md                    ← Panduan ini
├── SRS_INDEX.md                 ← Master index (BACA INI DULU!)
├── requirements/                ← Dokumentasi requirement (SRS)
│   ├── REQ-001-auth.md
│   ├── REQ-002-ujian.md
│   ├── REQ-003-presensi.md
│   ├── REQ-004-alumni.md
│   ├── REQ-005-cms.md
│   └── REQ-006-deploy.md
└── issues/                      ← Bug tracking & fixes
    ├── ISS-001-anti-cheat-not-working.md
    ├── ISS-002-hostinger-firewall.md
    └── ISS-003-cache-bust-failed-fetch.md
```

---

## 🎯 Cara Penggunaan

### **Untuk Claude Code:**

#### 1. Saat Menerima Task Baru
```
User: "Tambah fitur export nilai ujian ke PDF"

Claude:
1. Identifikasi kategori → Ujian
2. Baca HANYA: .claude/requirements/REQ-002-ujian.md
3. Cek existing export feature (saat ini hanya Excel)
4. Implementasi export PDF
5. Update REQ-002-ujian.md dengan feature baru
```

#### 2. Saat Fix Bug
```
User: "Presensi tidak tercatat setelah midnight"

Claude:
1. Cek apakah issue sudah pernah ada di .claude/issues/
2. Jika belum ada, buat file baru: ISS-00X-nama-bug.md
3. Diagnosis → Root cause → Solution
4. Update file issue dengan status Fixed
5. Update SRS_INDEX.md (mark issue as Fixed)
```

#### 3. Saat Update Feature
```
User: "Ubah layout kiosk presensi guru"

Claude:
1. Baca: .claude/requirements/REQ-003-presensi.md
2. Cek section FR-003.1 (Presensi Guru Kiosk)
3. Implementasi perubahan
4. Update REQ-003-presensi.md dengan layout baru
5. Tambah note di Known Issues (jika ada breaking change)
```

---

### **Untuk User/Developer:**

#### A. Minta Claude Membaca Requirement
```
✅ GOOD: "Claude, baca REQ-002 dulu sebelum tambah fitur ini"
❌ BAD: "Langsung tambah fitur X" (Claude harus baca dulu untuk konteks)
```

#### B. Minta Claude Update Dokumentasi
```
"Setelah selesai, update REQ-XXX dengan perubahan ini"
```

#### C. Tracking Bug dengan Issue File
```
"Buat issue file untuk bug ini dengan format ISS-XXX"
```

---

## 📋 Template & Naming Convention

### **Requirements (REQ-XXX-nama.md)**

**Format:**
```markdown
# REQ-XXX: Judul Requirement

**Status:** ✅ Implemented | 🚧 In Progress | 📝 Planned  
**Last Updated:** YYYY-MM-DD

---

## 📌 Overview
[Deskripsi singkat]

## 🎯 Functional Requirements
### FR-XXX.1: Nama Feature
[Detail requirement]

## 🗂️ File Struktur
[List file terkait]

## 🧪 API Endpoints / Testing
[Cara testing]

## 🐛 Known Issues
[Bug atau limitasi yang diketahui]

## 📝 Notes
[Catatan tambahan]
```

**Naming:**
- `REQ-001-auth.md` → Autentikasi
- `REQ-007-rapor.md` → Fitur rapor (contoh baru)
- `REQ-008-pembayaran.md` → SPP/Pembayaran (contoh baru)

---

### **Issues (ISS-XXX-deskripsi.md)**

**Format:**
```markdown
# ISS-XXX: Judul Bug/Issue

**Status:** 🔧 Fixed | ⚠️ Known Issue | 📝 Planned  
**Reported:** YYYY-MM-DD  
**Fixed:** YYYY-MM-DD (jika sudah)  
**Priority:** High | Medium | Low  
**Related Requirement:** REQ-XXX

---

## 🐛 Problem Description
[Deskripsi masalah dari user]

## 🔍 Root Cause Analysis
[Diagnosis & finding]

## ✅ Solution Implemented
[Solusi yang diterapkan + code snippet]

## 🧪 Testing Steps
[Cara verify fix]

## 📊 Result
[Hasil setelah fix]

## 📝 Notes
[Catatan tambahan]
```

**Naming:**
- `ISS-001-anti-cheat-not-working.md`
- `ISS-004-presensi-timezone.md` (contoh baru)
- `ISS-005-export-excel-timeout.md` (contoh baru)

---

## 🔄 Workflow Update Dokumentasi

### Scenario 1: Tambah Feature Baru
```
1. User request feature
2. Claude baca REQ-XXX yang relevan
3. Claude implementasi
4. Claude update REQ-XXX:
   - Tambah di Functional Requirements
   - Update File Struktur
   - Tambah API Endpoints (jika ada)
   - Update Last Updated date
5. Claude update SRS_INDEX.md (jika perlu tambah REQ baru)
```

### Scenario 2: Fix Bug
```
1. User report bug
2. Claude cek .claude/issues/ (apakah sudah ada?)
3. Jika belum, buat ISS-XXX-nama-bug.md
4. Claude diagnosis → fix → test
5. Claude update ISS-XXX:
   - Status: Fixed
   - Fixed date
   - Solution Implemented
   - Testing Steps
6. Claude update SRS_INDEX.md (mark as Fixed)
7. Claude update REQ-XXX di Known Issues (add reference ke ISS-XXX)
```

### Scenario 3: Refactor/Update
```
1. User minta perubahan layout/struktur
2. Claude baca REQ-XXX
3. Claude implementasi
4. Claude update REQ-XXX:
   - Update di Known Issues atau Notes
   - Tandai perubahan dengan "(Updated YYYY-MM-DD)"
5. Tidak perlu buat issue file (bukan bug, hanya update)
```

---

## 🎨 Status Legend

### Requirements:
- ✅ **Implemented** — Fitur sudah ada dan berjalan
- 🚧 **In Progress** — Sedang dikerjakan
- 📝 **Planned** — Direncanakan tapi belum mulai
- ❌ **Deprecated** — Sudah tidak dipakai

### Issues:
- 🔧 **Fixed** — Bug sudah diperbaiki
- ⚠️ **Known Issue** — Bug diketahui tapi belum diperbaiki
- 📝 **Planned** — Akan dikerjakan
- ❌ **Wontfix** — Tidak akan diperbaiki (by design/low priority)

---

## 💡 Best Practices

### ✅ DO:
1. **Selalu baca SRS_INDEX dulu** sebelum mulai task
2. **Baca HANYA requirement yang relevan** (hemat token)
3. **Update dokumentasi setelah selesai** implementasi
4. **Buat issue file untuk setiap bug** yang ditemukan
5. **Link antar file** dengan format `[REQ-XXX](requirements/REQ-XXX-nama.md)`

### ❌ DON'T:
1. **Jangan baca semua REQ sekaligus** (buang token)
2. **Jangan skip update dokumentasi** setelah selesai
3. **Jangan buat REQ baru untuk minor feature** (update REQ existing)
4. **Jangan hardcode date** pakai "hari ini" / "kemarin" (pakai absolute date)

---

## 🔍 Quick Reference

### Cari Requirement by Topic:
- **Login/Auth** → REQ-001
- **Ujian/Soal** → REQ-002
- **Presensi** → REQ-003
- **Alumni** → REQ-004
- **CMS/Konten** → REQ-005
- **Deploy/Production** → REQ-006

### Cari Issue by Keyword:
```bash
# Search di folder issues/
grep -r "anti-cheat" .claude/issues/
grep -r "firewall" .claude/issues/
grep -r "cache" .claude/issues/
```

### Update Log Location:
- **Global update log** → `SRS_INDEX.md` (section Update Log)
- **Per-requirement log** → `REQ-XXX.md` (section Known Issues atau Notes)
- **Per-issue log** → `ISS-XXX.md` (section Result)

---

## 📞 Maintenance

**Owner:** User (alimka) + Claude Code  
**Review Frequency:** Setiap major update atau bug fix  
**Backup:** Git commit semua perubahan di `.claude/`

---

**Last Updated:** 2026-06-07  
**Version:** 1.0
