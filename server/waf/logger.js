export function createLogSender({
  backendUrl,
  apiKey,
  fetchFn = fetch,
  logger = console,
}) {
  const queue = [];
  const active = new Set();
  const waiters = [];
  let closed = false;
  let warningAt = 0;
  const warn = () => {
    if (Date.now() - warningAt > 30000) {
      warningAt = Date.now();
      logger.warn(
        'SQLiShield telemetry is unavailable or at capacity; console inspection continues.'
      );
    }
  };
  function notify() {
    if (!queue.length && !active.size) while (waiters.length) waiters.shift()();
  }
  async function send(event, controller) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetchFn(`${backendUrl}/api/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
          body: JSON.stringify(event),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(3000),
          ]),
        });
        await response.arrayBuffer();
        if (response.ok) return;
        if (response.status < 500) break;
      } catch {
        if (controller.signal.aborted) break;
      }
    }
    warn();
  }
  function pump() {
    while (!closed && active.size < 4 && queue.length) {
      const event = queue.shift();
      const controller = new AbortController();
      active.add(controller);
      void send(event, controller).finally(() => {
        active.delete(controller);
        pump();
        notify();
      });
    }
    notify();
  }
  return {
    enqueue(event) {
      if (closed) return;
      if (queue.length >= 256) {
        warn();
        return;
      }
      queue.push(event);
      pump();
    },
    flush() {
      return !queue.length && !active.size
        ? Promise.resolve()
        : new Promise((resolve) => waiters.push(resolve));
    },
    async close() {
      closed = true;
      queue.length = 0;
      for (const controller of active) controller.abort();
      await this.flush();
    },
  };
}
