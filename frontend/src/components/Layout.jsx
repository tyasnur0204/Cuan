import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { APK_DOWNLOAD_URL } from '../utils/appDownload';
import FinMateLogo from './FinMateLogo';
import MobileAppModal from './MobileAppModal';

const navItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    shortLabel: 'Home',
    icon: (
      <svg
        className="w-5 h-5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    to: '/transactions',
    label: 'Transaksi',
    shortLabel: 'Transaksi',
    icon: (
      <svg
        className="w-5 h-5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
        />
      </svg>
    ),
  },
  {
    to: '/budgets',
    label: 'Budgeting',
    shortLabel: 'Budget',
    icon: (
      <svg
        className="w-5 h-5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
        />
      </svg>
    ),
  },
  {
    to: '/portfolio',
    label: 'Portofolio Investasi',
    shortLabel: 'Investasi',
    icon: (
      <svg
        className="w-5 h-5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        />
      </svg>
    ),
  },
  {
    to: '/reports',
    label: 'Laporan',
    shortLabel: 'Laporan',
    icon: (
      <svg
        className="w-5 h-5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M9 17v-6m4 6V7m4 10v-3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Pengaturan',
    shortLabel: 'Akun',
    icon: (
      <svg
        className="w-5 h-5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
];

const formatTodayLabel = () => {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
};

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [storedUser, setStoredUser] = useState(getStoredUser);
  const [notifOpen, setNotifOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [showMobileBanner, setShowMobileBanner] = useState(() => {
    try {
      return !localStorage.getItem('cuan_hide_mobile_app_banner');
    } catch {
      return true;
    }
  });
  const notifRef = useRef(null);
  const navigate = useNavigate();

  const dismissMobileBanner = () => {
    try {
      localStorage.setItem('cuan_hide_mobile_app_banner', '1');
    } catch {
      // Ignore storage quota / private mode issues
    }
    setShowMobileBanner(false);
  };

  useEffect(() => {
    const syncUser = () => setStoredUser(getStoredUser());
    window.addEventListener('finmate-user-updated', syncUser);
    window.addEventListener('storage', syncUser);
    return () => {
      window.removeEventListener('finmate-user-updated', syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const res = await api.get('/dashboard/summary');
        const data = res.data;
        const items = [];
        if (data?.total_budget_limit > 0) {
          const pct = Math.round(
            (data.current_month_expenses / data.total_budget_limit) * 100
          );
          if (pct >= 100) {
            items.push({
              id: 'budget-over',
              title: 'Anggaran Bulanan Terlampaui',
              desc: `Pemakaian mencapai ${pct}% dari batas anggaran.`,
              to: '/budgets',
              tone: 'warn',
            });
          } else {
            items.push({
              id: 'budget-ok',
              title: 'Status Anggaran Terkendali',
              desc: `Terpakai ${pct}% dari anggaran bulan ini.`,
              to: '/budgets',
              tone: 'ok',
            });
          }
        } else {
          items.push({
            id: 'budget-empty',
            title: 'Atur Zero-Based Budgeting',
            desc: 'Alokasikan anggaran bulanan agar arus kas lebih terukur.',
            to: '/budgets',
            tone: 'info',
          });
        }

        if (data?.net_real_growth_pct !== undefined) {
          items.push({
            id: 'inv-check',
            title:
              data.net_real_growth_pct >= 0
                ? 'Portofolio Kalahkan Inflasi'
                : 'Return di Bawah Inflasi',
            desc: `Pertumbuhan bersih ${
              data.net_real_growth_pct >= 0
                ? `+${data.net_real_growth_pct}%`
                : `${data.net_real_growth_pct}%`
            } vs inflasi ${data.inflation_rate_pct ?? 3.2}%.`,
            to: '/portfolio',
            tone: data.net_real_growth_pct >= 0 ? 'ok' : 'warn',
          });
        }
        setAlerts(items);
      } catch {
        setAlerts([]);
      }
    };

    loadNotifications();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = storedUser?.username || 'Pengguna CUAN';
  const displayEmail = storedUser?.email || '';

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const raw = searchTerm.trim();
    const lower = raw.toLowerCase();

    if (lower === 'dashboard' || lower === 'beranda') {
      navigate('/dashboard');
      return;
    }
    if (lower === 'budget' || lower === 'budgeting' || lower === 'anggaran') {
      navigate('/budgets');
      return;
    }
    if (
      lower === 'investasi' ||
      lower === 'portofolio' ||
      lower === 'inflasi'
    ) {
      navigate('/portfolio');
      return;
    }
    if (lower === 'laporan' || lower === 'report') {
      navigate('/reports');
      return;
    }
    if (lower === 'pengaturan' || lower === 'akun' || lower === 'settings') {
      navigate('/settings');
      return;
    }

    navigate(
      raw ? `/transactions?search=${encodeURIComponent(raw)}` : '/transactions'
    );
  };

  return (
    <div className="min-h-screen flex bg-bg-light text-navy">
      {/* Mobile drawer backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-navy/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-[#067F5B] via-[#06694B] to-[#044D37] text-white flex flex-col shrink-0 transform transition-transform duration-200 ease-in-out md:static md:translate-x-0 shadow-lg md:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-5 border-b border-white/15 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 min-w-0"
            onClick={() => setSidebarOpen(false)}
          >
            <FinMateLogo className="w-10 h-10" variant="glass" />
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight leading-none">
                CUAN
              </h1>
              <p className="text-[11px] text-white/80 mt-1 truncate">
                Catat Uang, Aset Naik
              </p>
            </div>
          </Link>

          <button
            type="button"
            className="md:hidden text-white/80 hover:text-white p-1"
            onClick={() => setSidebarOpen(false)}
            aria-label="Tutup menu"
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

        <nav className="flex-1 px-3.5 py-5 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white text-emerald font-semibold shadow-sm'
                    : 'text-white/85 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-white/15 space-y-3 bg-black/10">
          <div className="px-2 py-1 text-[11px] text-white/75 italic leading-snug">
            “Catat Uang, Aset Naik.”
          </div>

          <Link
            to="/settings"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {initials || 'CU'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{displayName}</p>
              {displayEmail ? (
                <p className="text-[11px] text-white/70 truncate">
                  {displayEmail}
                </p>
              ) : (
                <p className="text-[11px] text-white/70">Mahasiswa</p>
              )}
            </div>
          </Link>

          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setAppModalOpen(true);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <svg
              className="w-5 h-5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <span>Download App Mobile</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white transition-colors"
          >
            <svg
              className="w-5 h-5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200/80 px-4 md:px-8 py-3 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              className="md:hidden p-2 rounded-lg text-navy hover:bg-bg-light shrink-0"
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka menu"
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
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            <form
              onSubmit={handleSearchSubmit}
              className="relative w-full max-w-md hidden sm:block"
            >
              <svg
                className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari fitur, transaksi..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-bg-light border border-gray-200/80 rounded-lg text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              />
            </form>

            <div className="sm:hidden flex items-center gap-2 font-bold text-base text-navy truncate">
              <FinMateLogo className="w-7 h-7" variant="solid" />
              <span>CUAN</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setAppModalOpen(true)}
              className="md:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald/10 text-emerald border border-emerald/25 text-xs font-semibold hover:bg-emerald/15 transition-colors shrink-0"
              aria-label="Download Aplikasi Mobile"
            >
              <svg
                className="w-3.5 h-3.5 shrink-0"
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
              <span>App</span>
            </button>

            <span className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-light text-xs font-medium text-navy/80 border border-gray-200/60">
              <svg
                className="w-3.5 h-3.5 text-emerald"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {formatTodayLabel()}
            </span>

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Notifikasi Keuangan"
                className="relative w-9 h-9 rounded-lg bg-bg-light border border-gray-200/70 text-navy hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <svg
                  className="w-4.5 h-4.5 w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {alerts.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-100 p-3 z-40 space-y-2">
                  <div className="flex items-center justify-between px-1 pb-1 border-b border-gray-100">
                    <span className="text-xs font-bold text-navy">
                      Notifikasi CUAN
                    </span>
                    <span className="text-[11px] text-emerald font-semibold">
                      {alerts.length} info
                    </span>
                  </div>
                  {alerts.length === 0 ? (
                    <p className="text-xs text-gray-500 px-1 py-2">
                      Semua data keuangan Anda terpantau rapi.
                    </p>
                  ) : (
                    alerts.map((a) => (
                      <Link
                        key={a.id}
                        to={a.to}
                        onClick={() => setNotifOpen(false)}
                        className="block p-2.5 rounded-lg hover:bg-bg-light transition-colors"
                      >
                        <p className="text-xs font-semibold text-navy">
                          {a.title}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {a.desc}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>

            <Link
              to="/settings"
              title="Profil & Pengaturan Akun"
              className="w-9 h-9 rounded-full bg-emerald text-white flex items-center justify-center text-sm font-semibold hover:bg-emerald/90 transition-colors"
            >
              {initials || 'CU'}
            </Link>
          </div>
        </header>

        {/* Mobile Web App Download Banner */}
        {showMobileBanner && (
          <div className="md:hidden bg-gradient-to-r from-[#067F5B] to-[#044D37] text-white px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-sm">
            <button
              type="button"
              onClick={() => setAppModalOpen(true)}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
            >
              <FinMateLogo className="w-8 h-8" variant="glass" />
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight truncate">
                  CUAN App (Android)
                </p>
                <p className="text-[10px] text-white/80 truncate">
                  Catat Uang, Aset Naik · Unduh APK
                </p>
              </div>
            </button>
            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={APK_DOWNLOAD_URL}
                download="CUAN.apk"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-white text-emerald text-[11px] font-bold shadow-sm hover:bg-white/95 transition-colors"
              >
                Unduh APK
              </a>
              <button
                type="button"
                onClick={dismissMobileBanner}
                aria-label="Tutup banner download aplikasi"
                className="p-1 text-white/75 hover:text-white"
              >
                <svg
                  className="w-4 h-4"
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
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
          {children ?? <Outlet />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] font-medium ${
              isActive ? 'text-emerald' : 'text-gray-500'
            }`
          }
        >
          {navItems[0].icon}
          <span>{navItems[0].shortLabel}</span>
        </NavLink>

        <NavLink
          to="/transactions"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] font-medium ${
              isActive ? 'text-emerald' : 'text-gray-500'
            }`
          }
        >
          {navItems[1].icon}
          <span>{navItems[1].shortLabel}</span>
        </NavLink>

        <Link
          to="/transactions?new=1"
          aria-label="Tambah Transaksi"
          className="-mt-6 w-12 h-12 rounded-full bg-emerald text-white flex items-center justify-center shadow-md border-4 border-bg-light hover:bg-emerald/90 transition-transform active:scale-95"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.4}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </Link>

        <NavLink
          to="/budgets"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] font-medium ${
              isActive ? 'text-emerald' : 'text-gray-500'
            }`
          }
        >
          {navItems[2].icon}
          <span>{navItems[2].shortLabel}</span>
        </NavLink>

        <NavLink
          to="/portfolio"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] font-medium ${
              isActive ? 'text-emerald' : 'text-gray-500'
            }`
          }
        >
          {navItems[3].icon}
          <span>{navItems[3].shortLabel}</span>
        </NavLink>
      </nav>

      <MobileAppModal
        open={appModalOpen}
        onClose={() => setAppModalOpen(false)}
      />
    </div>
  );
};

export default Layout;
