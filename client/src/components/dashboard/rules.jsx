import { useState } from 'react';
import {
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi';
import useAuth from '../../hooks/useAuth';
import useResource from '../../hooks/useResource';
import {
  createRule,
  deleteRule,
  listRules,
  updateRule,
} from '../../services/ruleServices';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Table from '../ui/Table';
import Modal, { ConfirmDialog } from '../common/Modal';
import Notice from '../common/Notice';
import Loader from '../common/Loader';
import '../../styles/rules.css';

function RuleForm({ rule, onSave, onClose, busy, error }) {
  const [form, setForm] = useState({
    name: rule?.name || '',
    pattern: rule?.pattern || '',
    match_type: rule?.match_type || 'keyword',
    score: rule?.score ?? 10,
    enabled: rule?.enabled ?? true,
    description: rule?.description || '',
  });
  const [errors, setErrors] = useState({});
  const change = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]:
        event.target.type === 'checkbox'
          ? event.target.checked
          : event.target.value,
    }));
  function submit(event) {
    event.preventDefault();
    const invalid = {};
    if (!form.name.trim()) invalid.name = 'Enter a rule name.';
    if (!form.pattern.trim()) invalid.pattern = 'Enter a detection pattern.';
    if (
      !Number.isInteger(Number(form.score)) ||
      Number(form.score) < 1 ||
      Number(form.score) > 100
    )
      invalid.score = 'Enter a whole number from 1 to 100.';
    if (form.match_type === 'regex' && form.pattern.trim()) {
      try {
        new RegExp(form.pattern);
      } catch {
        invalid.pattern =
          'Enter a valid regular expression, without enclosing slashes.';
      }
    }
    setErrors(invalid);
    if (!Object.keys(invalid).length)
      onSave({
        ...form,
        name: form.name.trim(),
        pattern: form.pattern.trim(),
        description: form.description.trim(),
        score: Number(form.score),
      });
  }
  return (
    <form onSubmit={submit} noValidate className="stack-form">
      <Notice>{error}</Notice>
      <Input
        label="Rule name"
        name="name"
        value={form.name}
        onChange={change}
        error={errors.name}
        maxLength={120}
        required
        disabled={busy}
      />
      <div className="form-field">
        <label htmlFor="rule-match-type">Match type</label>
        <select
          id="rule-match-type"
          name="match_type"
          value={form.match_type}
          onChange={change}
          disabled={busy}
        >
          <option value="keyword">Keyword</option>
          <option value="regex">Regular expression</option>
        </select>
      </div>
      <Input
        label="Detection pattern"
        name="pattern"
        value={form.pattern}
        onChange={change}
        error={errors.pattern}
        hint={
          form.match_type === 'regex'
            ? 'Enter the regex source only, without / delimiters or flags.'
            : 'Enter the keyword or phrase to detect.'
        }
        required
        disabled={busy}
      />
      <Input
        label="Score contribution"
        type="number"
        min="1"
        max="100"
        step="1"
        name="score"
        value={form.score}
        onChange={change}
        error={errors.score}
        required
        disabled={busy}
      />
      <div className="form-field">
        <label htmlFor="rule-description">
          Description <span className="muted">(optional)</span>
        </label>
        <textarea
          id="rule-description"
          name="description"
          value={form.description}
          onChange={change}
          maxLength={500}
          rows={3}
          disabled={busy}
        />
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="enabled"
          checked={form.enabled}
          onChange={change}
          disabled={busy}
        />
        Enable this rule
      </label>
      <div className="form-actions">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" busy={busy}>
          {rule ? 'Save rule' : 'Create rule'}
        </Button>
      </div>
    </form>
  );
}

