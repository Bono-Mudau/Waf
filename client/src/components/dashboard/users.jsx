import { useState } from 'react';
import {
  FiCopy,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUsers,
} from 'react-icons/fi';
import useAuth from '../../hooks/useAuth';
import useResource from '../../hooks/useResource';
import {
  createUser,
  deleteUser,
  listUsers,
  ROLE_OPTIONS,
  roleLabel,
  updateRole,
  updateUser,
} from '../../services/userServices';
import {
  emailIsValid,
  passwordHint,
  passwordIsValid,
} from '../../services/authServices';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal, { ConfirmDialog } from '../common/Modal';
import Notice from '../common/Notice';
import Loader from '../common/Loader';
import '../../styles/users.css';

function UserForm({ user, onSave, onClose, busy, error }) {
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    role: 'user',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const change = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  function generate() {
    const alphabet =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let password;
    do {
      password = Array.from(
        crypto.getRandomValues(new Uint8Array(20)),
        (n) => alphabet[n % alphabet.length]
      ).join('');
    } while (!passwordIsValid(password));
    setForm((previous) => ({ ...previous, password }));
  }
  function submit(event) {
    event.preventDefault();
    const invalid = {};
    if (!form.full_name.trim()) invalid.full_name = 'Enter a full name.';
    if (!emailIsValid(form.email.trim()))
      invalid.email = 'Enter a valid email address.';
    if (!user && !passwordIsValid(form.password))
      invalid.password = passwordHint;
    setErrors(invalid);
    if (!Object.keys(invalid).length)
      onSave({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        ...(!user ? { role: form.role, password: form.password } : {}),
      });
  }
  return (
    <form className="stack-form" onSubmit={submit} noValidate>
      <Notice>{error}</Notice>
      <Input
        label="Full name"
        name="full_name"
        value={form.full_name}
        onChange={change}
        error={errors.full_name}
        autoComplete="off"
        maxLength={120}
        required
        disabled={busy}
      />
      <Input
        label="Email address"
        name="email"
        type="email"
        value={form.email}
        onChange={change}
        error={errors.email}
        autoComplete="off"
        required
        disabled={busy}
      />
      {!user && (
        <>
          <div className="form-field">
            <label htmlFor="new-user-role">Role</label>
            <select
              id="new-user-role"
              name="role"
              value={form.role}
              onChange={change}
              disabled={busy}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Temporary password"
            name="password"
            type="password"
            value={form.password}
            onChange={change}
            error={errors.password}
            hint={passwordHint}
            autoComplete="new-password"
            required
            disabled={busy}
          />
          <Button variant="secondary" onClick={generate} disabled={busy}>
            Generate a password
          </Button>
          <p className="muted small">
            Share the temporary password with the new member securely. They can
            change it in their profile.
          </p>
        </>
      )}
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" busy={busy}>
          {user ? 'Save member' : 'Create member'}
        </Button>
      </div>
    </form>
  );
}

