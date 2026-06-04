import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuthStore } from './store/authStore';
import ProtectedRoute from './components/ProtectedRoute';
import { getSiteConfig } from './hooks/useSiteConfig';

// Critical-path pages (eager) — biar landing & login tampil tanpa Suspense delay
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/layout/DashboardLayout';

// Page lain di-lazy supaya tidak ikut bundle utama
const BeritaList = lazy(() => import('./pages/BeritaList'));
const BeritaDetail = lazy(() => import('./pages/BeritaDetail'));
// ALUMNI_HIDDEN: const AlumniRegister = lazy(() => import('./pages/AlumniRegister'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Admin
const AdminDashboard = lazy(() => import('./pages/dashboard/AdminDashboard'));
const AdminUjianList = lazy(() => import('./pages/dashboard/AdminUjianList'));
// ALUMNI_HIDDEN: const AlumniTracer = lazy(() => import('./pages/dashboard/AlumniTracer'));
const CmsManage = lazy(() => import('./pages/dashboard/CmsManage'));
const ManageUsers = lazy(() => import('./pages/dashboard/ManageUsers'));
const SiteSettings = lazy(() => import('./pages/dashboard/SiteSettings'));
const StatsAdmin    = lazy(() => import('./pages/dashboard/StatsAdmin'));
const ActivityLog   = lazy(() => import('./pages/dashboard/ActivityLog'));
const PresensiAdmin = lazy(() => import('./pages/dashboard/PresensiAdmin'));
const DokumenAgendaAdmin = lazy(() => import('./pages/dashboard/DokumenAgendaAdmin'));
const DokumenPublik = lazy(() => import('./pages/DokumenPublik'));
const PresensiGuruKiosk = lazy(() => import('./pages/PresensiGuruKiosk'));
const PresensiSiswaKiosk = lazy(() => import('./pages/PresensiSiswaKiosk'));

// Guru
const GuruDashboard = lazy(() => import('./pages/dashboard/guru/GuruDashboard'));
const BuatUjian = lazy(() => import('./pages/dashboard/guru/BuatUjian'));
const KelolaSoal = lazy(() => import('./pages/dashboard/guru/KelolaSoal'));
const KoreksiUraian = lazy(() => import('./pages/dashboard/guru/KoreksiUraian'));
const DaftarUjian = lazy(() => import('./pages/dashboard/guru/DaftarUjian'));
const Students = lazy(() => import('./pages/dashboard/Students'));
const Attendance = lazy(() => import('./pages/dashboard/Attendance'));
const RekapNilai = lazy(() => import('./pages/dashboard/guru/RekapNilai'));

// Siswa
const SiswaDashboard = lazy(() => import('./pages/dashboard/SiswaDashboard'));
const ExamList = lazy(() => import('./pages/dashboard/ExamList'));
const RiwayatNilaiSiswa = lazy(() => import('./pages/dashboard/RiwayatNilaiSiswa'));
const HasilUjian = lazy(() => import('./pages/dashboard/siswa/HasilUjian'));
const RiwayatNilaiMapel = lazy(() => import('./pages/dashboard/siswa/RiwayatNilai'));
const TakeExam = lazy(() => import('./pages/exam/TakeExam'));

