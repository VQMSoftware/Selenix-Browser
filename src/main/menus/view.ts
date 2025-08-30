import { AppWindow } from '../windows';
import {
  clipboard,
  nativeImage,
  Menu,
  session,
  ipcMain,
  WebContentsView,
} from 'electron';
import { isURL, prefixHttp } from '~/utils';
import { saveAs, viewSource, printPage } from './common-actions';
import { Application } from '../application';

export const getViewMenu = (
  appWindow: AppWindow,
  params: Electron.ContextMenuParams,
  webContents: Electron.WebContents,
) => {
  let menuItems: Electron.MenuItemConstructorOptions[] = [];

  if (params.linkURL !== '') {
    menuItems = menuItems.concat([
      {
        label: 'Open link in new tab',
        click: () => {
          // Open and immediately activate the new tab so both the content view
          // and the renderer tabstrip stay in sync.
          const v = appWindow.viewManager.create(
            {
              url: params.linkURL,
              active: true,
            },
            true,
          );
          // Ensure renderer receives 'select-tab' and the new view is focused.
          try { appWindow.viewManager.select(v.id, true); } catch {}
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Copy link address',
        click: () => {
          clipboard.clear();
          clipboard.writeText(params.linkURL);
        },
      },
      {
        type: 'separator',
      },
    ]);
  }

  if (params.hasImageContents) {
    menuItems = menuItems.concat([
      {
        label: 'Open image in new tab',
        click: () => {
          // Open and immediately activate the new tab so both the content view
          // and the renderer tabstrip stay in sync.
          const v = appWindow.viewManager.create(
            {
              url: params.srcURL,
              active: true,
            },
            true,
          );
          try { appWindow.viewManager.select(v.id, true); } catch {}
        },
      },
      {
        label: 'Copy image',
        click: () => webContents.copyImageAt(params.x, params.y),
      },
      {
        label: 'Copy image address',
        click: () => {
          clipboard.clear();
          clipboard.writeText(params.srcURL);
        },
      },
      {
        
        label: 'Save image as...',
        click: async () => {
          try {
            const { dialog } = require('electron');
            const url = params.srcURL;
            const guessedName = (() => {
              try {
                const u = new URL(url);
                const last = (u.pathname.split('/').pop() || '').split('?')[0] || 'image';
                return last || 'image';
              } catch (_err) { return 'image'; }
            })();

            const res = await dialog.showSaveDialog({
              defaultPath: guessedName,
              filters: [
                { name: 'Images', extensions: ['png','jpg','jpeg','gif','webp','bmp','svg'] },
                { name: 'All Files', extensions: ['*'] },
              ],
            });
            if (res.canceled || !res.filePath) return;

            const ses = appWindow.win.webContents.session;
            const handler = (event: any, item: any) => {
              try {
                if ((item.getURL && item.getURL()) === url) {
                  try { item.setSavePath(res.filePath); } catch {}
                  ses.removeListener('will-download', handler);
                }
              } catch {}
            };
            // One-shot path assignment for this download only
            ses.on('will-download', handler);

            // Kick off the download
            try {
              // Prefer session.downloadURL with saveAs flag when available
              if (typeof (ses as any).downloadURL === 'function') {
                try { (ses as any).downloadURL(url, { saveAs: true }); }
                catch { appWindow.webContents.downloadURL(url); }
              } else {
                appWindow.webContents.downloadURL(url);
              }
            } catch {}
          } catch (err) { console.error('Save image as failed:', err); }
        },
      },
      {
        type: 'separator',
      },
    ]);
  }

  if (params.isEditable) {
    menuItems = menuItems.concat([
      {
        role: 'undo',
        accelerator: 'CmdOrCtrl+Z',
      },
      {
        role: 'redo',
        accelerator: 'CmdOrCtrl+Shift+Z',
      },
      {
        type: 'separator',
      },
      {
        role: 'cut',
        accelerator: 'CmdOrCtrl+X',
      },
      {
        role: 'copy',
        accelerator: 'CmdOrCtrl+C',
      },
      {
        role: 'pasteAndMatchStyle',
        accelerator: 'CmdOrCtrl+V',
        label: 'Paste',
      },
      {
        role: 'paste',
        accelerator: 'CmdOrCtrl+Shift+V',
        label: 'Paste as plain text',
      },
      {
        role: 'selectAll',
        accelerator: 'CmdOrCtrl+A',
      },
      {
        type: 'separator',
      },
    ]);
  }

  if (!params.isEditable && params.selectionText !== '') {
    menuItems = menuItems.concat([
      {
        role: 'copy',
        accelerator: 'CmdOrCtrl+C',
      },
      {
        type: 'separator',
      },
    ]);
  }

  if (params.selectionText !== '') {
    const trimmedText = params.selectionText.trim();

    if (isURL(trimmedText)) {
      menuItems = menuItems.concat([
        {
          label: 'Go to ' + trimmedText,
          click: () => {
            appWindow.viewManager.create(
              {
                url: prefixHttp(trimmedText),
                active: true,
              },
              true,
            );
          },
        },
        {
          type: 'separator',
        },
      ]);
    }
  }

  if (
    !params.hasImageContents &&
    params.linkURL === '' &&
    params.selectionText === '' &&
    !params.isEditable
  ) {
    menuItems = menuItems.concat([
      {
        label: 'Go back',
        accelerator: 'Alt+Left',
        enabled: webContents.navigationHistory.canGoBack(),
        click: () => {
          webContents.navigationHistory.goBack();
        },
      },
      {
        label: 'Go forward',
        accelerator: 'Alt+Right',
        enabled: webContents.navigationHistory.canGoForward(),
        click: () => {
          webContents.navigationHistory.goForward();
        },
      },
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          webContents.reload();
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Save as...',
        accelerator: 'CmdOrCtrl+S',
        click: async () => {
          saveAs();
        },
      },
      {
        label: 'Print',
        accelerator: 'CmdOrCtrl+P',
        click: async () => {
          printPage();
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'View page source',
        accelerator: 'CmdOrCtrl+U',
        click: () => {
          viewSource();
        },
      },
    ]);
  }

  menuItems.push({
    label: 'Inspect',
    accelerator: 'CmdOrCtrl+Shift+I',
    click: () => {
      const { devToolsPosition } = Application.instance.settings.object;
      
      // Close dev tools if they're open in the wrong position, then reopen in correct position
      if (webContents.isDevToolsOpened()) {
        webContents.closeDevTools();
      }
      
      webContents.inspectElement(params.x, params.y);
      
      // The dev tools should now be open in the correct position
      if (webContents.isDevToolsOpened()) {
        webContents.devToolsWebContents.focus();
      }
    },
  });

  return Menu.buildFromTemplate(menuItems);
};