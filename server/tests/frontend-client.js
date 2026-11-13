import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// Run the actual browser API service modules against the real test server.
// React/browser UI code is not emulated; the Vite build verifies that separately.
export async function frontendClient(base, origin) {
  const root = fileURLToPath(
    new URL('../../client/src/services/', import.meta.url)
  );
  const window = new EventTarget();
  window.location = { origin };
  let cookie = '';
  const context = vm.createContext({
    window,
    Event,
    URL,
    AbortSignal,
    console,
    fetch: async (url, options = {}) => {
      const headers = new Headers(options.headers);
      headers.set('Origin', origin);
      if (cookie) headers.set('Cookie', cookie);
      const response = await fetch(url, { ...options, headers });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      return response;
    },
  });
  const modules = new Map();
  async function load(filename) {
    const full = path.resolve(
      root,
      filename.endsWith('.js') ? filename : filename + '.js'
    );
    if (modules.has(full)) return modules.get(full);
    const module = new vm.SourceTextModule(await readFile(full, 'utf8'), {
      context,
      identifier: full,
      initializeImportMeta(meta) {
        meta.env = { VITE_API_BASE_URL: base + '/api', VITE_SOCKET_URL: base };
      },
    });
    modules.set(full, module);
    await module.link((specifier) =>
      load(path.resolve(path.dirname(full), specifier))
    );
    return module;
  }
  const result = {};
  for (const name of [
    'authServices',
    'userServices',
    'ruleServices',
    'dashboardServices',
  ]) {
    const module = await load(name);
    if (module.status !== 'evaluated') await module.evaluate();
    result[name] = module.namespace;
  }
  return result;
}
