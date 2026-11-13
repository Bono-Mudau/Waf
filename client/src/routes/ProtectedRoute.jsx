import { Link, Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Loader from '../components/common/Loader';
import Notice from '../components/common/Notice';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, error, refreshSession } = useAuth();
  const location = useLocation();
  if (loading) return <Loader fullPage text="Checking your session…" />;
  if (!user && error)
    return (
      <main className="status-page">
        <h1>We couldn’t check your session</h1>
        <Notice onRetry={refreshSession}>{error}</Notice>
        <Link to="/login" className="text-link">
          Go to sign in
        </Link>
      </main>
    );
  if (!user)
    return (
      <Navigate
        to="/login"
        state={{
          from: location,
          message: 'Please sign in to access your service.',
        }}
        replace
      />
    );
  if (adminOnly && user.role !== 'admin')
    return <Navigate to="/dashboard" replace />;
  return children;
}
