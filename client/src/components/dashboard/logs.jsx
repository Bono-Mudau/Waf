import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FiRefreshCw, FiSearch } from 'react-icons/fi';
import useResource from '../../hooks/useResource';
import {
  listLogs,
  mergeLogs,
  formatTimestamp,
} from '../../services/dashboardServices';
import Button from '../ui/Button';
import Table from '../ui/Table';
import Notice from '../common/Notice';
import Loader from '../common/Loader';
import LogDetails from '../common/LogDetails';
import '../../styles/logs.css';

export default function Logs() {
  const { live } = useOutletContext();
  const saved = useResource(listLogs);
  const [range, setRange] = useState('24');
  const [decision, setDecision] = useState('all');
  const [attack, setAttack] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const logs = mergeLogs(live.logs, saved.data || []);
  const cutoff = range === 'all' ? 0 : now - Number(range) * 3600000;
  const filtered = logs.filter(
    (log) =>
      (!cutoff || Date.parse(log.timestamp) >= cutoff) &&
      (decision === 'all' || log.decision === decision) &&
      (attack === 'all' || log.attackType === attack) &&
      `${log.ip} ${log.path} ${log.id} ${log.method}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pages);
  const filter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };
  return (
    <section className="workspace-section Logs">
      <div className="page-heading">
        <div>
          <span className="eyebrow">INSPECT. UNDERSTAND. RESPOND.</span>
          <h1>Incident logs</h1>
          <p>Review saved incidents alongside new events from your service.</p>
        </div>
        <Button
          variant="secondary"
          onClick={saved.refresh}
          busy={saved.loading}
        >
          <FiRefreshCw /> Refresh logs
        </Button>
      </div>
      <Notice onRetry={saved.refresh}>{saved.error}</Notice>
      <div className="panel">
        <div id="logs-filter" className="filter-bar">
          <div className="search-field">
            <label htmlFor="log-search" className="sr-only">
              Search requests
            </label>
            <FiSearch aria-hidden="true" />
            <input
              id="log-search"
              value={search}
              onChange={filter(setSearch)}
              placeholder="Search IP, path, or request ID"
              type="search"
            />
          </div>
          <div className="filter-field">
            <label htmlFor="log-range">Time range</label>
            <select id="log-range" value={range} onChange={filter(setRange)}>
              <option value="24">Last 24 hours</option>
              <option value="48">Last 48 hours</option>
              <option value="72">Last 72 hours</option>
              <option value="168">Last 7 days</option>
              <option value="336">Last 14 days</option>
              <option value="672">Last 28 days</option>
              <option value="all">All loaded events</option>
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="log-decision">Decision</label>
            <select
              id="log-decision"
              value={decision}
              onChange={filter(setDecision)}
            >
              <option value="all">All decisions</option>
              <option value="BLOCK">Blocked</option>
              <option value="ALLOW">Allowed</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="log-attack">Attack type</label>
            <select id="log-attack" value={attack} onChange={filter(setAttack)}>
              <option value="all">All types</option>
              {[...new Set(logs.map((log) => log.attackType))]
                .sort()
                .map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="log-source-note">
          <span
            className={`connection-pill ${live.status === 'connected' ? 'is-connected' : ''}`}
          >
            <span className="status-dot" />
            {live.status === 'connected'
              ? 'Live updates connected'
              : 'Live stream unavailable'}
          </span>
          <span>
            Filters apply to the latest 200 saved events and this session’s live
            events.
          </span>
          {live.status !== 'connected' && (
            <Button variant="ghost" onClick={live.reconnect}>
              Reconnect
            </Button>
          )}
        </div>
        {saved.loading && !saved.data ? (
          <Loader text="Loading incident logs…" />
        ) : (
          <Table
            caption="Service incident logs"
            rows={filtered.slice((currentPage - 1) * 10, currentPage * 10)}
            emptyMessage={
              logs.length
                ? 'No requests match these filters.'
                : 'No saved or live incidents to display.'
            }
            columns={[
              {
                key: 'ip',
                label: 'IP address',
                render: (log) => <span className="mono">{log.ip}</span>,
              },
              {
                key: 'timestamp',
                label: 'Timestamp',
                render: (log) => formatTimestamp(log.timestamp),
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
              { key: 'attackType', label: 'Attack type' },
              { key: 'score', label: 'Score' },
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
        <div className="pagination">
          <span>
            {filtered.length} matching{' '}
            {filtered.length === 1 ? 'event' : 'events'} · Page {currentPage} of{' '}
            {pages}
          </span>
          <div>
            <Button
              variant="secondary"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= pages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
      <LogDetails log={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
