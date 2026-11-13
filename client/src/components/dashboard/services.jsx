import { useState } from 'react';
import {
  FiBookOpen,
  FiCheck,
  FiCopy,
  FiEdit2,
  FiKey,
  FiRefreshCw,
  FiServer,
  FiTerminal,
} from 'react-icons/fi';
import useAuth from '../../hooks/useAuth';
import useResource from '../../hooks/useResource';
import {
  formatTimestamp,
  getService,
  updateService,
  createServiceKey,
  revokeServiceKey,
} from '../../services/dashboardServices';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal, { ConfirmDialog } from '../common/Modal';
import Notice from '../common/Notice';
import Loader from '../common/Loader';
import '../../styles/service.css';

function ServiceForm({ service, busy, error, onSave, onClose }) {
  const [name, setName] = useState(service.service_name || service.name || '');
  const [invalid, setInvalid] = useState('');
  return (
    <form
      className="stack-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) {
          setInvalid('Enter a service name.');
          return;
        }
        setInvalid('');
        onSave({ service_name: name.trim() });
      }}
    >
      <Notice>{error}</Notice>
      <Input
        label="Service name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={120}
        error={invalid}
        required
        disabled={busy}
      />
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" busy={busy}>
          Save service
        </Button>
      </div>
    </form>
  );
}

