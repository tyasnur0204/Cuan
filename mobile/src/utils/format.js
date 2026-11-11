export const formatCurrency = (value) => {
  const num = Number(value ?? 0);
  const abs = Math.round(Math.abs(num));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${num < 0 ? '-Rp ' : 'Rp '}${formatted}`;
};

export const formatCompactCurrency = (value) => {
  const num = Number(value ?? 0);
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp ${(abs / 1_000_000).toFixed(1)}jt`;
  }
  if (abs >= 1_000) {
    return `${sign}Rp ${Math.round(abs / 1_000)}rb`;
  }
  return formatCurrency(num);
};

export const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const getTodayISO = () => new Date().toISOString().slice(0, 10);

export const extractApiError = (err, fallback = 'Terjadi kesalahan') => {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => `${Array.isArray(d.loc) ? d.loc.join('.') : 'field'}: ${d.msg}`)
      .join(', ');
  }
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  return err?.message || fallback;
};
