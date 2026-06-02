import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore, Role } from '../store/authStore';
import { Button } from '../components/ui/button';
import { Input, Label } from '../components/ui/input';
import {
  Eye, EyeOff, AlertTriangle, GraduationCap, Home,
  Shield, ClipboardList, BookOpen,
} from 'lucide-react';
import { useSiteConfig } from '../hooks/useSiteConfig';

interface RoleOption {
  value: Role;
  label: string;
  icon: React.ElementType;
}

const ROLE_OPTIONS: RoleOption[] = [
  { value: 'SUPER_ADMIN', label: 'Admin', icon: Shield },
  { value: 'GURU',        label: 'Guru',  icon: ClipboardList },
  { value: 'SISWA',       label: 'Siswa', icon: BookOpen },
];

const roleLabel = (role: Role) => ROLE_OPTIONS.find(r => r.value === role)?.label ?? 'Sistem';

export default function LoginPage() {
  const [role, setRole] = useState<Role>('SISWA');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();
  const siteConfig = useSiteConfig();
  const schoolName = siteConfig.namaSekolah || 'Portal Sekolah';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!identifier.trim() || !password.trim()) {
      setErrorMsg('Semua field wajib diisi');
      return;
    }

    if ((role === 'GURU' || role === 'SUPER_ADMIN') && !identifier.includes('@')) {
      setErrorMsg('Format email tidak valid');
      return;
    }

    try {
      await login(identifier, password, role);

      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else {
        const defaultDash: Record<Role, string> = {
          SUPER_ADMIN: '/dashboard/admin',
          GURU: '/dashboard/guru',
          SISWA: '/dashboard/siswa',
        };
        navigate(defaultDash[role], { replace: true });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login gagal, periksa kredensial Anda');
    }
  };

  const identifierLabel = role === 'SISWA' ? 'Nomor Induk Siswa (NIS)' : 'Alamat Email';
  const identifierPlaceholder = role === 'SISWA' ? 'Contoh: 20250001' : 'Contoh: email@sekolah.sch.id';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo + nama sekolah */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm mb-4">
            {siteConfig.logoUrl
              ? <img src={siteConfig.logoUrl} alt={schoolName} className="w-full h-full object-contain rounded-xl bg-on-primary p-1" />
              : <GraduationCap className="w-9 h-9" />}
          </div>
          <h1 className="text-headline-md text-on-surface">{schoolName}</h1>
          <p className="text-sm text-on-surface-variant mt-1">Portal Akademik Digital</p>
        </div>

        {/* Card form */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-6 sm:p-8">
          {/* Error banner */}
          {errorMsg && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-lg border border-error/20 bg-error-container px-3 py-2.5 text-sm text-error font-medium"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Role selector — 3 pill buttons */}
            <div className="space-y-2">
              <Label>Pilih Peran</Label>
              <div className="grid grid-cols-3 gap-2">
                {ROLE_OPTIONS.map(({ value, label, icon: Icon }) => {
                  const active = role === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRole(value)}
                      disabled={isLoading}
                      aria-pressed={active}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-full py-3 px-2 text-label-sm font-bold uppercase tracking-wider transition-all active:translate-y-px ${
                        active
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="pt-1 flex justify-center">
                <span className="inline-flex items-center rounded-full bg-primary-container/20 text-primary px-3 py-1 text-label-sm font-bold uppercase tracking-wider">
                  Masuk sebagai {roleLabel(role)}
                </span>
              </div>
            </div>

            {/* Identifier */}
            <div className="space-y-1.5">
              <Label htmlFor="identifier">{identifierLabel}</Label>
              <Input
                id="identifier"
                type={role === 'SISWA' ? 'text' : 'email'}
                // Soft keyboard angka di mobile untuk siswa (NIS).
                // Tetap type=text supaya leading zero NIS tidak ke-strip
                // dan tidak ada spinner number bawaan browser.
                inputMode={role === 'SISWA' ? 'numeric' : 'email'}
                pattern={role === 'SISWA' ? '[0-9]*' : undefined}
                placeholder={identifierPlaceholder}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={isLoading}
                autoComplete={role === 'SISWA' ? 'username' : 'email'}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Kata Sandi</Label>
                <button
                  type="button"
                  onClick={() => toast.info('Silakan hubungi administrator sekolah untuk reset password')}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Lupa sandi?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan sandi..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary"
                  disabled={isLoading}
                  aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              size="lg"
              className="w-full text-white"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                  <span>Memproses...</span>
                </div>
              ) : (
                `Masuk sebagai ${roleLabel(role)}`
              )}
            </Button>
          </form>
        </div>

        {/* Link kembali ke beranda */}
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
          >
            <Home className="w-4 h-4" />
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
