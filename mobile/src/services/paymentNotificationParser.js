export const MONITORED_APPS = [
  {
    key: 'spay',
    name: 'ShopeePay / Shopee',
    shortName: 'ShopeePay',
    packages: ['com.shopeepay.id', 'com.shopee.id'],
    badgeBg: '#FFF1EC',
    badgeColor: '#EE4D2D',
    iconName: 'bag-handle-outline',
    defaultCategoryExpense: 'Belanja & Pembayaran',
    defaultCategoryIncome: 'Pemasukan ShopeePay',
    sampleExpense: {
      title: 'Pembayaran ShopeePay Berhasil',
      text: 'Kamu berhasil membayar Rp48.500 di Kopi Kenangan menggunakan ShopeePay. Sisa saldo Rp215.000.',
    },
    sampleIncome: {
      title: 'Dana Masuk ShopeePay',
      text: 'Kamu menerima dana masuk Rp125.000 dari Transfer Bank ke saldo ShopeePay.',
    },
  },
  {
    key: 'seabank',
    name: 'SeaBank Indonesia',
    shortName: 'SeaBank',
    packages: ['id.co.bankbkemobile.digitalbank'],
    badgeBg: '#FFF4EB',
    badgeColor: '#F36F21',
    iconName: 'business-outline',
    defaultCategoryExpense: 'Transfer & Pembayaran',
    defaultCategoryIncome: 'Dana Masuk Bank',
    sampleExpense: {
      title: 'Pembayaran QRIS Berhasil',
      text: 'Pembayaran QRIS sebesar Rp32.000 di Warung Nusantara berhasil menggunakan SeaBank.',
    },
    sampleIncome: {
      title: 'Transfer Masuk',
      text: 'Kamu menerima transfer dana masuk sebesar Rp1.500.000 dari PT Karya Mandiri.',
    },
  },
  {
    key: 'dana',
    name: 'DANA',
    shortName: 'DANA',
    packages: ['id.dana'],
    badgeBg: '#EFF6FF',
    badgeColor: '#118EEA',
    iconName: 'wallet-outline',
    defaultCategoryExpense: 'Belanja & Pembayaran',
    defaultCategoryIncome: 'Pemasukan DANA',
    sampleExpense: {
      title: 'Pembayaran Berhasil',
      text: 'Kamu baru saja membayar Rp27.000 di Alfamart menggunakan Saldo DANA.',
    },
    sampleIncome: {
      title: 'Saldo DANA Bertambah',
      text: 'Yeay! Kamu menerima kiriman uang Rp250.000 dari Budi Santoso.',
    },
  },
  {
    key: 'gopay',
    name: 'GoPay / Gojek',
    shortName: 'GoPay',
    packages: ['com.gojek.gopay', 'com.gojek.app'],
    badgeBg: '#ECFEFF',
    badgeColor: '#00AED6',
    iconName: 'bicycle-outline',
    defaultCategoryExpense: 'Makan & Minum',
    defaultCategoryIncome: 'Pemasukan GoPay',
    sampleExpense: {
      title: 'Pembayaran GoPay Berhasil',
      text: 'Pembayaran GoFood sebesar Rp64.000 menggunakan GoPay berhasil. Sisa saldo Rp180.000.',
    },
    sampleIncome: {
      title: 'Top Up GoPay Berhasil',
      text: 'Top up GoPay sebesar Rp300.000 melalui Virtual Account BCA berhasil.',
    },
  },
  {
    key: 'brimo',
    name: 'BRImo BRI',
    shortName: 'BRImo',
    packages: ['id.co.bri.brimo'],
    badgeBg: '#EFF4FF',
    badgeColor: '#00529C',
    iconName: 'card-outline',
    defaultCategoryExpense: 'Transfer & Pembayaran',
    defaultCategoryIncome: 'Dana Masuk Bank',
    sampleExpense: {
      title: 'Transaksi BRImo Berhasil',
      text: 'Pembayaran BRIVA sebesar Rp215.000 berhasil diproses dari rekening BRI Anda.',
    },
    sampleIncome: {
      title: 'Mutasi Kredit BRI',
      text: 'Rekening Anda dikredit sebesar Rp850.000 dari transfer masuk QRIS Merchant.',
    },
  },
];

export const ALL_MONITORED_PACKAGES = MONITORED_APPS.flatMap((a) => a.packages);

export const findMonitoredAppByPackage = (packageName) => {
  const pkg = String(packageName || '').trim().toLowerCase();
  if (!pkg) return null;
  return (
    MONITORED_APPS.find((app) =>
      app.packages.some((p) => p.toLowerCase() === pkg)
    ) || null
  );
};

export const findMonitoredAppByKey = (appKey) => {
  return MONITORED_APPS.find((app) => app.key === appKey) || null;
};

