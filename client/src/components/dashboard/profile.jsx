import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLock, FiUser } from 'react-icons/fi';
import useAuth from '../../hooks/useAuth';
import {
  changePassword,
  emailIsValid,
  getSession,
  passwordHint,
  passwordIsValid,
} from '../../services/authServices';
import {
  deleteProfile,
  roleLabel,
  updateProfile,
} from '../../services/userServices';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../common/Modal';
import Notice from '../common/Notice';
import '../../styles/profile.css';

function ProfileDetails({ user, onUpdated }) {
  const [name, setName] = useState(user.full_name || '');
  const [email, setEmail] = useState(user.email || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function submit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!name.trim() || !emailIsValid(email.trim())) {
      setError('Enter your full name and a valid email address.');
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ full_name: name.trim(), email: email.trim() });
      const current = await getSession({ notifyUnauthorized: true });
      onUpdated(current);
      setSuccess('Your profile has been updated.');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <h2>
            <FiUser /> Profile details
          </h2>
          <p>Keep your account details up to date.</p>
        </div>
      </div>
      <form className="stack-form panel-body" onSubmit={submit} noValidate>
        <Notice>{error}</Notice>
        <Notice type="success">{success}</Notice>
        <Input
          label="Full name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          maxLength={120}
          required
          disabled={busy}
        />
        <Input
          label="Email address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          disabled={busy}
        />
        <Input
          label="Role"
          value={roleLabel(user.role)}
          readOnly
          hint="Your service administrator manages roles."
        />
        <div>
          <Button type="submit" busy={busy}>
            Save details
          </Button>
        </div>
      </form>
    </div>
  );
}

function PasswordForm() {
  const { clearSession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    current_password: '',
    password: '',
    confirm: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const change = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  async function submit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!form.current_password) {
      setError('Enter your current password.');
      return;
    }
    if (!passwordIsValid(form.password)) {
      setError(passwordHint);
      return;
    }
    if (form.password !== form.confirm) {
      setError('The new passwords do not match.');
      return;
    }
    if (form.current_password === form.password) {
      setError('Choose a password different from your current password.');
      return;
    }
    setBusy(true);
    try {
      await changePassword({
        current_password: form.current_password,
        password: form.password,
      });
      setForm({ current_password: '', password: '', confirm: '' });
      clearSession();
      navigate('/login', {
        replace: true,
        state: {
          message:
            'Your password has been changed. Sign in with your new password.',
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
    <div className="panel">
      <div className="panel-heading">
        <div>
          <h2>
            <FiLock /> Change password
          </h2>
          <p>Use a strong password unique to this account.</p>
        </div>
      </div>
      <form className="stack-form panel-body" onSubmit={submit} noValidate>
        <Notice>{error}</Notice>
        <Notice type="success">{success}</Notice>
        <Input
          label="Current password"
          name="current_password"
          type="password"
          value={form.current_password}
          onChange={change}
          autoComplete="current-password"
          required
          disabled={busy}
        />
        <Input
          label="New password"
          name="password"
          type="password"
          value={form.password}
          onChange={change}
          autoComplete="new-password"
          hint={passwordHint}
          required
          disabled={busy}
        />
        <Input
          label="Confirm new password"
          name="confirm"
          type="password"
          value={form.confirm}
          onChange={change}
          autoComplete="new-password"
          required
          disabled={busy}
        />
        <div>
          <Button type="submit" busy={busy}>
            Update password
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function Profile() {
  const { user, setUser, clearSession } = useAuth();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (confirmation !== user.email) return;
    setBusy(true);
    setError('');
    try {
      await deleteProfile();
      clearSession();
      navigate('/login', {
        replace: true,
        state: { message: 'Your account has been deleted.', success: true },
      });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workspace-section" id="profile-main-div">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACCOUNT SETTINGS</span>
          <h1>My profile</h1>
          <p>Manage your personal details, password, and account access.</p>
        </div>
      </div>
      <div id="profile-div">
        <ProfileDetails user={user} onUpdated={setUser} />
        <PasswordForm />
      </div>
      <div className="danger-zone">
        <div>
          <h2>Delete account</h2>
          <p>
            Permanently remove your account and its access to this service. This
            action cannot be undone.
          </p>
        </div>
        <Button
          variant="danger"
          onClick={() => {
            setError('');
            setConfirmation('');
            setDeleting(true);
          }}
        >
          Delete my account
        </Button>
      </div>
      <Modal
        open={deleting}
        title="Permanently delete your account?"
        onClose={() => setDeleting(false)}
        busy={busy}
      >
        <p>
          You will lose access to this service. Your service may require another
          administrator before your account can be removed.
        </p>
        <Notice>{error}</Notice>
        <Input
          label={`Type ${user.email} to confirm`}
          type="email"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          disabled={busy}
        />
        <div className="form-actions">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setDeleting(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            busy={busy}
            disabled={confirmation !== user.email}
            onClick={remove}
          >
            Delete account permanently
          </Button>
        </div>
      </Modal>
    </section>
  );
}
