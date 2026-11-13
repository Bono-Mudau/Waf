import { Link } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiShield } from 'react-icons/fi';
import Logo from './Logo';
import Card from '../ui/Card';
import '../../styles/sign_up.css';
import '../../styles/login.css';

export default function AuthLayout({
  eyebrow,
  title,
  description,
  heading,
  children,
}) {
  return (
    <main className="create_service_main-div">
      <div className="create_service-intro">
        <Logo />
        <div className="auth-intro-content">
          <span className="eyebrow">
            <FiShield /> {eyebrow || 'Your application. Protected.'}
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
          <ul className="auth-benefits">
            <li>
              <FiCheck /> Rule-based and heuristic inspection
            </li>
            <li>
              <FiCheck /> Local and hybrid operating modes
            </li>
            <li>
              <FiCheck /> One service. A shared security workspace.
            </li>
          </ul>
        </div>
        <Link className="back-link" to="/">
          <FiArrowLeft /> Back to homepage
        </Link>
      </div>
      <div className="auth-form-column">
        <Card heading={heading}>{children}</Card>
        <p className="auth-footnote">
          SQLiShield · SQL injection detection for Node.js applications
        </p>
      </div>
    </main>
  );
}