const BLOCKED_PROMO_AND_OTP_KEYWORDS = [
  'promo',
  'diskon',
  'cashback',
  'voucher',
  'klaim voucher',
  'gratis ongkir',
  'flash sale',
  'keranjang',
  'sedang dikemas',
  'sedang dikirim',
  'menuju alamat',
  'kode otp',
  'kode verifikasi',
  'jangan beritahu',
  'rahasia',
  'mpin',
  'menunggu pembayaran',
  'belum dibayar',
  'jatuh tempo',
  'segera bayar',
  'yuk bayar',
  's.d rp',
  's/d rp',
  'hingga rp',
  'koin shopee',
  'ajukan sekarang',
  'limit pinjaman',
  'cicilan',
  'dana cicil',
  'undian',
  'menangkan',
];

const CONFIRMATION_KEYWORDS = [
  'berhasil',
  'sukses',
  'selesai',
  'telah masuk',
  'dana masuk',
  'transfer masuk',
  'saldo bertambah',
  'baru saja membayar',
  'telah membayar',
  'berhasil membayar',
  'terbayar',
  'dikredit',
  'didebet',
  'telah mentransfer',
  'pembayaran qris',
  'pembayaran briva',
  'pembayaran gopay',
  'pembayaran shopeepay',
  'kiriman uang',
  'mutasi kredit',
  'mutasi debit',
];

const INCOME_KEYWORDS = [
  'dana masuk',
  'transfer masuk',
  'uang masuk',
  'saldo bertambah',
  'bertambah rp',
  'menerima dana',
  'menerima transfer',
  'menerima kiriman',
  'kiriman uang',
  'kamu menerima',
  'anda menerima',
  'dikredit',
  'mutasi kredit',
  'bunga tabungan',
  'pencairan dana',
  'pembayaran diterima',
  'dana diterima',
  'top up diterima',
];

const EXPENSE_KEYWORDS = [
  'pembayaran berhasil',
  'berhasil membayar',
  'baru saja membayar',
  'telah membayar',
  'kamu membayar',
  'kamu bayar',
  'membayar',
  'bayar ',
  'transfer berhasil',
  'transfer ke',
  'telah mentransfer',
  'kirim uang',
  'transfer keluar',
  'pembelian',
  'tarik tunai',
  'penarikan',
  'didebet',
  'mutasi debit',
  'briva',
  'tagihan terbayar',
];

const BALANCE_BEFORE_REGEX =
  /(?:sisa\s+saldo|saldo\s+anda|saldo\s+akhir|saldo\s+saat\s+ini|total\s+saldo|saldo\s+sekarang|saldo\s+tersedia|cashback|hemat|potongan|diskon|hingga|maksimal|s\.?d\.?)\s*(?:[a-z\s]{0,16})$/i;

