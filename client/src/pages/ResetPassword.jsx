import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Notice from '../components/common/Notice';
import {
  passwordHint,
  passwordIsValid,
  resetPassword,
} from '../services/authServices';

export default function ResetPassword() {
  const [search] = useSearchParams();
  const token = search.get('token');
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!token) return;
    if (!passwordIsValid(password)) {
      setError(passwordHint);
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await resetPassword({ token, password });
      navigate('/login', {
        replace: true,
        state: {
          message:
            'Your password has been reset. Sign in with your new password.',
          success: true,
        },
      });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout
      title={
        <>
          A fresh start.
          <br />
          <span>A stronger password.</span>
        </>
      }
      description="Choose a new password to regain access to your SQLiShield workspace."
      heading="Choose a new password"
    >
      {!token ? (
        <Notice type="info">
          This page requires a valid password reset link.{' '}
          <Link to="/forgot-password">Request a new link</Link>.
        </Notice>
      ) : (
        <>
          <p className="form-intro">
            Choose a unique password you don’t use for another account.
          </p>
          <Notice>{error}</Notice>
          <form className="stack-form" onSubmit={submit} noValidate>
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              hint={passwordHint}
              autoComplete="new-password"
              required
              disabled={busy}
            />
            <Input
              label="Confirm new password"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              required
              disabled={busy}
            />
            <Button type="submit" busy={busy} className="button-full">
              Reset password
            </Button>
          </form>
        </>
      )}
      <p className="auth-switch">
        <Link to="/login">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
