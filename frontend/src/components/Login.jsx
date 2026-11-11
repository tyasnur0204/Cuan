import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../services/api';
import FinMateLogo from './FinMateLogo';

const FEATURES = [
  'Zero-Based Budgeting',
  'Analisis Pertumbuhan Aset vs Inflasi',
  'Multi-Akun & Mode Bisnis / Usaha',
  'Laporan Keuangan Interaktif',
];

const Login = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (localStorage.getItem('access_token')) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const normalizedEmail = formData.email.trim();

      if (mode === 'register') {
        await api.post('/register', {
          username: formData.username.trim(),
          email: normalizedEmail,
          password: formData.password,
        });

        try {
          const loginRes = await api.post('/login', {
            email: normalizedEmail,
            password: formData.password,
          });
          const { access_token, user } = loginRes.data;
          localStorage.setItem('access_token', access_token);
          if (user) {
            localStorage.setItem('user', JSON.stringify(user));
          }
          navigate('/dashboard', { replace: true });
          return;
        } catch {
          setSuccessMessage('Registrasi berhasil! Silakan masuk dengan akun Anda.');
          setMode('login');
          setFormData((prev) => ({ ...prev, password: '' }));
          return;
        }
      }

      const response = await api.post('/login', {
        email: normalizedEmail,
        password: formData.password,
      });

      const { access_token, user } = response.data;
      localStorage.setItem('access_token', access_token);
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      }

      navigate('/dashboard', { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => `${d.loc?.join('.')}: ${d.msg}`).join(', ')
        : detail || err.message || 'Autentikasi gagal';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-light flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Hero Brand Panel (Matching FinMate Splash & Identity) */}
        <div className="md:col-span-5 relative bg-gradient-to-br from-[#067F5B] via-[#06694B] to-[#044D37] text-white p-8 flex flex-col justify-between overflow-hidden">
          <div className="absolute -bottom-16 -right-16 w-52 h-52 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <FinMateLogo className="w-11 h-11" variant="glass" />
              <div>
                <h1 className="text-xl font-bold tracking-tight leading-none">
                  FinMate
                </h1>
                <p className="text-xs text-white/80 mt-1">
                  Manajemen Keuangan Mahasiswa
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <h2 className="text-2xl font-bold leading-snug">
                Atur Keuanganmu, Raih Masa Depanmu!
              </h2>
              <p className="text-xs text-white/80 leading-relaxed">
                Catat pemasukan & pengeluaran harian, kendalikan anggaran bulanan,
                dan pantau pertumbuhan investasi melampaui inflasi.
              </p>
            </div>

            <ul className="space-y-2 pt-2">
              {FEATURES.map((feat) => (
                <li
                  key={feat}
                  className="flex items-center gap-2.5 text-xs font-medium text-white/90"
                >
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                    ✓
                  </span>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative z-10 text-xs text-white/75 italic mt-8 pt-4 border-t border-white/15">
            Kelola lebih cerdas, hidup lebih tenang.
          </p>
        </div>

        {/* Auth Form Panel */}
        <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-navy">
              {mode === 'login' ? 'Selamat Datang Kembali' : 'Buat Akun Baru'}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {mode === 'login'
                ? 'Masuk dengan akun Anda, atau daftar bebas pada tab Daftar'
                : 'Daftar bebas dengan email apa saja untuk mulai mengelola keuangan'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1 bg-bg-light rounded-xl mb-6">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white text-navy shadow-sm'
                  : 'text-gray-500 hover:text-navy'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-white text-navy shadow-sm'
                  : 'text-gray-500 hover:text-navy'
              }`}
            >
              Daftar
            </button>
          </div>

          {successMessage && (
            <div
              role="alert"
              className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm font-medium"
            >
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium"
            >
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-navy mb-1.5">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  minLength={2}
                  autoComplete="name"
                  placeholder="Masukkan nama lengkap Anda"
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-navy mb-1.5">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                placeholder="Masukkan email Anda"
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy mb-1.5">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={
                  mode === 'login'
                    ? 'Masukkan password Anda'
                    : 'Minimal 6 karakter'
                }
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2.5 px-4 bg-emerald text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                isSubmitting
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-emerald/90'
              }`}
            >
              <span>
                {isSubmitting
                  ? 'Memproses...'
                  : mode === 'login'
                    ? 'Masuk ke Dashboard'
                    : 'Daftar Akun'}
              </span>
              {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-gray-500">
            {mode === 'login' ? (
              <>
                Belum punya akun?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="font-semibold text-emerald hover:underline"
                >
                  Daftar sekarang
                </button>
              </>
            ) : (
              <>
                Sudah punya akun?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-semibold text-emerald hover:underline"
                >
                  Masuk
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
