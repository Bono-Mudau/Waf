import { NavLink } from 'react-router-dom';
import {
  FiActivity,
  FiFileText,
  FiGrid,
  FiLogOut,
  FiServer,
  FiShield,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import useAuth from '../../hooks/useAuth';
import '../../styles/sidebar.css';

export default function SideBar({ open, onNavigate, onSignOut, signingOut }) {
  const { isAdmin } = useAuth();
  const links = [
    ['/dashboard', 'Overview', FiGrid, true],
    ['/dashboard/logs', 'Incident logs', FiFileText],
    ['/dashboard/rules', 'Security rules', FiShield],
    ['/dashboard/service', 'Manage service', FiServer],
    ...(isAdmin ? [['/dashboard/users', 'Team members', FiUsers]] : []),
    ['/dashboard/profile', 'My profile', FiUser],
  ];
  return (
    <aside
      className={`sidebar ${open ? 'sidebar-open' : ''}`}
      id="workspace-sidebar"
    >
      <div className="sidebar-label">WORKSPACE</div>
      <nav aria-label="Dashboard navigation">
        {links.map(([to, label, Icon, end]) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <Icon aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <FiActivity />
          <p>
            Service-scoped visibility.
            <span>Your team, rules, and incidents in one place.</span>
          </p>
        </div>
        <button
          type="button"
          className="sidebar-link signout-button"
          onClick={onSignOut}
          disabled={signingOut}
        >
          <FiLogOut />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </aside>
  );
}
