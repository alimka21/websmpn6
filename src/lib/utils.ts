import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRupiah(number: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number);
}

const TZ_LABEL: Record<string, string> = {
  'Asia/Jakarta':  'WIB',
  'Asia/Makassar': 'WITA',
  'Asia/Jayapura': 'WIT',
};

export function formatDate(
  date: Date | string | number,
  formatType: "short" | "long" | "time" | "datetime" = "long",
  tz?: string,
): string {
  const d    = new Date(date);
  const opts = tz ? { timeZone: tz } : {};

  if (formatType === "short") {
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", ...opts });
  }
  if (formatType === "time") {
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", ...opts });
  }
  if (formatType === "datetime") {
    const label = tz ? (TZ_LABEL[tz] || 'WIB') : 'WIB';
    return d.toLocaleString("id-ID", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", ...opts,
    }) + " " + label;
  }

  // long default
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", ...opts });
}

/**
 * Konversi UTC ISO string ke "YYYY-MM-DDTHH:mm" dalam school timezone
 * untuk value `<input type="datetime-local">`.
 */
export function toDatetimeLocalInTZ(isoString: string, tz: string = 'Asia/Jakarta'): string {
  const d       = new Date(isoString);
  const dateStr = d.toLocaleDateString('en-CA', { timeZone: tz });          // "YYYY-MM-DD"
  const timeStr = d.toLocaleTimeString('en-GB', {                            // "HH:MM:SS"
    timeZone: tz, hour12: false,
    hour: '2-digit', minute: '2-digit',
  });
  return `${dateStr}T${timeStr}`;
}
