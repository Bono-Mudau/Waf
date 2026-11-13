import Modal from './Modal';
import { formatTimestamp } from '../../services/dashboardServices';

export default function LogDetails({ log, onClose }) {
  return (
    <Modal open={Boolean(log)} title="Request details" onClose={onClose}>
      {log && (
        <>
          <dl className="details-grid">
            <div>
              <dt>Request ID</dt>
              <dd className="mono">{log.id}</dd>
            </div>
            <div>
              <dt>Received</dt>
              <dd>{formatTimestamp(log.timestamp)}</dd>
            </div>
            <div>
              <dt>Decision</dt>
              <dd>
                <span
                  className={`badge ${log.decision === 'BLOCK' ? 'badge-danger' : log.decision === 'ALLOW' ? 'badge-success' : ''}`}
                >
                  {log.decision}
                </span>
              </dd>
            </div>
            <div>
              <dt>Detection score</dt>
              <dd>{log.score ?? 'Unavailable'}</dd>
            </div>
          </dl>
          <p className="muted small">
            Sensitive fields are hidden in this view. Review request details
            before sharing them.
          </p>
          <pre className="payload-view" tabIndex={0}>
            {JSON.stringify(log.details, null, 2)}
          </pre>
        </>
      )}
    </Modal>
  );
}
