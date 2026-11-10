import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../services/api';

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
      if (mode === 'register') {
        await api.post('/register', {
          username: formData.username,
          email: formData.email,
          password: formData.password,
        });
        setSuccessMessage('Registrasi berhasil! Silakan masuk dengan akun Anda.');
        setMode('login');
        setFormData((prev) => ({ ...prev, password: '' }));
        return;
      }

      const response = await api.post('/login', {
        email: formData.email,
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
    <div className="min-h-screen bg-bg-light flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-emerald text-white flex items-center justify-center font-bold text-xl">
            F
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy leading-none">
              FinMate
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Manajemen Keuangan Personal
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-bg-light rounded-lg mb-6">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`py-2 text-sm font-medium rounded-md transition-colors ${
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
            className={`py-2 text-sm font-medium rounded-md transition-colors ${
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
              <label className="block text-sm font-medium text-navy mb-1">
                Nama Lengkap
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                minLength={3}
                placeholder="Contoh: Tyas Nur"
                className="w-full p-2.5 border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-navy mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="tyas.nur@finmate.id"
              className="w-full p-2.5 border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              placeholder="Minimal 6 karakter"
              className="w-full p-2.5 border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2.5 px-4 bg-emerald text-white font-medium rounded-lg transition-colors ${
              isSubmitting
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-emerald/90'
            }`}
          >
            {isSubmitting
              ? 'Memproses...'
              : mode === 'login'
                ? 'Masuk'
                : 'Daftar Akun'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
