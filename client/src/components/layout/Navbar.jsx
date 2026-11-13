import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMenu, FiX, FiArrowUpRight } from 'react-icons/fi';
import useAuth from '../../hooks/useAuth';
import Logo from './Logo';
import '../../styles/navbar.css';

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <header className="site-header">
      <nav className="site-nav container" aria-label="Main navigation">
        <Logo />
        <button
          className="icon-button menu-toggle"
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="main-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <FiX /> : <FiMenu />}
        </button>
        <div id="main-navigation" className={`links ${open ? 'is-open' : ''}`}>
          <Link to="/#features" onClick={() => setOpen(false)}>
            Features
          </Link>
          <Link to="/#how-it-works" onClick={() => setOpen(false)}>
            How it works
          </Link>
          <Link to="/#documentation" onClick={() => setOpen(false)}>
            Documentation
          </Link>
          {user ? (
            <Link className="Button button-primary" to="/dashboard">
              Open dashboard <FiArrowUpRight />
            </Link>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link className="Button button-primary" to="/signup">
                Register service <FiArrowUpRight />
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
