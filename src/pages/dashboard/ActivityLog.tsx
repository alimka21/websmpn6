import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity, GraduationCap, Users, RefreshCw,
  BookOpen, ClipboardCheck, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { ErrorState } from '../../components/ui/ErrorState';

type ActivityType = 'ujian_selesai' | 'ujian_baru' | 'presensi_guru';
type ActorRole = 'siswa' | 'guru';

interface ActivityItem {
  id: string;
  type: ActivityType;
  timestamp: string;
  actor: string;
  actorRole: ActorRole;
  description: string;
  meta?: string;
}

const TYPE_CONFIG: Record<ActivityType, {
  icon: React.ElementType;
  iconBg: string;
  iconText: string;
  label: string;
}> = {
  ujian_selesai: {
    icon: ClipboardCheck,
    iconBg: 'bg-primary/10',
    iconText: 'text-primary',
    label: 'Ujian Selesai',
  },
  ujian_baru: {
    icon: BookOpen,
    iconBg: 'bg-tertiary-fixed',
    iconText: 'text-on-tertiary-fixed',
    label: 'Ujian Baru',
  },
  presensi_guru: {
    icon: ClipboardCheck,
    iconBg: 'bg-secondary-container/40',
    iconText: 'text-on-secondary-container',
    label: 'Presensi',
  },
};

const ROLE_CONFIG: Record<ActorRole, { icon: React.ElementType; label: string; badge: string }> = {
  siswa: { icon: Users, label: 'Siswa', badge: 'bg-primary/10 text-primary' },
  guru:  { icon: GraduationCap, label: 'Guru', badge: 'bg-tertiary-fixed text-on-tertiary-fixed' },
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1)  return 'baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7)     return `${days} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ActivityLog() {
  const [items, setItems]       = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filter, setFilter]     = useState<'ALL' | ActivityType | ActorRole>('ALL');

  const fetchActivity = useCallback(async (silent = false) => {
    try {
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMsg(null);
      const res = await api.get('/api/admin/activity?limit=50');
      setItems(Array.isArray(res) ? res : []);
      if (silent) toast.success('Log aktivitas diperbarui');
    } catch (err: any) {
      const msg = err?.message || 'Gagal memuat log aktivitas';
      setErrorMsg(msg);
      if (!silent) toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const filtered = items.filter(item => {
    if (filter === 'ALL')    return true;
    if (filter === 'siswa' || filter === 'guru') return item.actorRole === filter;
    return item.type === filter;
  });

  const FILTER_OPTIONS: { label: string; value: typeof filter }[] = [
    { label: 'Semua',          value: 'ALL' },
    { label: 'Aktivitas Siswa', value: 'siswa' },
    { label: 'Aktivitas Guru',  value: 'guru' },
    { label: 'Ujian Selesai',  value: 'ujian_selesai' },
    { label: 'Ujian Dibuat',   value: 'ujian_baru' },
    { label: 'Presensi',       value: 'presensi_guru' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Log Aktivitas
          </h1>
          <p className="text-on-surface-variant mt-1">
            Aktivitas terbaru guru dan siswa di seluruh sistem.
          </p>
        </div>
        <button
          onClick={() => fetchActivity(true)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:text-primary hover:border-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Perbarui
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex p-1.5 bg-surface-container rounded-2xl w-fit flex-wrap gap-1">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filter === opt.value
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-on-surface-variant">Memuat log aktivitas...</p>
        </div>
      ) : errorMsg ? (
        <ErrorState message={errorMsg} onRetry={() => fetchActivity()} />
      ) : filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
          <div className="py-16 text-center space-y-2">
            <AlertCircle className="w-10 h-10 text-outline mx-auto" />
            <p className="text-on-surface font-medium">Belum ada aktivitas</p>
            <p className="text-sm text-on-surface-variant">Belum ada data untuk filter yang dipilih.</p>
          </div>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
          {/* Stats summary */}
          <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-on-surface-variant">
              Menampilkan <span className="font-semibold text-on-surface">{filtered.length}</span> aktivitas
            </p>
            <div className="flex items-center gap-4 text-xs text-on-surface-variant">
              {(['siswa', 'guru'] as ActorRole[]).map(role => {
                const cnt = filtered.filter(i => i.actorRole === role).length;
                const rc = ROLE_CONFIG[role];
                return (
                  <span key={role} className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${rc.badge}`}>
                      <rc.icon className="w-3 h-3" />
                      {rc.label}
                    </span>
                    <span className="font-semibold text-on-surface">{cnt}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* List */}
          <div className="divide-y divide-outline-variant/40">
            {filtered.map(item => {
              const tc = TYPE_CONFIG[item.type];
              const rc = ROLE_CONFIG[item.actorRole];
              return (
                <div key={item.id} className="px-6 py-4 flex items-start gap-4 hover:bg-surface-container-low/50 transition-colors group">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tc.iconBg}`}>
                    <tc.icon className={`w-5 h-5 ${tc.iconText}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-on-surface text-sm">{item.actor}</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${rc.badge}`}>
                        <rc.icon className="w-2.5 h-2.5" />
                        {rc.label}
                      </span>
                    </div>
                    <p className="text-sm text-on-surface-variant leading-snug">{item.description}</p>
                    {item.meta && (
                      <span className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant/40">
                        {item.meta}
                      </span>
                    )}
                  </div>

                  {/* Time */}
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium text-on-surface-variant">
                      {formatRelativeTime(item.timestamp)}
                    </p>
                    <p className="text-[10px] text-outline mt-0.5 hidden group-hover:block">
                      {formatDateTime(item.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