// Suspense fallback global
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface-container-low">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function App() {
  const { fetchMe, token } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe, token]);

  // Set document.title + favicon dari SiteConfig (shared cache).
  // getSiteConfig() de-dupe — request hanya 1x walau dipanggil dari
  // banyak komponen (App, DashboardLayout, SiteFooter, LandingPage, dst).
  useEffect(() => {
    getSiteConfig().then((cfg) => {
      if (cfg?.namaSekolah) document.title = cfg.namaSekolah;
      if (cfg?.faviconUrl) {
        let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = cfg.faviconUrl;
      }
    }).catch(() => { /* biarkan default */ });
  }, []);

  return (
    <Router>
      <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/berita" element={<BeritaList />} />
          <Route path="/berita/:slug" element={<BeritaDetail />} />
          <Route path="/dokumen" element={<DokumenPublik />} />
          <Route path="/presensi/guru" element={<PresensiGuruKiosk />} />
          <Route path="/presensi/siswa" element={<PresensiSiswaKiosk />} />
          {/* ALUMNI_HIDDEN: <Route path="/alumni/daftar" element={<AlumniRegister />} /> */}

          {/* Public route but redirect if logged in */}
          <Route path="/login" element={<LoginPage />} />

          {/* SISWA: Fullscreen Exam Route (No Dashboard Layout) */}
          <Route
            path="/exam/:sessionId"
            element={
              <ProtectedRoute allowedRoles={['SISWA']}>
                <TakeExam />
              </ProtectedRoute>
            }
          />

          {/* Dashboard Routes with Layout */}
          <Route path="/dashboard" element={<DashboardLayout />}>

            {/* Default dashboard redirect based on role is handled in ProtectedRoute, but we can do a base level redirect too */}
            <Route index element={<Navigate to="/dashboard/siswa" replace />} />

            {/* ADMIN ROUTES */}
            <Route path="admin">
              <Route index element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="users" element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <ManageUsers />
                </ProtectedRoute>
              } />
              <Route path="ujian" element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <AdminUjianList />
                </ProtectedRoute>
              } />
              {/* ALUMNI_HIDDEN:
              <Route path="alumni" element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <AlumniTracer />
                </ProtectedRoute>
              } />
              */}
              <Route path="presensi" element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <PresensiAdmin />
                </ProtectedRoute>
              } />
              <Route path="konten" element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <DokumenAgendaAdmin />
                </ProtectedRoute>
              } />
              <Route path="cms" element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <CmsManage />
                </ProtectedRoute>
              } />
              <Route path="site" element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <SiteSettings />
                </ProtectedRoute>
              } />
              <Route path="stats" element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <StatsAdmin />
                </ProtectedRoute>
              } />
              <Route path="activity" element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <ActivityLog />
                </ProtectedRoute>
              } />
            </Route>

            {/* GURU ROUTES (ujian/soal/rekap juga dibuka untuk SUPER_ADMIN) */}
            <Route path="guru">
              <Route index element={
                <ProtectedRoute allowedRoles={['GURU']}>
                  <GuruDashboard />
                </ProtectedRoute>
              } />
              <Route path="ujian" element={
                <ProtectedRoute allowedRoles={['GURU', 'SUPER_ADMIN']}>
                  <DaftarUjian />
                </ProtectedRoute>
              } />
              <Route path="ujian/baru" element={
                <ProtectedRoute allowedRoles={['GURU', 'SUPER_ADMIN']}>
                  <BuatUjian />
                </ProtectedRoute>
              } />
              <Route path="ujian/:id/soal" element={
                <ProtectedRoute allowedRoles={['GURU', 'SUPER_ADMIN']}>
                  <KelolaSoal />
                </ProtectedRoute>
              } />
              <Route path="ujian/:id/koreksi" element={
                <ProtectedRoute allowedRoles={['GURU', 'SUPER_ADMIN']}>
                  <KoreksiUraian />
                </ProtectedRoute>
              } />
              <Route path="siswa" element={
                <ProtectedRoute allowedRoles={['GURU']}>
                  <Students />
                </ProtectedRoute>
              } />
              <Route path="presensi" element={
                <ProtectedRoute allowedRoles={['GURU']}>
                  <Attendance />
                </ProtectedRoute>
              } />
              <Route path="rekap" element={
                <ProtectedRoute allowedRoles={['GURU', 'SUPER_ADMIN']}>
                  <RekapNilai />
                </ProtectedRoute>
              } />
            </Route>

            {/* SISWA ROUTES */}
            <Route path="siswa">
              <Route index element={
                <ProtectedRoute allowedRoles={['SISWA']}>
                  <SiswaDashboard />
                </ProtectedRoute>
              } />
              <Route path="ujian" element={
                <ProtectedRoute allowedRoles={['SISWA']}>
                  <ExamList />
                </ProtectedRoute>
              } />
              <Route path="riwayat" element={
                <ProtectedRoute allowedRoles={['SISWA']}>
                  <RiwayatNilaiSiswa />
                </ProtectedRoute>
              } />
              <Route path="hasil/:sessionId" element={
                <ProtectedRoute allowedRoles={['SISWA']}>
                  <HasilUjian />
                </ProtectedRoute>
              } />
              <Route path="riwayat-nilai" element={
                <ProtectedRoute allowedRoles={['SISWA']}>
                  <RiwayatNilaiMapel />
                </ProtectedRoute>
              } />
            </Route>

          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
      <Toaster
        position="top-center"
        expand={false}
        richColors={false}
        closeButton={true}
        duration={3500}
        gap={8}
        toastOptions={{
          classNames: {
            toast: `
              bg-surface-container-lowest
              border border-outline-variant
              shadow-[0_4px_24px_rgba(0,0,0,0.08)]
              rounded-xl
              px-4 py-3
              font-sans
              min-w-[320px]
              max-w-[420px]
            `,
            title:       'text-on-surface font-semibold text-sm leading-snug',
            description: 'text-on-surface-variant text-xs mt-0.5 leading-relaxed',
            closeButton: `
              bg-surface-container
              border border-outline-variant
              text-on-surface-variant
              hover:bg-surface-container-high
              rounded-lg
            `,
            success: 'border-l-4 border-secondary',
            error:   'border-l-4 border-error',
            warning: 'border-l-4 border-[#BA7517]',
            info:    'border-l-4 border-primary',
          },
        }}
      />
    </Router>
  );
}
