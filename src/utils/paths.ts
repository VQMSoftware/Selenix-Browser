import { resolve } from 'path';
import { app } from 'electron';

/**
 * Returns a path inside the application's userData directory. In a renderer
 * process we must obtain the `app` module via the `@electron/remote` package.
 * Importing `@electron/remote` at module scope is disallowed in the main
 * process, so we resolve it dynamically only when running in a renderer
 * context. If neither remote nor the main `app` module is available, `null`
 * is returned.
 *
 * @param relativePaths additional segments to append to the base userData path
 */
export const getPath = (...relativePaths: string[]) => {
  let basePath: string | undefined;
  // If we're in a renderer process, require @electron/remote to get the app.
  if (typeof process !== 'undefined' && process.type === 'renderer') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const remote = require('@electron/remote');
      basePath = remote.app.getPath('userData');
    } catch (e) {
      // Ignore any errors; we'll fall back to using the main process app below.
    }
  }
  // Fallback to using the app from the main process. In a renderer without
  // nodeIntegration this will be undefined, which is fine.
  if (!basePath && app) {
    basePath = app.getPath('userData');
  }
  if (!basePath) {
    return null;
  }
  return resolve(basePath, ...relativePaths).replace(/\\/g, '/');
};
