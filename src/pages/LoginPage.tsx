import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore, Role } from '../store/authStore';
import { ArrowRight, Eye, EyeOff, Shield, GraduationCap, User, Home, Loader2 } from 'lucide-react';
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
    <div className="bg-background text-on-background min-h-screen flex flex-col items-center justify-center p-4 md:p-20">
      <main className="w-full max-w-[480px] flex flex-col items-center">

        {/* ── Branding header ── */}
        <header className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            {cfg.logoUrl ? (
              <img
                src={cfg.logoUrl}
                alt={schoolName}
                className="w-24 h-24 object-contain"
              />
            ) : (
              <div className="w-24 h-24 bg-primary/10 rounded-2xl flex items-center justify-center">
                <GraduationCap className="w-12 h-12 text-primary" />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">{schoolName}</h1>
          <p className="text-base text-on-surface-variant opacity-80 mt-1">Portal Akademik Digital</p>
        </header>

        {/* ── Login card ── */}
        <section className="w-full bg-surface-container-lowest rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-outline-variant/30 p-8 md:p-10">

          {/* Role selector */}
          <div className="mb-8">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-[0.1em] mb-4 text-center">
              Pilih Peran
            </label>
            <div className="grid grid-cols-3 gap-3">
              {ROLES.map(({ value, label, Icon }) => {
                const active = role === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setRole(value); setIdentifier(''); setErrorMsg(''); }}
                    disabled={isLoading}
                    aria-pressed={active}
                    className={`flex flex-col items-center justify-center py-4 px-2 rounded-lg border transition-all duration-200 ${
                      active
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-primary/50'
                    }`}
                  >
                    <Icon className="w-6 h-6 mb-2" />
                    <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error banner */}
          {errorMsg && (
            <div role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-error/20 bg-error-container px-3 py-2.5 text-sm text-error font-medium">
              <span className="shrink-0 mt-0.5">⚠</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">

            {/* Identifier */}
            <div className="space-y-2">
              <label htmlFor="identifier" className="text-sm font-medium text-on-surface-variant">
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
                autoComplete={role === 'SISWA' ? 'username' : 'email'}
                className="w-full px-4 py-3 bg-surface rounded-lg border border-outline-variant focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-base"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label htmlFor="password" className="text-sm font-medium text-on-surface-variant">
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
                  className="w-full px-4 py-3 pr-12 bg-surface rounded-lg border border-outline-variant focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-base"
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
                className="w-full bg-primary text-white font-semibold py-4 rounded-lg shadow-sm hover:bg-primary-container active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
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
        <footer className="mt-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-primary font-medium hover:opacity-80 transition-opacity"
          >
            <Home className="w-5 h-5" />
            Kembali ke Beranda
          </Link>
        </footer>

      </main>
    </div>
  );
}