export const parseFormattedRupiah = (rawDigits) => {
  const token = String(rawDigits || '').trim();
  if (!token) return NaN;

  let normalized = token
    .replace(/[^\d.,]/g, '')
    .replace(/^[.,]+|[.,]+$/g, '');
  if (!normalized) return NaN;

  // Format: 1.250.000,50 or 50.000,00 (ID decimal comma)
  if (/\.\d{3}/.test(normalized) && /,\d{1,2}$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (/,\d{3}/.test(normalized) && /\.\d{1,2}$/.test(normalized)) {
    // Format: 1,250,000.50 (US decimal dot)
    normalized = normalized.replace(/,/g, '');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    // Format: 50.000 or 1.500.000
    normalized = normalized.replace(/\./g, '');
  } else if (/^\d{1,3}(,\d{3})+$/.test(normalized)) {
    // Format: 50,000 or 1,500,000
    normalized = normalized.replace(/,/g, '');
  } else if (/,\d{1,2}$/.test(normalized) && !normalized.includes('.')) {
    normalized = normalized.replace(',', '.');
  } else {
    normalized = normalized.replace(/[.,]/g, '');
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000_000_000) {
    return NaN;
  }
  return Math.round(parsed * 100) / 100;
};

export const extractTransactionAmount = (text) => {
  const source = String(text || '');
  const regex = /(?:rp\.?|idr)\s*(\d+(?:[.,]\d+)*)/gi;
  const candidates = [];
  let match = regex.exec(source);
  while (match !== null) {
    const amount = parseFormattedRupiah(match[1]);
    if (Number.isFinite(amount) && amount >= 100) {
      const before = source.slice(Math.max(0, match.index - 40), match.index);
      const isBalanceOrPromo = BALANCE_BEFORE_REGEX.test(before);
      candidates.push({ amount, isBalanceOrPromo, index: match.index });
    }
    match = regex.exec(source);
  }

  const preferred = candidates.find((c) => !c.isBalanceOrPromo);
  if (preferred) return preferred.amount;
  return candidates.length > 0 ? candidates[0].amount : NaN;
};

export const inferCategoryFromText = (appKey, txType, combinedLower) => {
  if (txType === 'Income') {
    if (
      combinedLower.includes('qris') ||
      combinedLower.includes('pembeli') ||
      combinedLower.includes('merchant') ||
      combinedLower.includes('penjualan')
    ) {
      return 'Pemasukan Usaha';
    }
    if (combinedLower.includes('gaji') || combinedLower.includes('payroll')) {
      return 'Gaji';
    }
    if (combinedLower.includes('bunga')) {
      return 'Bunga & Imbal Hasil';
    }
    const appInfo = findMonitoredAppByKey(appKey);
    return appInfo?.defaultCategoryIncome || 'Pemasukan Lainnya';
  }

  if (
    /gofood|shopeefood|grabfood|kopi|kenangan|starbucks|resto|warung|makan|cafe|alfamart|indomaret|supermarket/i.test(
      combinedLower
    )
  ) {
    return 'Makan & Minum';
  }
  if (
    /goride|gocar|grab|transport|parkir|tol|pertamina|bensin|bbm|kereta|kai|mrt|transjakarta/i.test(
      combinedLower
    )
  ) {
    return 'Transport';
  }
  if (
    /pln|listrik|pdam|wifi|internet|telkom|indihome|pulsa|paket data|bpjs|tagihan/i.test(
      combinedLower
    )
  ) {
    return 'Tagihan & Utilitas';
  }
  if (/netflix|spotify|bioskop|xxi|game|hiburan/i.test(combinedLower)) {
    return 'Hiburan';
  }
  if (/transfer|kirim uang|sesama bank|antar bank/i.test(combinedLower)) {
    return 'Transfer & Pembayaran';
  }
  return 'Belanja & Pembayaran';
};

export const parsePaymentNotification = ({
  packageName,
  title = '',
  text = '',
  bigText = '',
  postTime = Date.now(),
}) => {
  const appInfo = findMonitoredAppByPackage(packageName);
  if (!appInfo) return null;

  const cleanTitle = String(title || '').trim();
  const body = String(bigText || text || '').trim();
  const combined = `${cleanTitle} ${body}`.replace(/\s+/g, ' ').trim();
  if (!combined) return null;

  const lower = combined.toLowerCase();

  // 1. Tolak keras promo, OTP, pengingat jatuh tempo, dan status kurir
  if (BLOCKED_PROMO_AND_OTP_KEYWORDS.some((kw) => lower.includes(kw))) {
    return null;
  }

  // 2. Harus punya indikasi transaksi nyata selesai / dana bergerak
  const hasConfirmation = CONFIRMATION_KEYWORDS.some((kw) =>
    lower.includes(kw)
  );
  if (!hasConfirmation) {
    return null;
  }

  // 3. Ekstrak nominal (abaikan 'sisa saldo Rp...')
  const amount = extractTransactionAmount(combined);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  // 4. Tentukan arah Pemasukan vs Pengeluaran
  const isBankApp = appInfo.key === 'seabank' || appInfo.key === 'brimo';
  const isTopUpText =
    lower.includes('top up') ||
    lower.includes('topup') ||
    lower.includes('isi saldo');

  let txType = null;
  if (INCOME_KEYWORDS.some((kw) => lower.includes(kw))) {
    txType = 'Income';
  } else if (EXPENSE_KEYWORDS.some((kw) => lower.includes(kw))) {
    txType = 'Expense';
  } else if (isTopUpText) {
    // Top up ke e-wallet masuk sebagai saldo e-wallet; di bank top up e-wallet adalah keluar
    txType = isBankApp ? 'Expense' : 'Income';
  }

  // Kasus khusus: di app bank, 'top up gopay/dana/ovo/shopeepay' selalu uang keluar dari bank
  if (
    isBankApp &&
    isTopUpText &&
    /(gopay|dana|ovo|shopeepay|linkaja|e-wallet)/i.test(lower)
  ) {
    txType = 'Expense';
  }

  if (!txType) {
    txType = 'Expense';
  }

  const category = inferCategoryFromText(appInfo.key, txType, lower);

  const d = new Date(Number(postTime) || Date.now());
  const transactionDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`;

  const cleanSnippet = body || cleanTitle;
  const truncatedSnippet =
    cleanSnippet.length > 140
      ? `${cleanSnippet.slice(0, 137)}...`
      : cleanSnippet;

  return {
    appKey: appInfo.key,
    appName: appInfo.shortName,
    packageName,
    type: txType,
    amount,
    category,
    transactionDate,
    notes: `[Auto ${appInfo.shortName}] ${truncatedSnippet}`,
    rawTitle: cleanTitle,
    rawText: cleanSnippet,
    postTime: Number(postTime) || Date.now(),
  };
};
