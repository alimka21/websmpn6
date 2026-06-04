/**
 * Convert string to Title Case (capitalize first letter of each word)
 * Contoh: "budi santoso" → "Budi Santoso"
 */
export const toTitleCase = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const formatDate = (d: Date | string | number | null | undefined): string => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

export const formatDateTime = (d: Date | string | number | null | undefined): string => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  const dateParts = date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const timeParts = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${dateParts}, ${timeParts}`;
};

export const formatDuration = (menit: number | null | undefined): string => {
  if (menit == null || isNaN(menit)) return '-';
  const jam = Math.floor(menit / 60);
  const sisaMenit = menit % 60;
  
  if (jam > 0 && sisaMenit > 0) {
    return `${jam} jam ${sisaMenit} menit`;
  } else if (jam > 0) {
    return `${jam} jam`;
  } else {
    return `${sisaMenit} menit`;
  }
};

export const formatNilai = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return 'N/A';
  return n.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};
