import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore, Role } from '../store/authStore';
import { ArrowRight, ArrowLeft, Eye, EyeOff, Shield, GraduationCap, User, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSiteConfig } from '../hooks/useSiteConfig';

interface RoleOption {
  value: Role;
  label: string;
  Icon: React.ElementType;
  idLabel: string;
  idPlaceholder: string;
  idType: 'email' | 'text';
  idInputMode?: 'numeric' | 'email';
}

const ROLES: RoleOption[] = [
  {
    value: 'SUPER_ADMIN',
    label: 'Admin',
    Icon: Shield,
    idLabel: 'Alamat Email',
    idPlaceholder: 'Contoh: admin@sekolah.sch.id',
    idType: 'email',
    idInputMode: 'email',
  },
  {
    value: 'GURU',
    label: 'Guru',
    Icon: GraduationCap,
    idLabel: 'Email atau NIP',
    idPlaceholder: 'Email atau NIP (cth: 19870101…)',
    idType: 'text',
  },
  {
    value: 'SISWA',
    label: 'Siswa',
    Icon: User,
    idLabel: 'Nomor Induk Siswa (NIS)',
    idPlaceholder: 'Contoh: 20250001',
    idType: 'text',
    idInputMode: 'numeric',
  },
];

export default function LoginPage() {
  const [role, setRole] = useState<Role>('SISWA');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const navigate  = useNavigate();
  const location  = useLocation();
  const { login, isLoading } = useAuthStore();
  const cfg = useSiteConfig();
  const schoolName = cfg.namaSekolah || 'Portal Sekolah';

  const roleOpt = ROLES.find(r => r.value === role)!;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!identifier.trim() || !password.trim()) {
      setErrorMsg('Semua field wajib diisi');
      return;
    }
    if (role === 'SUPER_ADMIN' && !identifier.includes('@')) {
      setErrorMsg('Format email tidak valid');
      return;
    }

    try {
      await login(identifier, password, role);
      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else {
        const dash: Record<Role, string> = {
          SUPER_ADMIN: '/dashboard/admin',
          GURU:        '/dashboard/guru',
          SISWA:       '/dashboard/siswa',
        };
        navigate(dash[role], { replace: true });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login gagal, periksa kredensial Anda');
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen grid lg:grid-cols-2">

      {/* ── Panel branding (desktop) ── */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden hero-modern text-white p-12 xl:p-16">
        <div className="absolute inset-0 bg-grid-white pointer-events-none" />
        {cfg.heroImageUrl && (
          <img src={cfg.heroImageUrl} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-15 mix-blend-luminosity" />
        )}

        <Link to="/" className="relative flex items-center gap-3 w-fit">
          {cfg.logoUrl ? (
            <img src={cfg.logoUrl} alt={schoolName} className="w-11 h-11 rounded-xl object-contain bg-white p-1" />
          ) : (
            <span className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </span>
          )}
          <span className="text-lg font-extrabold tracking-tight">{schoolName}</span>
        </Link>

        <div className="relative max-w-lg">
          <h2 className="text-4xl xl:text-5xl font-extrabold leading-tight tracking-tight">
            Selamat datang di
            <span className="block bg-gradient-to-r from-sky-200 to-white bg-clip-text text-transparent">Portal Akademik</span>
          </h2>
          <p className="mt-5 text-white/85 text-lg leading-relaxed">
            Satu akun untuk ujian online, nilai, presensi, dan informasi sekolah.
          </p>
          <ul className="mt-8 space-y-3">
            {['Ujian online dengan pengawasan otomatis', 'Pantau nilai dan riwayat belajar', 'Presensi guru & siswa terintegrasi'].map(t => (
              <li key={t} className="flex items-center gap-3 text-sky-50">
                <CheckCircle2 className="w-5 h-5 text-sky-200 shrink-0" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/70">&copy; {new Date().getFullYear()} {schoolName}</p>
      </aside>

      {/* ── Kolom form ── */}
      <div className="flex flex-col items-center justify-center p-4 py-10 md:p-12">
      <main className="w-full max-w-[440px] flex flex-col">

        {/* ── Branding header (mobile) ── */}
        <header className="text-center mb-8 lg:hidden">
          <div className="mb-4 flex justify-center">
            {cfg.logoUrl ? (
              <img src={cfg.logoUrl} alt={schoolName} className="w-20 h-20 object-contain" />
            ) : (
              <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center">
                <GraduationCap className="w-10 h-10 text-primary" />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-primary tracking-tight">{schoolName}</h1>
          <p className="text-sm text-on-surface-variant mt-1">Portal Akademik Digital</p>
        </header>

        <div className="mb-8 hidden lg:block">
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">Masuk ke akun Anda</h1>
          <p className="text-on-surface-variant mt-2">Pilih peran, lalu masukkan data login Anda.</p>
        </div>

        {/* ── Login card ── */}
        <section className="w-full bg-white rounded-2xl shadow-[0_12px_40px_-12px_rgba(8,119,187,0.15)] border border-outline-variant/30 p-6 md:p-8 lg:shadow-none lg:border-0 lg:p-0 lg:bg-transparent">

          {/* Role selector — segmented control */}
          <div className="mb-7">
            <span className="block text-sm font-semibold text-on-surface mb-2.5">Masuk sebagai</span>
            <div className="grid grid-cols-3 gap-1 p-1 bg-surface-container rounded-xl" role="group" aria-label="Pilih peran">
              {ROLES.map(({ value, label, Icon }) => {
                const active = role === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setRole(value); setIdentifier(''); setErrorMsg(''); }}
                    disabled={isLoading}
                    aria-pressed={active}
                    className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      active
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error banner */}
          {errorMsg && (
            <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-error/20 bg-error-container/60 px-4 py-3 text-sm text-on-error-container font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">

            {/* Identifier */}
            <div className="space-y-2">
              <label htmlFor="identifier" className="text-sm font-semibold text-on-surface">
                {roleOpt.idLabel}
              </label>
              <input
                id="identifier"
                type={roleOpt.idType}
                inputMode={roleOpt.idInputMode}
                placeholder={roleOpt.idPlaceholder}
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                disabled={isLoading}
                autoComplete={role === 'SISWA' ? 'username' : role === 'GURU' ? 'username' : 'email'}
                className="w-full px-4 py-3 bg-white rounded-xl border border-outline-variant focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-base"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label htmlFor="password" className="text-sm font-semibold text-on-surface">
                  Kata Sandi
                </label>
                <button
                  type="button"
                  onClick={() => toast.info('Silakan hubungi administrator sekolah untuk reset password')}
                  className="text-sm font-semibold text-primary hover:underline decoration-2 transition-all"
                >
                  Lupa sandi?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan sandi..."
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 bg-white rounded-xl border border-outline-variant focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  disabled={isLoading}
                  aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-primary/25 hover:bg-primary-container active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk sebagai {roleOpt.label}</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Footer */}
        <footer className="mt-8 flex justify-center lg:justify-start">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-on-surface-variant font-medium hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Beranda
          </Link>
        </footer>

      </main>
      </div>
    </div>
  );
}
