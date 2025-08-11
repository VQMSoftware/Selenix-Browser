import { existsSync, promises as fs } from 'fs';
import { resolve, join } from 'path';
import fetch from 'node-fetch';

import { ElectronBlocker, Request } from '@cliqz/adblocker-electron';
import { getPath } from '~/utils';
import { Application } from '../application';
import { ipcMain } from 'electron';

export let engine: ElectronBlocker;

const PRELOAD_PATH = join(__dirname, './preload.js');

const loadFilters = async () => {
  const path = resolve(getPath('adblock/cache.dat'));

  const downloadFilters = async () => {
    // Load lists to perform ads and tracking blocking:
    //
    //  - https://easylist.to/easylist/easylist.txt
    //  - https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=1&mimetype=plaintext
    //  - https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/resource-abuse.txt
    //  - https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt
    //  - https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt
    //  - https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/unbreak.txt
    //
    //  - https://easylist.to/easylist/easyprivacy.txt
    //  - https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt
    engine = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);

    try {
      await fs.writeFile(path, engine.serialize());
    } catch (err) {
      if (err) return console.error(err);
    }
  };

  if (existsSync(path)) {
    try {
      const buffer = await fs.readFile(resolve(path));

      try {
        engine = ElectronBlocker.deserialize(buffer);
      } catch (e) {
        return downloadFilters();
      }
    } catch (err) {
      return console.error(err);
    }
  } else {
    return downloadFilters();
  }
};

const emitBlockedEvent = (request: Request) => {
  const win = Application.instance.windows.findByBrowserView(request.tabId);
  if (!win) return;
  win.viewManager.views.get(request.tabId).emitEvent('blocked-ad');
};

let adblockRunning = false;
let adblockInitialized = false;

interface IAdblockInfo {
  headersReceivedId?: number;
  beforeRequestId?: number;
}

const sessionAdblockInfoMap: Map<Electron.Session, IAdblockInfo> = new Map();

export const runAdblockService = async (ses: any) => {
  if (!adblockInitialized) {
    adblockInitialized = true;
    await loadFilters();
  }

  if (adblockInitialized && !engine) {
    return;
  }

  if (adblockRunning) return;

  adblockRunning = true;

  const info = sessionAdblockInfoMap.get(ses) || {};

  if (!info.headersReceivedId) {
    info.headersReceivedId = ses.webRequest.addListener(
      'onHeadersReceived',
      { urls: ['<all_urls>'] },
      (engine as any).onHeadersReceived,
      { order: 0 },
    ).id;
  }

  if (!info.beforeRequestId) {
    info.beforeRequestId = ses.webRequest.addListener(
      'onBeforeRequest',
      { urls: ['<all_urls>'] },
      (engine as any).onBeforeRequest,
      { order: 0 },
    ).id;
  }

  sessionAdblockInfoMap.set(ses, info);

  ipcMain.on('get-cosmetic-filters', (engine as any).onGetCosmeticFilters);
  ipcMain.on(
    'is-mutation-observer-enabled',
    (engine as any).onIsMutationObserverEnabled,
  );

  // Electron 35+ deprecated session.getPreloads/setPreloads. New APIs
  // registerPreloadScript/unregisterPreloadScript/getPreloadScripts should be
  // used instead. We detect which API is available at runtime and choose the
  // appropriate method. If neither API is available we silently skip adding
  // the preload script.
  try {
    if (typeof ses.registerPreloadScript === 'function') {
      // Check if the script is already registered to avoid duplicates. The
      // returned array contains objects with id and filePath properties.
      const existing = typeof ses.getPreloadScripts === 'function'
        ? await ses.getPreloadScripts()
        : [];
      const alreadyRegistered = existing.some(
        (p: any) => p.filePath === PRELOAD_PATH || p.id === 'adblock',
      );
      if (!alreadyRegistered) {
        await ses.registerPreloadScript({
          id: 'adblock',
          filePath: PRELOAD_PATH,
          // Preload into the frame context. This matches the old behaviour of
          // setPreloads().
          type: 'frame',
        });
      }
    } else if (typeof ses.setPreloads === 'function') {
      // Fall back to deprecated API. Ensure the result is iterable before
      // concatenating. Some Electron versions changed the return type of
      // getPreloads() from array to undefined or another structure, which
      // causes TypeError: object is not iterable. We coerce to an array here.
      const existing: any[] = Array.isArray(ses.getPreloads?.())
        ? ses.getPreloads()
        : [];
      if (!existing.includes(PRELOAD_PATH)) {
        ses.setPreloads(existing.concat([PRELOAD_PATH]));
      }
    }
  } catch (e) {
    console.warn('Failed to register adblock preload script:', e);
  }

  engine.on('request-blocked', emitBlockedEvent);
  engine.on('request-redirected', emitBlockedEvent);
};

export const stopAdblockService = (ses: any) => {
  if (!ses.webRequest.removeListener) return;
  if (!adblockRunning) return;

  adblockRunning = false;

  const info = sessionAdblockInfoMap.get(ses) || {};

  if (info.beforeRequestId) {
    ses.webRequest.removeListener('onBeforeRequest', info.beforeRequestId);
    info.beforeRequestId = null;
  }

  if (info.headersReceivedId) {
    ses.webRequest.removeListener('onHeadersReceived', info.headersReceivedId);
    info.headersReceivedId = null;
  }

  try {
    if (typeof ses.unregisterPreloadScript === 'function') {
      ses.unregisterPreloadScript('adblock');
    } else if (typeof ses.setPreloads === 'function') {
      const existing: any[] = Array.isArray(ses.getPreloads?.())
        ? ses.getPreloads()
        : [];
      if (existing.includes(PRELOAD_PATH)) {
        ses.setPreloads(existing.filter((p: string) => p !== PRELOAD_PATH));
      }
    }
  } catch (e) {
    console.warn('Failed to unregister adblock preload script:', e);
  }
};
