import { BrowserView, app, ipcMain, BrowserWindow } from 'electron';
// Bring in enable from @electron/remote/main so that remote functions are available in dialogs.
import { enable } from '@electron/remote/main';
import { join } from 'path';
import { roundifyRectangle } from '../services/dialogs-service';

interface IOptions {
  name: string;
  devtools?: boolean;
  bounds?: IRectangle;
  hideTimeout?: number;
  customHide?: boolean;
  webPreferences?: Electron.WebPreferences;
}

interface IRectangle {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export class PersistentDialog {
  public browserWindow: BrowserWindow;
  public browserView: BrowserView;

  public visible = false;

  public bounds: IRectangle = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };

  public name: string;

  private timeout: any;
  private hideTimeout: number;

  private loaded = false;
  private showCallback: any = null;

  public constructor({
    bounds,
    name,
    devtools,
    hideTimeout,
    webPreferences,
  }: IOptions) {
    this.browserView = new BrowserView({
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        // enableRemoteModule has been removed. We'll enable remote via the enable() call below.
        ...webPreferences,
      },
    });

    // Enable remote for this dialog's BrowserView webContents.
    enable(this.browserView.webContents);

    this.bounds = { ...this.bounds, ...bounds };
    this.hideTimeout = hideTimeout;
    this.name = name;

    const { webContents } = this.browserView;

    ipcMain.on(`hide-${webContents.id}`, () => {
      this.hide(false, false);
    });

    webContents.once('dom-ready', () => {
      this.loaded = true;

      if (this.showCallback) {
        this.showCallback();
        this.showCallback = null;
      }
    });

    if (process.env.NODE_ENV === 'development') {
      this.webContents.loadURL(`http://localhost:4444/${this.name}.html`);
    } else {
      // When loading dialogs in production, construct an absolute file path
      // and use loadFile() instead of manually composing a file:// URL. This
      // prevents invalid paths on Windows which can lead to blank views.
      const filePath = join(app.getAppPath(), 'build', `${this.name}.html`);
      this.webContents.loadFile(filePath);
    }
  }

  public get webContents() {
    return this.browserView.webContents;
  }

  public get id() {
    return this.webContents.id;
  }

  public rearrange(rect: IRectangle = {}) {
    this.bounds = roundifyRectangle({
      height: rect.height || this.bounds.height || 0,
      width: rect.width || this.bounds.width || 0,
      x: rect.x || this.bounds.x || 0,
      y: rect.y || this.bounds.y || 0,
    });

    if (this.visible) {
      this.browserView.setBounds(this.bounds as any);
    }
  }

  public show(browserWindow: BrowserWindow, focus = true, waitForLoad = true) {
    return new Promise<void>((resolve) => {
      this.browserWindow = browserWindow;

      clearTimeout(this.timeout);

      browserWindow.webContents.send(
        'dialog-visibility-change',
        this.name,
        true,
      );

      const callback = () => {
        if (this.visible) {
          if (focus) this.webContents.focus();
          return;
        }

        this.visible = true;

        browserWindow.addBrowserView(this.browserView);
        this.rearrange();

        if (focus) this.webContents.focus();

        resolve();
      };

      if (!this.loaded && waitForLoad) {
        this.showCallback = callback;
        return;
      }

      callback();
    });
  }

  public hideVisually() {
    this.send('visible', false);
  }

  public send(channel: string, ...args: any[]) {
    this.webContents.send(channel, ...args);
  }

  public hide(bringToTop = false, hideVisually = true) {
    if (!this.browserWindow) return;

    if (hideVisually) this.hideVisually();

    if (!this.visible) return;

    this.browserWindow.webContents.send(
      'dialog-visibility-change',
      this.name,
      false,
    );

    if (bringToTop) {
      this.bringToTop();
    }

    clearTimeout(this.timeout);

    if (this.hideTimeout) {
      this.timeout = setTimeout(() => {
        this.browserWindow.removeBrowserView(this.browserView);
      }, this.hideTimeout);
    } else {
      this.browserWindow.removeBrowserView(this.browserView);
    }

    this.visible = false;

    // this.appWindow.fixDragging();
  }

  public bringToTop() {
    this.browserWindow.removeBrowserView(this.browserView);
    this.browserWindow.addBrowserView(this.browserView);
  }

  public destroy() {
    if (this.browserView) {
      try {
        // Remove from window first
        if (this.browserWindow) {
          this.browserWindow.removeBrowserView(this.browserView);
        }
        
        // Proper modern Electron BrowserView cleanup
        (this.browserView as any).destroy();
        this.browserView = null;
      } catch (e) {
        console.error('Error destroying browser view:', e);
      }
    }
  // TODO:  this.browserView.destroy();
    this.browserView = null;
  }
}
