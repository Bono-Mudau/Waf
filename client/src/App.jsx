import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Homepage from './pages/Home';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import PasswordReset from './pages/PasswordReset';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Overview from './components/dashboard/Overview';
import Logs from './components/dashboard/logs';
import Rules from './components/dashboard/rules';
import Users from './components/dashboard/users';
import Service from './components/dashboard/services';
import ProtectedRoute from './routes/ProtectedRoute';
import AuthProvider from './hooks/AuthProvider';

function PagePosition() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const names = {
      '/login': 'Sign in',
      '/signup': 'Register service',
      '/forgot-password': 'Account recovery',
      '/reset-password': 'Reset password',
      '/dashboard': 'Overview',
      '/dashboard/logs': 'Incident logs',
      '/dashboard/rules': 'Security rules',
      '/dashboard/users': 'Team members',
      '/dashboard/service': 'Manage service',
      '/dashboard/profile': 'My profile',
    };
    document.title =
      pathname === '/'
        ? 'SQLiShield · SQL Injection Defence'
        : `${names[pathname.toLowerCase()] || 'Page not found'} · SQLiShield`;
    const frame = requestAnimationFrame(() => {
      if (hash)
        document
          .getElementById(hash.slice(1))
          ?.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
              .matches
              ? 'auto'
              : 'smooth',
          });
      else window.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <PagePosition />
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/signup" element={<SignUp />} />
        <Route
          path="/register-service"
          element={<Navigate to="/signup" replace />}
        />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<PasswordReset />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<Overview />} />
          <Route path="logs" element={<Logs />} />
          <Route path="rules" element={<Rules />} />
          <Route
            path="users"
            element={
              <ProtectedRoute adminOnly>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route path="service" element={<Service />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route
          path="*"
          element={
            <main className="status-page">
              <span className="eyebrow">404</span>
              <h1>This page couldn’t be found</h1>
              <p className="muted">
                Choose a page from your workspace or return to the homepage.
              </p>
              <Link to="/" className="Button button-primary">
                Back to home
              </Link>
            </main>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
