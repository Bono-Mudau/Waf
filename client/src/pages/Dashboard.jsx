import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { FiMenu, FiX } from 'react-icons/fi';
import SideBar from '../components/layout/Sidebar';
import Logo from '../components/layout/Logo';
import Notice from '../components/common/Notice';
import useAuth from '../hooks/useAuth';
import useLiveLogs from '../hooks/useLiveLogs';
import { roleLabel } from '../services/userServices';
import '../styles/dashboard.css';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const live = useLiveLogs(user.service_id);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  async function handleSignOut() {
    setSigningOut(true);
    setError('');
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <div className="dashboard">
      <a className="skip-link" href="#dashboard-content">
        Skip to content
      </a>
      <header id="dashboard-nav">
        <div className="dashboard-brand">
          <button
            type="button"
            className="icon-button sidebar-toggle"
            aria-controls="workspace-sidebar"
            aria-expanded={open}
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <FiX /> : <FiMenu />}
          </button>
          <Logo />
        </div>
        <div className="workspace-title">
          <span className="muted small">Service workspace</span>
          <strong>
            {user.service?.name ||
              user.service?.service_name ||
              user.service_name ||
              'SQLiShield'}
          </strong>
        </div>
        <Link
          to="/dashboard/profile"
          className="account-chip"
          aria-label={`Open profile for ${user.full_name || user.email}`}
        >
          <span className="avatar">
            {(user.full_name || user.email).slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{user.full_name || user.email}</strong>
            <small>{roleLabel(user.role)}</small>
          </span>
        </Link>
      </header>
      <div className="dashboard-container">
        <SideBar
          open={open}
          onNavigate={() => setOpen(false)}
          onSignOut={handleSignOut}
          signingOut={signingOut}
        />
        {open && (
          <button
            className="sidebar-overlay"
            aria-label="Close navigation"
            type="button"
            onClick={() => setOpen(false)}
          />
        )}
        <main className="Display_area" id="dashboard-content">
          <Notice onDismiss={() => setError('')}>{error}</Notice>
          <Outlet context={{ live }} />
        </main>
      </div>
    </div>
  );
}
