import { Link } from 'react-router-dom';
import { FiShield } from 'react-icons/fi';
import '../../styles/Logo.css';
export default function Logo() {
  return (
    <Link to="/" className="logo" aria-label="SQLiShield home">
      <span className="logo-icon">
        <FiShield aria-hidden="true" />
      </span>
      <span className="logo-text">SQLiShield</span>
    </Link>
  );
}
