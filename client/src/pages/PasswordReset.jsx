import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Notice from '../components/common/Notice';
import { emailIsValid, forgotPassword } from '../services/authServices';

export default function PasswordReset() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!emailIsValid(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
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
          Let’s get you
          <br />
          <span>back to your workspace.</span>
        </>
      }
      description="Recover access to your account using the email address associated with your service."
      heading="Reset your password"
    >
      <p className="form-intro">
        Enter your email address to request a password reset link.
      </p>
      <Notice>{error}</Notice>
      {sent ? (
        <Notice type="success">
          If an account exists for that email address, you’ll receive password
          reset instructions. Check your inbox and spam folder.
        </Notice>
      ) : (
        <form className="stack-form" onSubmit={submit} noValidate>
          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
            disabled={busy}
          />
          <Button type="submit" busy={busy} className="button-full">
            Send reset instructions
          </Button>
        </form>
      )}
      <p className="auth-switch">
        <Link to="/login">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
