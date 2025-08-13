import { app, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import { Application } from '../application';

/**
 * Click-to-update (no progress UI):
 * - We never auto-download.
 * - On click: start download; when downloaded, quit & install immediately.
 * - Any error → native system popup (dialog.showErrorBox) + renderer event.
 */
export const runAutoUpdaterService = () => {
  // Some setups don't expose EventEmitter typing on AppUpdater – use a loose alias.
  const updater = autoUpdater as any;

  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;

  if (!app.isPackaged) {
    // Let dev builds read dev-app-update.yml if present.
    try {
      updater.forceDevUpdateConfig = true;
    } catch {}
  }

  let hasUpdate = false;
  let isDownloaded = false;
  let installRequested = false;

  const broadcast = (channel: string, ...args: any[]) => {
    // Send to all BrowserWindows
    for (const w of Application.instance.windows.list) {
      try {
        w.send(channel, ...args);
      } catch {}
    }
    // And to your menu WebContentsView, if any
    try {
      Application.instance.dialogs
        .getDynamic('menu')
        ?.webContentsView?.webContents?.send(channel, ...args);
    } catch {}
  };

  const showError = (message: string) => {
    try {
      dialog.showErrorBox('Update Error', message);
    } catch {}
  };

  const reportError = (err: unknown, context?: string) => {
    const base = err instanceof Error ? err.message : String(err);
    const msg = context ? `${context}\n\n${base}` : base;
    broadcast('update-error', msg);
    showError(msg);
  };

  // --- updater events (minimal) ---
  updater.on('error', (err: unknown) => {
    hasUpdate = false;
    isDownloaded = false;
    reportError(err, 'Updater emitted an error');
  });

  updater.on('update-available', () => {
    hasUpdate = true;
    isDownloaded = false;
    broadcast('update-available');
  });

  updater.on('update-not-available', () => {
    hasUpdate = false;
    isDownloaded = false;
    broadcast('update-not-available');

    // If user clicked and there is in fact no update, tell them why nothing happened.
    if (installRequested) {
      installRequested = false;
      showError(
        `No update available.\nYou're already on version ${app.getVersion()}.`
      );
    }
  });

  // Install immediately after download if the user requested it.
  updater.on('update-downloaded', () => {
    isDownloaded = true;
    if (installRequested) {
      installRequested = false;
      // Give Electron a tick to flush IPC before quitting.
      setImmediate(() => {
        if (app.isPackaged) {
          try {
            updater.quitAndInstall(true, true);
          } catch (e) {
            reportError(e, 'Failed to quit and install');
          }
        } else {
          showError(
            'Update downloaded (development build).\nInstall is only performed in packaged apps.'
          );
        }
      });
    }
  });

  // --- IPC from renderer ---

  // Renderer can ask for a check whenever it boots/opens
  ipcMain.on('update-check', () => {
    updater.checkForUpdates().catch((err: unknown) => {
      reportError(err, 'Failed to check for updates');
    });
  });

  // Single-click from Quick Menu: download (if needed) then install when ready.
  ipcMain.on('update-download-and-install', async () => {
    try {
      installRequested = true;

      // If we don't yet have metadata, check first.
      if (!hasUpdate) {
        const info = await updater.checkForUpdates();
        hasUpdate = !!info?.updateInfo?.version;
        if (!hasUpdate) {
          // update-not-available will pop the box; but guard here too
          showError(
            `No update available.\nYou're already on version ${app.getVersion()}.`
          );
          installRequested = false;
          return;
        }
      }

      if (isDownloaded) {
        // Already downloaded → install right away.
        setImmediate(() => {
          if (app.isPackaged) {
            try {
              updater.quitAndInstall(true, true);
            } catch (e) {
              reportError(e, 'Failed to quit and install');
            }
          } else {
            showError(
              'Update downloaded (development build).\nInstall is only performed in packaged apps.'
            );
          }
        });
        return;
      }

      // Start the download; when finished, 'update-downloaded' will fire and install.
      updater.downloadUpdate().catch((err: unknown) => {
        reportError(err, 'Failed to download the update');
        installRequested = false;
      });
    } catch (err: unknown) {
      reportError(err, 'Update initiation failed');
      installRequested = false;
    }
  });

  // Initial check after boot so LED/menu state is fresh
  setTimeout(() => {
    updater.checkForUpdates().catch(() => {});
  }, 1500);
};
