import { session, ipcMain, app, Session, Extension, DownloadItem, WebContents } from 'electron';
import { getPath, makeId } from '~/utils';
import { promises, existsSync } from 'fs';
import { resolve, basename, parse, extname } from 'path';
import { Application } from './application';
import { registerProtocol } from './models/protocol';
import * as url from 'url';
import { IDownloadItem, BrowserActionChangeType } from '~/interfaces';
import { parseCrx } from '~/utils/crx';
import { pathExists } from '~/utils/files';
import { extractZip } from '~/utils/zip';
import { extensions, _setFallbackSession } from 'electron-extensions';
import { requestPermission } from './dialogs/permissions';
import * as rimraf from 'rimraf';
import { promisify } from 'util';

const rf = promisify(rimraf);

interface ExtendedExtension extends Extension {
  backgroundPage?: {
    webContents: WebContents;
  };
}

export class SessionsService {
  public view = session.fromPartition('persist:view');
  public viewIncognito = session.fromPartition('view_incognito');

  public incognitoExtensionsLoaded = false;
  public extensionsLoaded = false;

  public extensions: ExtendedExtension[] = [];
  public extensionsIncognito: ExtendedExtension[] = [];

  public constructor() {
    registerProtocol(this.view);
    registerProtocol(this.viewIncognito);

    this.clearCache('incognito');

    if (process.env.ENABLE_EXTENSIONS) {
      extensions.initializeSession(
        this.view,
        `${app.getAppPath()}/build/extensions-preload.bundle.js`,
      );

      ipcMain.on('load-extensions', () => {
        this.loadExtensions();
      });

      ipcMain.handle('get-extensions', () => {
        return this.extensions;
      });

      ipcMain.handle('inspect-extension', (e: Electron.IpcMainInvokeEvent, incognito: boolean, id: string) => {
        const context = incognito ? this.extensionsIncognito : this.extensions;
        const extension = context.find(ext => ext.id === id);
        if (extension?.backgroundPage?.webContents) {
          extension.backgroundPage.webContents.openDevTools();
        }
      });
    }

    this.view.setPermissionRequestHandler(
      async (
        webContents: WebContents,
        permission: string,
        callback: (permissionGranted: boolean) => void,
        details: any,
      ) => {
        const window = Application.instance.windows.findByContentsView(
          webContents.id,
        );
        if (!window || webContents.id !== window.viewManager.selectedId) return;

        if (permission === 'fullscreen') {
          callback(true);
          return;
        }

        try {
          const { hostname } = url.parse(details.requestingUrl);
          const perm: any = await Application.instance.storage.findOne({
            scope: 'permissions',
            query: { url: hostname, permission },
          });

          if (!perm) {
            const response = await requestPermission(
              window.win,
              permission,
              hostname,
              details,
              window.viewManager.selectedId,
            );
            callback(response);
            await Application.instance.storage.insert({
              scope: 'permissions',
              item: {
                url: hostname,
                permission,
                type: response ? 1 : 2,
                mediaTypes: JSON.stringify(details.mediaTypes) || '',
              },
            });
          } else {
            callback(perm.type === 1);
          }
        } catch (e) {
          callback(false);
        }
      },
    );

    const getDownloadItem = (
      item: DownloadItem,
      id: string,
    ): IDownloadItem => ({
      fileName: basename(item.savePath),
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      savePath: item.savePath,
      id,
    });

    const downloadsDialog = () =>
      Application.instance.dialogs.getDynamic('downloads-dialog')?.webContentsView
        ?.webContents;

    const downloads: IDownloadItem[] = [];

    ipcMain.handle('get-downloads', () => {
      return downloads;
    });

    const setupDownloadListeners = (ses: Session) => {
      ses.on('will-download', (event: Electron.Event, item: DownloadItem, webContents: WebContents) => {
        const fileName = item.getFilename();
        const id = makeId(32);
        const window = Application.instance.windows.findByContentsView(
          webContents.id,
        );

        if (!Application.instance.settings.object.downloadsDialog) {
          const downloadsPath =
            Application.instance.settings.object.downloadsPath;
          let i = 1;
          let savePath = resolve(downloadsPath, fileName);

          while (existsSync(savePath)) {
            const { name, ext } = parse(fileName);
            savePath = resolve(downloadsPath, `${name} (${i})${ext}`);
            i++;
          }

          item.savePath = savePath;
        }

        const downloadItem = getDownloadItem(item, id);
        downloads.push(downloadItem);

        downloadsDialog()?.send('download-started', downloadItem);
        window.send('download-started', downloadItem);

        item.on('updated', (event: Electron.Event, state: string) => {
          if (state === 'interrupted') {
            console.log('Download is interrupted but can be resumed');
          } else if (state === 'progressing') {
            if (item.isPaused()) {
              console.log('Download is paused');
            }
          }

          const data = getDownloadItem(item, id);

          downloadsDialog()?.send('download-progress', data);
          window.send('download-progress', data);

          Object.assign(downloadItem, data);
        });

        item.once('done', async (event: Electron.Event, state: string) => {
          if (state === 'completed') {
            const dialog = downloadsDialog();
            dialog?.send('download-completed', id);
            window.send('download-completed', id, !!dialog);

            downloadItem.completed = true;

            if (process.env.ENABLE_EXTENSIONS && extname(fileName) === '.crx') {
              const crxBuf = await promises.readFile(item.savePath);
              const crxInfo = parseCrx(crxBuf);

              if (!crxInfo.id) {
                crxInfo.id = makeId(32);
              }

              const extensionsPath = getPath('extensions');
              const path = resolve(extensionsPath, crxInfo.id);
              const manifestPath = resolve(path, 'manifest.json');

              if (await pathExists(path)) {
                console.log('Extension is already installed');
                return;
              }

              await extractZip(crxInfo.zip, path);

              const extension = await this.view.loadExtension(path);

              if (crxInfo.publicKey) {
                const manifest = JSON.parse(
                  await promises.readFile(manifestPath, 'utf8'),
                );

                manifest.key = crxInfo.publicKey.toString('base64');

                await promises.writeFile(
                  manifestPath,
                  JSON.stringify(manifest, null, 2),
                );
              }

              window.send('load-browserAction', extension);
            }
          } else {
            console.log(`Download failed: ${state}`);
          }
        });
      });
    };

    setupDownloadListeners(this.view);
    setupDownloadListeners(session.defaultSession);

    ipcMain.on('clear-browsing-data', () => {
      this.clearCache('normal');
      this.clearCache('incognito');
    });
  }

