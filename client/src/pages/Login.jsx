import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import AuthLayout from '../components/layout/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Notice from '../components/common/Notice';
import useAuth from '../hooks/useAuth';
import { emailIsValid } from '../services/authServices';

export default function Login() {
  const { user, signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const destination = location.state?.from?.pathname?.startsWith('/dashboard')
    ? location.state.from.pathname
    : '/dashboard';
  if (user) return <Navigate to={destination} replace />;
  async function submit(event) {
    event.preventDefault();
    const invalid = {};
    if (!emailIsValid(email.trim()))
      invalid.email = 'Enter a valid email address.';
    if (!password) invalid.password = 'Enter your password.';
    setErrors(invalid);
    setError('');
    if (Object.keys(invalid).length) return;
    setBusy(true);
    try {
      await signIn({ email: email.trim(), password });
      navigate(destination, { replace: true });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout
      eyebrow="Welcome back"
      title={
        <>
          Your service.
          <br />
          <span>Your security workspace.</span>
        </>
      }
      description="Sign in to monitor incidents, review detection rules, and manage your SQLiShield service."
      heading="Sign in to SQLiShield"
    >
      <p className="form-intro">
        Use your administrator account or the credentials provided by your
        service administrator.
      </p>
      {!error && (
        <Notice type={location.state?.success ? 'success' : 'info'}>
          {location.state?.message}
        </Notice>
      )}
      <Notice>{error}</Notice>
      <form className="stack-form" onSubmit={submit} noValidate>
        <Input
          label="Email address"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          error={errors.email}
          placeholder="you@example.com"
          required
          disabled={busy}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          error={errors.password}
          required
          disabled={busy}
        />
        <Link className="forgot-password" to="/forgot-password">
          Forgot your password?
        </Link>
        <Button type="submit" busy={busy} className="button-full">
          {busy ? 'Signing in…' : 'Sign in'} {!busy && <FiArrowRight />}
        </Button>
      </form>
      <p className="auth-switch">
        New to SQLiShield? <Link to="/signup">Register a service</Link>
      </p>
    </AuthLayout>
  );
}