export default function Service() {
  const { isAdmin, user, setUser } = useAuth();
  const resource = useResource(getService);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newKey, setNewKey] = useState('');
  const [keyAction, setKeyAction] = useState(null);
  const service = resource.data;
  const keys = service?.api_keys || [];
  async function manageKey() {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (keyAction.type === 'revoke') {
        await revokeServiceKey(keyAction.id);
        setSuccess('API key revoked.');
      } else {
        const result = await createServiceKey(keyAction.type === 'rotate');
        setNewKey(result.api_key);
        setSuccess(
          'API key created. Copy it now; it cannot be retrieved later.'
        );
      }
      setKeyAction(null);
      resource.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function save(body) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await updateService(body);
      setUser((previous) => ({
        ...previous,
        service: {
          ...previous.service,
          name: body.service_name,
          service_name: body.service_name,
        },
      }));
      setEditing(false);
      setSuccess('Service details updated.');
      resource.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(String(text));
      setSuccess(`${label} copied.`);
      setError('');
    } catch {
      setError(
        'Clipboard access is unavailable. Select and copy the text manually.'
      );
    }
  }
  return (
    <section className="workspace-section">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR APPLICATION’S WORKSPACE</span>
          <h1>Manage service</h1>
          <p>View service details and prepare your middleware integration.</p>
        </div>
        <Button
          variant="secondary"
          onClick={resource.refresh}
          busy={resource.loading}
        >
          <FiRefreshCw /> Refresh
        </Button>
      </div>
      <Notice onRetry={resource.refresh}>{resource.error}</Notice>
      {!editing && !keyAction && <Notice>{error}</Notice>}
      <Notice type="success" onDismiss={() => setSuccess('')}>
        {success}
      </Notice>
      {resource.loading && !service ? (
        <Loader text="Loading service details…" />
      ) : (
        service && (
          <div className="service-grid">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    <FiServer /> Service details
                  </h2>
                  <p>
                    One service can have multiple administrators and developers.
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setError('');
                      setEditing(true);
                    }}
                  >
                    <FiEdit2 /> Edit
                  </Button>
                )}
              </div>
              <dl className="details-grid service-details">
                <div>
                  <dt>Service name</dt>
                  <dd>
                    {service.service_name || service.name || 'Unnamed service'}
                  </dd>
                </div>
                <div>
                  <dt>Service ID</dt>
                  <dd className="mono">
                    {service.id ?? user.service_id ?? 'Unavailable'}
                  </dd>
                </div>
                <div>
                  <dt>Registered</dt>
                  <dd>
                    {service.created_at
                      ? formatTimestamp(service.created_at)
                      : 'Unavailable'}
                  </dd>
                </div>
                <div>
                  <dt>Your access</dt>
                  <dd>{isAdmin ? 'Administrator' : 'Service member'}</dd>
                </div>
              </dl>
            </div>
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    <FiKey /> Service credentials
                  </h2>
                  <p>For your application’s backend integration.</p>
                </div>
              </div>
              <div className="panel-body">
                {!isAdmin ? (
                  <p className="muted">
                    Ask your service administrator for integration credentials.
                  </p>
                ) : (
                  <>
                    {newKey && (
                      <div className="new-key-box">
                        <Input
                          label="New service API key (shown once)"
                          type="password"
                          value={newKey}
                          readOnly
                          autoComplete="off"
                        />
                        <div className="row-actions">
                          <Button
                            variant="secondary"
                            onClick={() => copy(newKey, 'Service API key')}
                          >
                            <FiCopy /> Copy new key
                          </Button>
                          <Button variant="ghost" onClick={() => setNewKey('')}>
                            Dismiss
                          </Button>
                        </div>
                        <p className="field-hint">
                          Copy this key before leaving the page. Only its hash
                          is stored.
                        </p>
                      </div>
                    )}
                    <div className="key-list">
                      {keys.length ? (
                        keys.map((key) => (
                          <div className="key-record" key={key.id}>
                            <div>
                              <code>{key.key_prefix}…</code>
                              <small className="muted">
                                {key.is_active ? 'Active' : 'Revoked'} · Created{' '}
                                {formatTimestamp(key.created_at)}
                              </small>
                            </div>
                            {key.is_active && (
                              <Button
                                variant="ghost"
                                disabled={busy}
                                onClick={() => {
                                  setError('');
                                  setKeyAction({ type: 'revoke', id: key.id });
                                }}
                              >
                                Revoke
                              </Button>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="muted">
                          Create an API key to connect your application in
                          hybrid mode.
                        </p>
                      )}
                    </div>
                    <div className="row-actions">
                      <Button
                        disabled={busy}
                        onClick={() => {
                          setError('');
                          setKeyAction({ type: 'create' });
                        }}
                      >
                        Create API key
                      </Button>
                      {keys.some((key) => key.is_active) && (
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            setError('');
                            setKeyAction({ type: 'rotate' });
                          }}
                        >
                          Rotate all keys
                        </Button>
                      )}
                    </div>
                    <p className="muted small">
                      Store this key in your application server’s environment.
                      Share it only with authorised team members.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      )}
      <div className="panel service-setup">
        <div className="panel-heading">
          <div>
            <h2>
              <FiBookOpen /> Integration checklist
            </h2>
            <p>
              Configure the middleware in the application you want to protect.
            </p>
          </div>
        </div>
        <div className="panel-body setup-columns">
          <div>
            <ol className="setup-list">
              <li>
                <strong>Mount after body parsers.</strong>
                <span>
                  Parse JSON and form bodies before passing requests through
                  SQLiShield.
                </span>
              </li>
              <li>
                <strong>Place before protected routes.</strong>
                <span>
                  The middleware needs to inspect requests before your
                  application handlers execute.
                </span>
              </li>
              <li>
                <strong>Choose your operating mode.</strong>
                <span>
                  Local logs to the console. Hybrid combines console logging
                  with dashboard events.
                </span>
              </li>
              <li>
                <strong>Check service authentication.</strong>
                <span>
                  Use your middleware’s documented API key and connection
                  options for hybrid mode.
                </span>
              </li>
            </ol>
          </div>
          <div>
            <div className="code-panel">
              <div className="code-panel-heading">
                <FiTerminal /> Middleware configuration
              </div>
              <pre>
                <code>{`import { mywaf } from "../server/waf/waf.js";\n\napp.use(express.json());\napp.use(express.urlencoded({ extended: true }));\n\napp.use(mywaf({\n  mode: "hybrid",\n  strict: "normal",\n  apiKey: process.env.SQLISHIELD_API_KEY,\n  backendUrl: process.env.SQLISHIELD_BACKEND_URL\n}));\n\napp.use("/api", applicationRoutes);`}</code>
              </pre>
            </div>
            <p className="muted small">
              Adjust the relative import for your application. Use local mode
              without a key for console-only inspection.
            </p>
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Strictness reference</h2>
            <p>
              Set strictness in your application’s middleware configuration.
            </p>
          </div>
          <FiCheck className="teal-text" />
        </div>
        <div className="strictness-grid">
          <div>
            <span className="badge">Low</span>
            <strong>40</strong>
            <p>Higher score needed to block.</p>
          </div>
          <div>
            <span className="badge badge-info">Normal</span>
            <strong>25</strong>
            <p>Default detection threshold.</p>
          </div>
          <div>
            <span className="badge badge-warning">High</span>
            <strong>15</strong>
            <p>Lower score needed to block.</p>
          </div>
        </div>
      </div>
      <Modal
        open={editing && Boolean(service)}
        title="Edit service details"
        onClose={() => setEditing(false)}
        busy={busy}
      >
        {editing && service && (
          <ServiceForm
            service={service}
            onSave={save}
            onClose={() => setEditing(false)}
            busy={busy}
            error={error}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(keyAction)}
        title={
          keyAction?.type === 'revoke'
            ? 'Revoke this API key?'
            : keyAction?.type === 'rotate'
              ? 'Replace all active API keys?'
              : 'Create a service API key?'
        }
        onClose={() => setKeyAction(null)}
        onConfirm={manageKey}
        busy={busy}
        error={error}
        confirmText={
          keyAction?.type === 'revoke'
            ? 'Revoke key'
            : keyAction?.type === 'rotate'
              ? 'Rotate keys'
              : 'Create key'
        }
      >
        <p>
          {keyAction?.type === 'revoke'
            ? 'Applications using this key will lose access to service rules and telemetry delivery.'
            : keyAction?.type === 'rotate'
              ? 'All existing keys will be revoked. Update your protected applications with the new key.'
              : 'The new key will be displayed once. Store it in your protected application’s server environment.'}
        </p>
      </ConfirmDialog>
    </section>
  );
}
