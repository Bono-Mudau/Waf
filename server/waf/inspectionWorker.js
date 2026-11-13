import { parentPort } from 'node:worker_threads';
import detectionEngine from './detectionEngine.js';
parentPort.on('message', ({ id, record, rules }) => {
  try {
    parentPort.postMessage({
      id,
      result: detectionEngine.detect(record, rules),
    });
  } catch {
    parentPort.postMessage({ id, error: 'Inspection failed.' });
  }
});
