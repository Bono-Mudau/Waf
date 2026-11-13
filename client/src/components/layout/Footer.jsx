import { Link } from 'react-router-dom';
import Logo from './Logo';
import '../../styles/footer.css';
export default function Footer() {
  return (
    <footer className="Footer">
      <div className="container footer-content">
        <div className="footer-brand">
          <Logo />
          <p>
            SQL injection detection.
            <br />
            Built around your Node.js application.
          </p>
        </div>
        <div>
          <h3>Explore</h3>
          <Link to="/#features">Features</Link>
          <Link to="/#how-it-works">System workflow</Link>
          <Link to="/#modes">Operating modes</Link>
        </div>
        <div>
          <h3>Get started</h3>
          <Link to="/#documentation">Integration guide</Link>
          <Link to="/signup">Register a service</Link>
          <Link to="/login">Sign in</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} SQLiShield</span>
        <span>Local inspection. Shared visibility.</span>
      </div>
    </footer>
  );
}
