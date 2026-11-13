import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  FiActivity,
  FiArrowRight,
  FiClock,
  FiRefreshCw,
  FiShield,
  FiSlash,
} from 'react-icons/fi';
import useAuth from '../../hooks/useAuth';
import useResource from '../../hooks/useResource';
import { getSummary, formatTimestamp } from '../../services/dashboardServices';
import Loader from '../common/Loader';
import Notice from '../common/Notice';
import LogDetails from '../common/LogDetails';
import Table from '../ui/Table';
import Button from '../ui/Button';

const number = (value) =>
  value == null || !Number.isFinite(Number(value))
    ? '—'
    : Number(value).toLocaleString();
export default function Overview() {
  const { user } = useAuth();
  const { live } = useOutletContext();
  const summary = useResource(getSummary);
  const [selected, setSelected] = useState(null);
  const cards = [
    [
      'Requests inspected',
      number(summary.data?.total_inspected ?? summary.data?.totalInspected),
      FiActivity,
      'info',
    ],
    [
      'Requests blocked',
      number(summary.data?.total_blocked ?? summary.data?.totalBlocked),
      FiSlash,
      'danger',
    ],
    [
      'Average inspection latency',
      summary.data?.average_latency_ms != null
        ? `${number(summary.data.average_latency_ms)} ms`
        : '—',
      FiClock,
      'purple',
    ],
    [
      'Active security rules',
      number(summary.data?.active_rules ?? summary.data?.activeRules),
      FiShield,
      'success',
    ],
  ];
  return (
    <section id="Overview" className="workspace-section">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SECURITY WORKSPACE</span>
          <h1>Overview</h1>
          <p>
            Welcome back, {(user.full_name || 'there').split(' ')[0]}. Here’s
            your service at a glance.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={summary.refresh}
          busy={summary.loading}
        >
          <FiRefreshCw /> Refresh summary
        </Button>
      </div>
      <Notice onRetry={summary.refresh}>{summary.error}</Notice>
      <div className="dashboard-summary">
        {cards.map(([label, value, Icon, color]) => (
          <article className={`summary-card summary-${color}`} key={label}>
            <div>
              <span className="summary-label">{label}</span>
              <Icon aria-hidden="true" />
            </div>
            <strong>{summary.loading && !summary.data ? '…' : value}</strong>
          </article>
        ))}
      </div>
      <p className="muted small summary-caption">
        {summary.data?.period_label ||
          'Totals are supplied by your service API. An em dash means a metric is unavailable.'}
      </p>
      <div className="panel Live-log">
        <div className="panel-heading">
          <div>
            <h2>Live incident logs</h2>
            <p>New events received during this session.</p>
          </div>
          <span
            className={`connection-pill ${live.status === 'connected' ? 'is-connected' : ''}`}
            role="status"
          >
            <span className="status-dot" />
            {live.status === 'connected'
              ? 'Live connection'
              : live.status === 'connecting'
                ? 'Connecting…'
                : 'Live unavailable'}
          </span>
        </div>
        {live.status !== 'connected' && live.status !== 'connecting' && (
          <Notice type="info" onRetry={live.reconnect}>
            The live stream is unavailable. You can still review saved incidents
            from the logs page.
          </Notice>
        )}
        {live.status === 'connecting' && !live.logs.length ? (
          <Loader text="Connecting to the live stream…" />
        ) : (
          <Table
            caption="Live incident logs"
            rows={live.logs.slice(0, 8)}
            emptyMessage="No live incidents received yet. New service events will appear here."
            columns={[
              {
                key: 'timestamp',
                label: 'Received',
                render: (log) => formatTimestamp(log.timestamp),
              },
              {
                key: 'ip',
                label: 'IP address',
                render: (log) => <span className="mono">{log.ip}</span>,
              },
              {
                key: 'path',
                label: 'Request',
                render: (log) => (
                  <span className="request-path" title={log.path}>
                    <span className="method-tag">{log.method}</span> {log.path}
                  </span>
                ),
              },
              {
                key: 'decision',
                label: 'Decision',
                render: (log) => (
                  <span
                    className={`badge ${log.decision === 'BLOCK' ? 'badge-danger' : log.decision === 'ALLOW' ? 'badge-success' : ''}`}
                  >
                    {log.decision}
                  </span>
                ),
              },
              {
                key: 'details',
                label: 'Details',
                render: (log) => (
                  <Button variant="ghost" onClick={() => setSelected(log)}>
                    View payload
                  </Button>
                ),
              },
            ]}
          />
        )}
        <Link className="panel-footer-link" to="/dashboard/logs">
          Open incident logs <FiArrowRight />
        </Link>
      </div>
      <div className="overview-tip">
        <FiShield />
        <div>
          <h3>Make the rules fit your application</h3>
          <p>
            Review default rules, add service-specific patterns, and use
            incident details to understand why a request was blocked.
          </p>
        </div>
        <Link className="text-link" to="/dashboard/rules">
          Review rules <FiArrowRight />
        </Link>
      </div>
      <LogDetails log={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
