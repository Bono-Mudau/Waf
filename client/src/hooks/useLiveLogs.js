import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../services/apiClient';
import { normalizeLog } from '../services/dashboardServices';

export default function useLiveLogs(serviceId) {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('connecting');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      timeout: 10000,
      reconnectionAttempts: 5,
    });
    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('unavailable'));
    socket.on('incident-log', (event) => {
      if (!event || typeof event !== 'object') return;
      const log = normalizeLog(event);
      // The backend must authenticate the socket and broadcast only into that service's room.
      if (
        log.service_id != null &&
        serviceId != null &&
        String(log.service_id) !== String(serviceId)
      )
        return;
      setLogs((previous) =>
        previous.some((item) => String(item.id) === String(log.id))
          ? previous
          : [log, ...previous].slice(0, 100)
      );
    });
    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [serviceId, attempt]);
  return {
    logs,
    status,
    reconnect: () => {
      setStatus('connecting');
      setAttempt((value) => value + 1);
    },
  };
}
