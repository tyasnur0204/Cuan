export const formatCurrency = (value) => {
  const raw = Number(value ?? 0);
  const num = Number.isFinite(raw) ? raw : 0;
  const abs = Math.round(Math.abs(num));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${num < 0 ? '-Rp ' : 'Rp '}${formatted}`;
};

export const formatCompactCurrency = (value) => {
  const raw = Number(value ?? 0);
  const num = Number.isFinite(raw) ? raw : 0;
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

export const parseNominalInput = (value) => {
  const raw = String(value ?? '').replace(/rp/gi, '').replace(/\s+/g, '').trim();
  if (!raw) return NaN;
  // Format ribuan Indonesia: 50.000 atau 1.250.000
  if (/^-?\d{1,3}(\.\d{3})+$/.test(raw)) {
    return Number(raw.replace(/\./g, ''));
  }
  // Format ribuan koma: 50,000 atau 1,250,000
  if (/^-?\d{1,3}(,\d{3})+$/.test(raw)) {
    return Number(raw.replace(/,/g, ''));
  }
  return Number(raw.replace(/,/g, '.'));
};

export const parsePercentInput = (value) => {
  const raw = String(value ?? '').replace(/%/g, '').trim();
  if (!raw) return NaN;
  return Number(raw.replace(/,/g, '.'));
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

export const getTodayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

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
  if (
    err?.code === 'ECONNABORTED' ||
    String(err?.message || '').toLowerCase().includes('timeout')
  ) {
    return 'Koneksi ke server melebihi batas waktu. Coba muat ulang beberapa saat lagi.';
  }
  if (err?.message === 'Network Error' || !err?.response) {
    return 'Tidak dapat terhubung ke server CUAN. Pastikan internet aktif atau cek Pengaturan Server API.';
  }
  return err?.message || fallback;
};
