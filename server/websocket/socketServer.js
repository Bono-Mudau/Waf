import { Server } from 'socket.io';
import { parse } from 'cookie';

export function setupWebSocket(httpServer, { auth, config }) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.origins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 32768,
    allowRequest: (req, done) =>
      done(
        null,
        !req.headers.origin || config.origins.includes(req.headers.origin)
      ),
  });
  io.use(async (socket, next) => {
    try {
      const token = parse(socket.request.headers.cookie || '').token;
      const session = await auth.authenticate(token);
      socket.data.session = session;
      socket.data.token = token;
      next();
    } catch {
      next(new Error('Authentication required.'));
    }
  });
  io.on('connection', (socket) => {
    const session = socket.data.session;
    socket.join(`service:${session.user.service_id}`);
    socket.join(`user:${session.user.id}`);
    socket.join(`session:${session.tokenHash}`);
    const timer = setInterval(async () => {
      try {
        const current = await auth.authenticate(socket.data.token);
        if (String(current.user.service_id) !== String(session.user.service_id))
          socket.disconnect(true);
      } catch {
        socket.disconnect(true);
      }
    }, 15000);
    timer.unref();
    socket.on('disconnect', () => clearInterval(timer));
    socket.emit('connection-status', { status: 'connected' });
  });
  return {
    io,
    sendBlockedRequest(log) {
      io.to(`service:${log.service_id}`).emit('incident-log', log);
    },
    disconnect({ user, session }) {
      if (user) io.in(`user:${user}`).disconnectSockets(true);
      if (session) io.in(`session:${session}`).disconnectSockets(true);
    },
    close() {
      return new Promise((resolve) => io.close(resolve));
    },
  };
}