  public clearCache(sessionType: 'normal' | 'incognito') {
    const ses = sessionType === 'incognito' ? this.viewIncognito : this.view;

    ses.clearCache().catch((err) => {
      console.error(err);
    });

    ses.clearStorageData({
      storages: [
        'cookies',
        'filesystem',
        'indexdb',
        'localstorage',
        'shadercache',
        'websql',
        'serviceworkers',
        'cachestorage',
      ],
    });
  }

  public unloadIncognitoExtensions() {
    this.extensionsIncognito.forEach(extension => {
      try {
        this.viewIncognito.removeExtension(extension.id);
      } catch (e) {
        console.error(`Failed to unload incognito extension ${extension.id}:`, e);
      }
    });
    this.extensionsIncognito = [];
    this.incognitoExtensionsLoaded = false;
  }

  public async loadExtensions(sessionType: 'normal' | 'incognito' = 'normal') {
    if (!process.env.ENABLE_EXTENSIONS) return;

    const context = sessionType === 'incognito' ? this.viewIncognito : this.view;

    if ((sessionType === 'normal' && this.extensionsLoaded) || 
        (sessionType === 'incognito' && this.incognitoExtensionsLoaded)) {
      return;
    }

    const extensionsPath = getPath('extensions');
    const dirs = await promises.readdir(extensionsPath);

    for (const dir of dirs) {
      try {
        const path = resolve(extensionsPath, dir);
        const extension = await context.loadExtension(path) as ExtendedExtension;

        if (sessionType === 'incognito') {
          this.extensionsIncognito.push(extension);
        } else {
          this.extensions.push(extension);
        }

        for (const window of Application.instance.windows.list) {
          window.send('load-browserAction', extension);
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (sessionType === 'incognito') {
      this.incognitoExtensionsLoaded = true;
    } else {
      this.extensionsLoaded = true;
    }
  }

  async uninstallExtension(id: string) {
    if (!process.env.ENABLE_EXTENSIONS) return;

    // Remove from both normal and incognito sessions
    const extension = this.view.getExtension(id);
    if (extension) {
      await this.view.removeExtension(id);
      await rf(extension.path);
    }

    const incognitoExtension = this.viewIncognito.getExtension(id);
    if (incognitoExtension) {
      await this.viewIncognito.removeExtension(id);
    }

    // Update extensions arrays
    this.extensions = this.extensions.filter(ext => ext.id !== id);
    this.extensionsIncognito = this.extensionsIncognito.filter(ext => ext.id !== id);
  }

  public onCreateTab = async (details: chrome.tabs.CreateProperties) => {
    const window = Application.instance.windows.list
      .find((x) => x.win.id === details.windowId);
    
    if (!window) throw new Error('Window not found');
    
    const view = window.viewManager.create(details, false, true);
    return view.id;
  };

  public onBrowserActionUpdate = (
    extensionId: string,
    action: BrowserActionChangeType,
    details: any,
  ) => {
    Application.instance.windows.list.forEach((w) => {
      w.send('set-browserAction-info', extensionId, action, details);
    });
  };
}