export default function Rules() {
  const { isAdmin } = useAuth();
  const resource = useResource(listRules);
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const rules = resource.data || [];
  const filtered = rules.filter(
    (rule) =>
      (status === 'all' || rule.enabled === (status === 'enabled')) &&
      (source === 'all' || rule.isDefault === (source === 'default')) &&
      `${rule.name} ${rule.pattern}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  const openEditor = (rule) => {
    setError('');
    setEditor({ rule });
  };
  async function save(body) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (editor.rule) await updateRule(editor.rule.id, body);
      else await createRule(body);
      setEditor(null);
      setSuccess('The rule has been saved.');
      resource.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(rule) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await updateRule(rule.id, { enabled: !rule.enabled });
      setSuccess(
        `“${rule.name}” has been ${rule.enabled ? 'disabled' : 'enabled'}.`
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
      await deleteRule(deleting.id);
      setDeleting(null);
      setSuccess('The custom rule has been deleted.');
      resource.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="rules" className="workspace-section">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CONFIGURABLE DETECTION</span>
          <h1>Security rules</h1>
          <p>
            Review shared defaults and manage the custom rules for your service.
          </p>
        </div>
        <div className="heading-actions">
          <Button
            variant="secondary"
            onClick={resource.refresh}
            busy={resource.loading}
          >
            <FiRefreshCw /> Refresh
          </Button>
          {isAdmin && (
            <Button onClick={() => openEditor(null)}>
              <FiPlus /> Create rule
            </Button>
          )}
        </div>
      </div>
      <Notice onRetry={resource.refresh}>{resource.error}</Notice>
      {!editor && !deleting && <Notice>{error}</Notice>}
      <Notice type="success" onDismiss={() => setSuccess('')}>
        {success}
      </Notice>
      <div className="panel">
        <div className="filter-bar rules-filter">
          <div className="search-field">
            <label htmlFor="rule-search" className="sr-only">
              Search rules
            </label>
            <FiSearch />
            <input
              id="rule-search"
              type="search"
              placeholder="Search names or patterns"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="filter-field">
            <label htmlFor="rule-status">Status</label>
            <select
              id="rule-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="rule-source">Source</label>
            <select
              id="rule-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="all">All rules</option>
              <option value="default">Shared defaults</option>
              <option value="custom">Service custom rules</option>
            </select>
          </div>
        </div>
        <p className="table-description">
          Shared default rules are read-only.{' '}
          {isAdmin
            ? 'Changes apply to your service’s custom rules.'
            : 'Your administrator manages custom rules.'}
        </p>
        {resource.loading && !resource.data ? (
          <Loader text="Loading security rules…" />
        ) : (
          <Table
            caption="Security rules"
            rows={filtered}
            emptyMessage="No rules match the current filters."
            columns={[
              {
                key: 'name',
                label: 'Rule',
                render: (rule) => (
                  <div className="rule-name">
                    <strong>{rule.name}</strong>
                    <small>
                      {rule.isDefault ? 'Shared default' : 'Service custom'} · #
                      {rule.id}
                    </small>
                  </div>
                ),
              },
              {
                key: 'pattern',
                label: 'Pattern',
                render: (rule) => (
                  <code className="rule-pattern">{rule.pattern}</code>
                ),
              },
              { key: 'match_type', label: 'Match type' },
              { key: 'score', label: 'Score' },
              {
                key: 'enabled',
                label: 'Status',
                render: (rule) => (
                  <span
                    className={`badge ${rule.enabled ? 'badge-success' : ''}`}
                  >
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                ),
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (rule) =>
                  isAdmin && !rule.isDefault ? (
                    <div className="row-actions">
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => toggle(rule)}
                      >
                        {rule.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <button
                        className="icon-button"
                        type="button"
                        disabled={busy}
                        aria-label={`Edit ${rule.name}`}
                        onClick={() => openEditor(rule)}
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        className="icon-button danger-text"
                        type="button"
                        disabled={busy}
                        aria-label={`Delete ${rule.name}`}
                        onClick={() => {
                          setError('');
                          setDeleting(rule);
                        }}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  ) : (
                    <span className="muted small">Read-only</span>
                  ),
              },
            ]}
          />
        )}
      </div>
      <Modal
        open={Boolean(editor)}
        title={editor?.rule ? 'Edit custom rule' : 'Create a custom rule'}
        onClose={() => setEditor(null)}
        busy={busy}
      >
        {editor && (
          <RuleForm
            rule={editor.rule}
            onSave={save}
            onClose={() => setEditor(null)}
            busy={busy}
            error={error}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this custom rule?"
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={busy}
        error={error}
      >
        <p>
          “{deleting?.name}” will be removed from your service. This action
          cannot be undone.
        </p>
      </ConfirmDialog>
    </section>
  );
}
