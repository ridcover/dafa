import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Archives from './pages/Archives';
import AdminPanel from './pages/AdminPanel';
import authService from './services/auth';
import api from './services/api';

export default function App() {
  const [user, setUser] = useState(authService.getUser());
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Tapel state (Persisten di localStorage saat reload)
  const [activeTapel, setActiveTapel] = useState(() => localStorage.getItem('activeTapel') || '2026/2027');
  const [currentTapel, setCurrentTapel] = useState(() => localStorage.getItem('currentTapel') || '2026/2027');
  const [allTapelList, setAllTapelList] = useState(['2024/2025', '2025/2026', '2026/2027']);

  const navigate = useNavigate();
  const location = useLocation();

  // Load user session and settings on startup
  useEffect(() => {
    const initApp = async () => {
      try {
        if (authService.isAuthenticated()) {
          const userData = await authService.getMe();
          setUser(userData);
        }
      } catch (err) {
        console.warn('Session verification notice:', err.message);
        // Hanya hapus sesi jika secara eksplisit ditolak 401/403
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        } else {
          // Jika hanya kendala jaringan/server sesaat, pertahankan user dari localStorage
          const cachedUser = authService.getUser();
          if (cachedUser) {
            setUser(cachedUser);
          } else {
            setUser(null);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    initApp();
  }, []);

  // Fetch academic years settings
  const fetchSettings = async () => {
    try {
      if (user) {
        const res = await api.get('/settings/tahun-akademik');
        setAllTapelList(res.data.years || ['2026/2027']);
        const backendActive = res.data.activeTahun || '2026/2027';
        setActiveTapel(backendActive);
        localStorage.setItem('activeTapel', backendActive);

        const savedCurrent = localStorage.getItem('currentTapel');
        if (!savedCurrent) {
          setCurrentTapel(backendActive);
          localStorage.setItem('currentTapel', backendActive);
        }
      }
    } catch (e) {
      console.warn('Failed to load academic years', e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const handleSelectTapel = (t) => {
    setCurrentTapel(t);
    localStorage.setItem('currentTapel', t);
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    navigate('/');
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.warn('Logout notice:', e);
    } finally {
      setUser(null);
      navigate('/login');
    }
  };

  const handleNavigateFolder = (jabatan) => {
    navigate(`/archives?parent_path=${jabatan}&tapel=${encodeURIComponent(currentTapel)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 space-y-4">
        <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold tracking-wide">Memuat DAF Archive SMK Diponegoro Cipari...</p>
      </div>
    );
  }

  // Jika belum login, tampilkan Login Page
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen app-bg-container relative text-slate-100 flex flex-col">
      {/* Background Overlay */}
      <div className="app-bg-overlay absolute inset-0 pointer-events-none"></div>

      {/* Main Layout Container */}
      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          user={user}
          onNavigateFolder={handleNavigateFolder}
        />

        {/* Content Wrapper */}
        <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
          {/* Header */}
          <Header
            user={user}
            onLogout={handleLogout}
            activeTapel={activeTapel}
            currentTapel={currentTapel}
            onSelectTapel={handleSelectTapel}
            allTapelList={allTapelList}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          />

          {/* Page Body */}
          <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">
            <Routes>
              <Route
                path="/"
                element={
                  <Dashboard
                    user={user}
                    activeTapel={activeTapel}
                    currentTapel={currentTapel}
                  />
                }
              />
              <Route
                path="/archives"
                element={
                  <Archives
                    user={user}
                    activeTapel={activeTapel}
                    currentTapel={currentTapel}
                  />
                }
              />
              <Route
                path="/admin"
                element={
                  user.isAdmin ? (
                    <AdminPanel
                      user={user}
                      onActiveYearChanged={(newTapel) => {
                        setActiveTapel(newTapel);
                        setCurrentTapel(newTapel);
                        localStorage.setItem('activeTapel', newTapel);
                        localStorage.setItem('currentTapel', newTapel);
                        fetchSettings();
                      }}
                    />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}
