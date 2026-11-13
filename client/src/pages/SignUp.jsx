import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import AuthLayout from '../components/layout/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Notice from '../components/common/Notice';
import useAuth from '../hooks/useAuth';
import {
  registerService,
  passwordIsValid,
  passwordHint,
  emailIsValid,
} from '../services/authServices';

export default function SignUp() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    service_name: '',
    full_name: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (event) => {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
    setErrors((previous) => ({ ...previous, [event.target.name]: '' }));
  };
  if (user) return <Navigate to="/dashboard/service" replace />;
  async function submit(event) {
    event.preventDefault();
    const invalid = {};
    if (!form.service_name.trim())
      invalid.service_name = 'Enter your service name.';
    if (!form.full_name.trim())
      invalid.full_name = 'Enter the administrator’s full name.';
    if (!emailIsValid(form.email.trim()))
      invalid.email = 'Enter a valid email address.';
    if (!passwordIsValid(form.password)) invalid.password = passwordHint;
    if (form.confirm !== form.password)
      invalid.confirm = 'The passwords do not match.';
    setErrors(invalid);
    setError('');
    if (Object.keys(invalid).length) return;
    setBusy(true);
    try {
      await registerService({
        service_name: form.service_name.trim(),
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate('/login', {
        replace: true,
        state: {
          message:
            'Your service and administrator account have been created. Sign in to open your workspace.',
          email: form.email.trim(),
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
      eyebrow="Start with your service"
      title={
        <>
          Protect your data.
          <br />
          <span>Create your service.</span>
        </>
      }
      description="Register the application you want to protect and create its first administrator account in one step."
      heading="Register your service"
    >
      <p className="form-intro">
        You’ll be the administrator. Once registered, you can add your team from
        the dashboard.
      </p>
      <Notice>{error}</Notice>
      <form onSubmit={submit} noValidate className="stack-form">
        <Input
          label="Service name"
          name="service_name"
          value={form.service_name}
          onChange={change}
          error={errors.service_name}
          placeholder="e.g. TrackWise"
          maxLength={120}
          required
          disabled={busy}
          autoComplete="organization"
        />
        <div className="form-divider">
          <span>Administrator details</span>
        </div>
        <Input
          label="Full name"
          name="full_name"
          value={form.full_name}
          onChange={change}
          error={errors.full_name}
          placeholder="Your full name"
          maxLength={120}
          required
          disabled={busy}
          autoComplete="name"
        />
        <Input
          label="Email address"
          type="email"
          name="email"
          value={form.email}
          onChange={change}
          error={errors.email}
          placeholder="you@example.com"
          maxLength={254}
          required
          disabled={busy}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          name="password"
          value={form.password}
          onChange={change}
          error={errors.password}
          hint={passwordHint}
          required
          disabled={busy}
          autoComplete="new-password"
        />
        <Input
          label="Confirm password"
          type="password"
          name="confirm"
          value={form.confirm}
          onChange={change}
          error={errors.confirm}
          required
          disabled={busy}
          autoComplete="new-password"
        />
        <Button type="submit" busy={busy} className="button-full">
          {busy ? 'Registering service…' : 'Register service'}{' '}
          {!busy && <FiArrowRight />}
        </Button>
      </form>
      <p className="auth-switch">
        Already part of a service? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
