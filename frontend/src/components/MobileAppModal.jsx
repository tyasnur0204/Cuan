import { useEffect, useState } from 'react';
import FinMateLogo from './FinMateLogo';
import {
  APK_DOWNLOAD_URL,
  APK_PROXY_DOWNLOAD_URL,
  APK_RELEASE_PAGE_URL,
  APP_VERSION_LABEL,
  fetchApkReleaseInfo,
  subscribePwaInstall,
  triggerPwaInstall,
} from '../utils/appDownload';

const MobileAppModal = ({ open, onClose }) => {
  const [pwaState, setPwaState] = useState({
    canInstallPwa: false,
    isInstalled: false,
    isIos: false,
    isAndroid: false,
  });
  const [installFeedback, setInstallFeedback] = useState('');
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState(null);

  useEffect(() => {
    return subscribePwaInstall(setPwaState);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    fetchApkReleaseInfo().then((info) => {
      if (active && info) setReleaseInfo(info);
    });
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      active = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const apkFilename = releaseInfo?.filename || 'CUAN.apk';
  const apkSizeLabel = releaseInfo?.size_mb ? `${releaseInfo.size_mb} MB` : null;
  const apkVersionLabel = releaseInfo?.version
    ? `v${releaseInfo.version} · Android APK`
    : APP_VERSION_LABEL;

  const handlePwaInstall = async () => {
    const res = await triggerPwaInstall();
    if (res?.outcome === 'accepted') {
      setInstallFeedback('CUAN berhasil ditambahkan ke layar utama!');
    } else if (res?.outcome === 'unavailable') {
      setInstallFeedback(
        'Gunakan menu browser (Bagikan / ⋮) lalu pilih Tambah ke Layar Utama.'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cuan-mobile-modal-title"
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-gray-100 p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <FinMateLogo className="w-11 h-11" variant="solid" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="cuan-mobile-modal-title"
                  className="text-base font-bold text-navy leading-tight"
                >
                  Aplikasi Mobile CUAN
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald/10 text-emerald">
                  {apkVersionLabel}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Catat Uang, Aset Naik — lebih praktis langsung dari layar HP
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal download aplikasi"
            className="p-1.5 rounded-lg text-gray-400 hover:text-navy hover:bg-bg-light transition-colors shrink-0"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Primary Android APK Card */}
        <div className="rounded-xl bg-gradient-to-br from-[#067F5B]/10 via-emerald/5 to-bg-light border border-emerald/25 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-navy">
                Download APK Android (.apk)
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Aplikasi native Android · sinkron real-time dengan akun web ini
              </p>
            </div>
          </div>

          <a
            href={APK_DOWNLOAD_URL}
            download={apkFilename}
            onClick={() => setDownloadStarted(true)}
            className="w-full py-3 px-4 rounded-xl bg-emerald text-white text-sm font-semibold hover:bg-emerald/90 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span>
              Download {apkFilename}
              {apkSizeLabel ? ` (${apkSizeLabel})` : ' (Android)'}
            </span>
          </a>

          {downloadStarted && (
            <p className="text-[11px] font-medium text-emerald bg-emerald/10 border border-emerald/20 rounded-lg px-3 py-2">
              Unduhan <code className="font-mono">{apkFilename}</code> dimulai. Cek bilah
              notifikasi browser Anda, atau gunakan Link Alternatif di bawah jika terblokir.
            </p>
          )}

          <ol className="text-[11px] text-gray-600 space-y-1 pl-4 list-decimal">
            <li>Ketuk tombol Download dan pilih Tetap Unduh jika browser bertanya.</li>
            <li>Buka file <code className="font-mono text-navy">{apkFilename}</code> yang selesai diunduh.</li>
            <li>Pilih <strong>Pasang (Install)</strong>, lalu masuk dengan akun CUAN Anda.</li>
          </ol>

          <p className="text-[11px] text-gray-500">
            Dibuka dari WhatsApp/Instagram? Ketuk menu <code className="font-mono">⋮</code> lalu pilih{' '}
            <strong>Buka di Browser (Chrome)</strong> agar unduhan lancar.
          </p>

          <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <a
              href={APK_PROXY_DOWNLOAD_URL}
              download={apkFilename}
              onClick={() => setDownloadStarted(true)}
              className="font-semibold text-navy hover:text-emerald hover:underline"
            >
              Unduh via Mirror Server
            </a>
            <a
              href={APK_RELEASE_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-emerald hover:underline"
            >
              Halaman Rilis GitHub →
            </a>
          </div>
        </div>

        {/* Secondary Option: PWA / iPhone Safari */}
        <div className="rounded-xl bg-bg-light border border-gray-200/80 p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-navy">
                Pasang Tanpa Unduh APK (Android & iPhone)
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Tambahkan ikon CUAN langsung ke layar utama HP
              </p>
            </div>
            {pwaState.isInstalled && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald/15 text-emerald shrink-0">
                Terpasang
              </span>
            )}
          </div>

          {pwaState.canInstallPwa && !pwaState.isInstalled && (
            <button
              type="button"
              onClick={handlePwaInstall}
              className="w-full py-2.5 px-3 rounded-lg bg-white border border-gray-200 text-navy text-xs font-semibold hover:bg-gray-50 transition-colors"
            >
              + Pasang ke Layar Utama Sekarang
            </button>
          )}

          {installFeedback && (
            <p className="text-[11px] font-medium text-emerald">{installFeedback}</p>
          )}

          <div className="text-[11px] text-gray-600 space-y-1 leading-relaxed">
            {pwaState.isIos ? (
              <p>
                <strong>iPhone / iPad (Safari):</strong> Ketuk ikon{' '}
                <strong>Bagikan (Share)</strong> di bar bawah, lalu pilih{' '}
                <strong>Tambah ke Layar Utama</strong>.
              </p>
            ) : (
              <p>
                <strong>Android Chrome / iOS Safari:</strong> Buka menu browser (
                <code className="font-mono">⋮</code> atau ikon <strong>Bagikan</strong>)
                lalu pilih <strong>Tambahkan ke layar utama</strong>.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileAppModal;
