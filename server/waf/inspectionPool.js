import { Worker } from 'node:worker_threads';

// Regex execution stays outside the HTTP event loop and has a hard time budget.
export class InspectionPool {
  constructor({ timeout = 100, maxQueue = 64 } = {}) {
    this.timeout = timeout;
    this.maxQueue = maxQueue;
    this.queue = [];
    this.worker = null;
    this.active = null;
    this.ready = false;
    this.nextId = 0;
    this.closed = false;
  }
  inspect(record, rules) {
    return new Promise((resolve, reject) => {
      if (this.closed || this.queue.length >= this.maxQueue)
        return reject(new Error('Inspection capacity exceeded.'));
      this.queue.push({ id: ++this.nextId, record, rules, resolve, reject });
      this.start();
    });
  }
  start() {
    if (this.closed) return;
    if (!this.worker) {
      const worker = new Worker(
        new URL('./inspectionWorker.js', import.meta.url),
        { resourceLimits: { maxOldGenerationSizeMb: 64 } }
      );
      this.worker = worker;
      worker.once('online', () => {
        if (this.worker === worker) {
          this.ready = true;
          this.start();
        }
      });
      worker.on('message', (message) => {
        if (
          this.worker !== worker ||
          !this.active ||
          this.active.id !== message.id
        )
          return;
        const job = this.active;
        this.active = null;
        clearTimeout(job.timer);
        if (message.error) job.reject(new Error(message.error));
        else job.resolve(message.result);
        worker.unref();
        this.start();
      });
      worker.on('error', () => this.fail(worker, 'Inspection worker failed.'));
      worker.on('exit', () => {
        if (this.worker === worker)
          this.fail(worker, 'Inspection worker stopped.');
      });
      if (this.queue.length) worker.ref();
      else worker.unref();
    }
    if (!this.ready || this.active || !this.queue.length) return;
    const job = this.queue.shift();
    this.active = job;
    this.worker.ref();
    const worker = this.worker;
    job.timer = setTimeout(
      () => this.fail(worker, 'Inspection time limit exceeded.'),
      this.timeout
    );
    this.worker.postMessage({
      id: job.id,
      record: job.record,
      rules: job.rules,
    });
  }
  fail(worker, message) {
    if (this.worker !== worker) return;
    this.worker = null;
    this.ready = false;
    if (this.active) {
      clearTimeout(this.active.timer);
      this.active.reject(new Error(message));
      this.active = null;
    }
    void worker.terminate();
    if (this.queue.length) this.start();
  }
  async close() {
    this.closed = true;
    for (const job of this.queue) job.reject(new Error('Inspection stopped.'));
    this.queue = [];
    if (this.active) {
      clearTimeout(this.active.timer);
      this.active.reject(new Error('Inspection stopped.'));
      this.active = null;
    }
    const worker = this.worker;
    this.worker = null;
    if (worker) await worker.terminate();
  }
}
