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

export function formatDate(date: Date | string | number, formatType: "short" | "long" | "time" | "datetime" = "long"): string {
  const d = new Date(date);
  
  if (formatType === "short") {
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  if (formatType === "time") {
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }
  if (formatType === "datetime") {
    return d.toLocaleString("id-ID", { 
      day: "2-digit", month: "long", year: "numeric", 
      hour: "2-digit", minute: "2-digit" 
    }) + " WIB";
  }
  
  // long default
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}
