import dotenv from 'dotenv';
import { io } from 'socket.io-client';
dotenv.config({ quiet: true });
// Supply an existing dashboard session cookie privately through the environment.
// No test bypass, service-key socket authentication, or demo credentials are shipped.
if (!process.env.DASHBOARD_SESSION_COOKIE)
  throw new Error(
    'Set DASHBOARD_SESSION_COOKIE to an existing dashboard session cookie for this test.'
  );
const socket = io(
  process.env.SQLISHIELD_BACKEND_URL || 'http://localhost:3000',
  {
    extraHeaders: { Cookie: process.env.DASHBOARD_SESSION_COOKIE },
    reconnection: false,
  }
);
socket.on('connect', () =>
  console.log('Authenticated dashboard socket connected.')
);
socket.on('incident-log', (event) =>
  console.log({
    requestID: event.requestID,
    decision: event.decision,
    timestamp: event.timestamp,
  })
);
socket.on('connect_error', () => {
  console.error('Socket authentication or connection failed.');
  socket.disconnect();
  process.exitCode = 1;
});
process.once('SIGINT', () => socket.disconnect());