export default function Users() {
  const { user: currentUser, refreshSession } = useAuth();
  const resource = useResource(listUsers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [roleChange, setRoleChange] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const members = (resource.data || []).filter(
    (member) =>
      (roleFilter === 'all' || member.role === roleFilter) &&
      `${member.full_name} ${member.email}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  async function save(body) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (editor.user) {
        await updateUser(editor.user.id, body);
        if (String(editor.user.id) === String(currentUser.id)) refreshSession();
      } else {
        await createUser(body);
        setCredentials({ email: body.email, password: body.password });
      }
      setEditor(null);
      setSuccess(
        editor.user
          ? 'The member’s details have been updated.'
          : 'The new member has been created.'
      );
      resource.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await deleteUser(deleting.id);
      setDeleting(null);
      setSuccess('The member has been removed.');
      resource.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function changeRole() {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await updateRole(roleChange.member.id, roleChange.role);
      setRoleChange(null);
      setSuccess('The member’s role has been updated.');
      resource.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function copyCredentials() {
    try {
      await navigator.clipboard.writeText(
        `Email: ${credentials.email}\nTemporary password: ${credentials.password}`
      );
      setSuccess('Temporary credentials copied. Share them securely.');
    } catch {
      setError(
        'Clipboard access is unavailable. You can select and copy the credentials manually.'
      );
    }
  }
  return (
    <section id="users-section" className="workspace-section">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRATOR CONTROLS</span>
          <h1>Team members</h1>
          <p>Manage the people who can access your service workspace.</p>
        </div>
        <div className="heading-actions">
          <Button
            variant="secondary"
            onClick={resource.refresh}
            busy={resource.loading}
          >
            <FiRefreshCw /> Refresh
          </Button>
          <Button
            onClick={() => {
              setError('');
              setEditor({ user: null });
            }}
          >
            <FiPlus /> Add member
          </Button>
        </div>
      </div>
      <Notice onRetry={resource.refresh}>{resource.error}</Notice>
      {!editor && !deleting && !roleChange && (
        <Notice onDismiss={() => setError('')}>{error}</Notice>
      )}
      <Notice type="success" onDismiss={() => setSuccess('')}>
        {success}
      </Notice>
      {credentials && (
        <div className="credentials-box">
          <div>
            <strong>New member credentials</strong>
            <p>
              Copy these details before dismissing. The temporary password is
              not saved in this browser.
            </p>
            <code>{credentials.email}</code>
            <code>{credentials.password}</code>
          </div>
          <div className="row-actions">
            <Button variant="secondary" onClick={copyCredentials}>
              <FiCopy /> Copy
            </Button>
            <Button variant="ghost" onClick={() => setCredentials(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
      <div className="panel">
        <div className="filter-bar">
          <div className="search-field">
            <label className="sr-only" htmlFor="user-search">
              Search team members
            </label>
            <FiSearch />
            <input
              id="user-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
            />
          </div>
          <div className="filter-field">
            <label htmlFor="user-role-filter">Role</label>
            <select
              id="user-role-filter"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="all">All roles</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
          <span className="muted small">
            {resource.data
              ? `${resource.data.length} team members`
              : 'Service team'}
          </span>
        </div>
        {resource.loading && !resource.data ? (
          <Loader text="Loading your team…" />
        ) : (
          <div id="users">
            {members.length ? (
              members.map((member) => {
                const self = String(member.id) === String(currentUser.id);
                return (
                  <article className="user-card" key={member.id}>
                    <span className="avatar">
                      {(member.full_name || member.email || '?')
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                    <div className="member-identity">
                      <strong>
                        {member.full_name || 'Unnamed member'}{' '}
                        {self && <span className="badge">You</span>}
                      </strong>
                      <span>{member.email}</span>
                    </div>
                    <div className="member-role">
                      <label className="sr-only" htmlFor={`role-${member.id}`}>
                        Role for {member.full_name}
                      </label>
                      <select
                        id={`role-${member.id}`}
                        value={member.role}
                        disabled={busy || self}
                        title={
                          self
                            ? 'You cannot change your own role here.'
                            : undefined
                        }
                        onChange={(event) => {
                          setError('');
                          setRoleChange({ member, role: event.target.value });
                        }}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        type="button"
                        disabled={busy}
                        aria-label={`Edit ${member.full_name}`}
                        onClick={() => {
                          setError('');
                          setEditor({ user: member });
                        }}
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        className="icon-button danger-text"
                        type="button"
                        disabled={busy || self}
                        title={
                          self
                            ? 'Manage your own account in My profile.'
                            : undefined
                        }
                        aria-label={`Remove ${member.full_name}`}
                        onClick={() => {
                          setError('');
                          setDeleting(member);
                        }}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="empty-state">
                <FiUsers />
                <h3>No members found</h3>
                <p>Try another search or add a member to your service.</p>
              </div>
            )}
          </div>
        )}
      </div>
      <Modal
        open={Boolean(editor)}
        title={editor?.user ? 'Edit team member' : 'Add a team member'}
        onClose={() => setEditor(null)}
        busy={busy}
      >
        {editor && (
          <UserForm
            user={editor.user}
            onSave={save}
            onClose={() => setEditor(null)}
            busy={busy}
            error={error}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Remove this team member?"
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={busy}
        error={error}
        confirmText="Remove member"
      >
        <p>
          {deleting?.full_name} ({deleting?.email}) will lose access to this
          service.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(roleChange)}
        title="Change this member’s role?"
        onClose={() => setRoleChange(null)}
        onConfirm={changeRole}
        busy={busy}
        error={error}
        confirmText="Change role"
      >
        <p>
          Change {roleChange?.member.full_name} to{' '}
          <strong>{roleLabel(roleChange?.role)}</strong>? Their permissions will
          change.
        </p>
      </ConfirmDialog>
    </section>
  );
}
