import { ipcMain, app, webContents } from 'electron';
import { setIpcMain } from '@wexond/rpc-electron';
setIpcMain(ipcMain);

// Initialize the remote module. The remote API has been removed from core
// Electron and is now provided by the @electron/remote package. Calling
// initialize() here ensures it hooks into the IPC internals before any
// BrowserWindows are created.
import { initialize } from '@electron/remote/main';

initialize();

if (process.env.NODE_ENV === 'development') {
  require('source-map-support').install();
}

import { platform } from 'os';
import { Application } from './application';

export const isNightly = app.name === 'selenix-nightly';

// The allowRendererProcessReuse property has been removed in recent Electron
// versions. Electron now always reuses renderer processes when it is safe to do so.
app.name = isNightly ? 'Selenix Nightly' : 'Selenix';

(process.env as any)['ELECTRON_DISABLE_SECURITY_WARNINGS'] = true;

app.commandLine.appendSwitch('--enable-transparent-visuals');
app.commandLine.appendSwitch(
  'enable-features',
  'CSSColorSchemeUARendering, ImpulseScrollAnimations, ParallelDownloading',
);

if (process.env.NODE_ENV === 'development') {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
}

ipcMain.setMaxListeners(0);

const application = Application.instance;
application.start();

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.on('window-all-closed', () => {
  if (platform() !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('get-webcontents-id', (e) => {
  e.returnValue = e.sender.id;
});

ipcMain.on('get-window-id', (e) => {
  e.returnValue = (e.sender as any).windowId;
});

ipcMain.handle(
  `web-contents-call`,
  async (e, { webContentsId, method, args = [] }: { webContentsId: number; method: string; args: any[] }) => {
    try {
      const wc = webContents.fromId(webContentsId);
      if (!wc || wc.isDestroyed()) {
        throw new Error(`WebContents with id ${webContentsId} not found or destroyed`);
      }

      // Handle both direct methods and webContents.method calls
      let actualMethod = method;
      if (method.startsWith('webContents.')) {
        actualMethod = method.split('.')[1];
      }

      if (typeof (wc as any)[actualMethod] !== 'function') {
        throw new Error(`${actualMethod} is not a function on WebContents`);
      }

      const result = (wc as any)[actualMethod](...args);

      if (result instanceof Promise) {
        return await result.catch(err => {
          console.error('Error in webContents method:', actualMethod, err);
          throw err;
        });
      }
      return result;
    } catch (error) {
      console.error('Error in web-contents-call handler:', error);
      throw error;
    }
  }
);