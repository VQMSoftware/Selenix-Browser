import { BrowserWindow, app, dialog, nativeTheme, Menu, ipcMain } from 'electron';
// Pull in the enable function from @electron/remote/main so we can allow
// remote access to this window's webContents. The remote API has been
// extracted from Electron and must be explicitly enabled per WebContents.
import { enable } from '@electron/remote/main';
import { writeFileSync, promises } from 'fs';
import { resolve, join } from 'path';

import { getPath } from '~/utils';
import { runMessagingService } from '../services';
import { Application } from '../application';
import { isNightly } from '..';
import { ViewManager } from '../view-manager';

export class AppWindow {
  public win: BrowserWindow;

  public viewManager: ViewManager;

  public incognito: boolean;

  public constructor(incognito: boolean) {
    const isMac = process.platform === 'darwin';
    const isWin = process.platform === 'win32';
    const isLinux = process.platform === 'linux';

    // Linux: we go frameless so the OS bar isn't drawn; we rely on overlay if supported,
    // or our own renderer buttons via IPC as a fallback (see handlers below).
    // Windows/macOS: keep custom chrome with hidden/overlay styles.
    this.win = new BrowserWindow({
      frame: isLinux ? false : true,
      minWidth: 400,
      minHeight: 450,
      width: 900,
      height: 700,
      // macOS uses hiddenInset. Windows & Linux use hidden with overlay enabled below.
      titleBarStyle: isMac ? 'hiddenInset' : ((isWin || isLinux) ? 'hidden' : undefined),
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#939090ff' : '#ffffff',
      trafficLightPosition: isMac ? { x: 12, y: 12 } : undefined,
      // Enable overlay on Win/Linux to surface native-style window controls inside our bar.
      // (Linux support depends on Electron/WM; we also provide an IPC fallback.)
      titleBarOverlay: (isWin || isLinux)
        ? {
            color: nativeTheme.shouldUseDarkColors ? '#1f1f1f' : '#ffffff',
            symbolColor: nativeTheme.shouldUseDarkColors ? '#ffffff' : '#000000',
            height: 32,
          }
        : undefined,
      webPreferences: {
        plugins: true,
        // TODO: enable sandbox, contextIsolation and disable nodeIntegration to improve security
        nodeIntegration: true,
        contextIsolation: false,
        javascript: true,
        // enableRemoteModule has been removed. The remote API must be enabled
        // programmatically using @electron/remote/main.enable(this.win.webContents).
      },
      icon: resolve(
        app.getAppPath(),
        `static/${isNightly ? 'nightly-icons' : 'icons'}/icon.png`,
      ),
      show: false,
      // Hide the menubar chrome so it doesn’t add extra UI on Linux.
      autoHideMenuBar: true,
      useContentSize: true,
    });

    // Ensure the standard menubar is hidden (covers DE quirks on Linux).
    try {
      this.win.setMenuBarVisibility(false);
      this.win.setMenu(null);
      Menu.setApplicationMenu(null);
    } catch {}

    // Enable the remote module for this window's WebContents. Without this call
    // the remote API will not be available in renderers.
    enable(this.win.webContents);

    this.incognito = incognito;

    this.viewManager = new ViewManager(this, incognito);

    // Keep Windows caption buttons & background in sync with app theme
    // Apply overlay colors on Win/Linux and keep background in sync
    const applyOverlayColors = () => {
      if (isWin || isLinux) {
        const dark = nativeTheme.shouldUseDarkColors;
        try {
          this.win.setTitleBarOverlay?.({
            color: dark ? '#1c1c1c' : '#d4d4d4',
            symbolColor: dark ? '#ffffffff' : '#000000ff',
            height: 32,
          } as any);
        } catch {}
      }
      try {
        const dark = nativeTheme.shouldUseDarkColors;
        this.win.setBackgroundColor(dark ? '#1f1f1f' : '#ffffff');
      } catch {}
    };
    applyOverlayColors();

    // React to OS / app theme changes (system or in-app setting)
    nativeTheme.on('updated', () => {
      applyOverlayColors();
    });

    // ---- IPC fallback for Linux when overlays aren’t available ----
    // Your renderer can call these if you decide to render your own buttons.
    try { ipcMain.removeHandler('window-control'); } catch {}
    ipcMain.handle('window-control', (_evt, action: string) => {
      switch (action) {
        case 'minimize': this.win.minimize(); break;
        case 'maximize': this.win.maximize(); break;
        case 'unmaximize': this.win.unmaximize(); break;
        case 'toggle-maximize': this.win.isMaximized() ? this.win.unmaximize() : this.win.maximize(); break;
        case 'close': this.win.close(); break;
      }
    });

    // Emit platform + state so the renderer can adjust spacing/icons
    const emitPlatformAndState = () => {
      try {
        this.send('platform', process.platform);
        this.send('window-state', {
          maximized: this.win.isMaximized(),
          fullScreen: this.win.isFullScreen(),
          focused: this.win.isFocused(),
          // Simple feature flag the renderer can read to know overlays exist
          overlaySupported: !!this.win.setTitleBarOverlay && (isWin || isLinux),
        });
      } catch {}
    };
    ['maximize','unmaximize','enter-full-screen','leave-full-screen','focus','blur']
      .forEach(evt => this.win.on(evt as any, emitPlatformAndState));
    this.win.webContents.on('did-finish-load', emitPlatformAndState);

    runMessagingService(this);

    const windowDataPath = getPath('window-data.json');

    let windowState: any = {};

    (async () => {
      try {
        // Read the last window state from file.
        windowState = JSON.parse(
          await promises.readFile(windowDataPath, 'utf8'),
        );
      } catch (e) {
        await promises.writeFile(windowDataPath, JSON.stringify({}));
      }

      // Merge bounds from the last window state to the current window options.
      if (windowState) {
        this.win.setBounds({ ...windowState.bounds });
      }

      if (windowState) {
        if (windowState.maximized) {
          this.win.maximize();
        }
        if (windowState.fullscreen) {
          this.win.setFullScreen(true);
        }
      }
    })();

    // Show once ready to avoid flicker.
    this.win.once('ready-to-show', () => {
      this.win.show();
      emitPlatformAndState();
    });

    // Update window bounds on resize and on move when window is not maximized.
    this.win.on('resize', () => {
      if (!this.win.isMaximized()) {
        windowState.bounds = this.win.getBounds();
      }
    });

    this.win.on('move', () => {
      if (!this.win.isMaximized()) {
        windowState.bounds = this.win.getBounds();
      }
    });

    const resize = () => {
      setTimeout(() => {
        if (process.platform === 'linux') {
          this.viewManager.select(this.viewManager.selectedId, false);
        } else {
          this.viewManager.fixBounds();
        }
      });

      setTimeout(() => {
        this.webContents.send('tabs-resize');
      }, 500);

      this.webContents.send('tabs-resize');
    };

    this.win.on('maximize', resize);
    this.win.on('restore', resize);
    this.win.on('unmaximize', resize);

    this.win.on('close', (event: Electron.Event) => {
      const { object: settings } = Application.instance.settings;

      if (settings.warnOnQuit && this.viewManager.views.size > 1) {
        const answer = dialog.showMessageBoxSync(null, {
          type: 'question',
          title: `Quit ${app.name}?`,
          message: `Quit ${app.name}?`,
          detail: `You have ${this.viewManager.views.size} tabs open.`,
          buttons: ['Close', 'Cancel'],
        });

        if (answer === 1) {
          event.preventDefault();
          return;
        }
      }

      // Save current window state to a file.
      windowState.maximized = this.win.isMaximized();
      windowState.fullscreen = this.win.isFullScreen();
      writeFileSync(windowDataPath, JSON.stringify(windowState));

      // Removed unsafe call: this.win.setContentView(null);

      this.viewManager.clear();

      if (Application.instance.windows.list.length === 1) {
        Application.instance.dialogs.destroy();
      }

      if (
        incognito &&
        Application.instance.windows.list.filter((x) => x.incognito).length ===
          1
      ) {
        Application.instance.sessions.clearCache('incognito');
        Application.instance.sessions.unloadIncognitoExtensions();
      }

      Application.instance.windows.list = Application.instance.windows.list.filter(
        (x) => x.win.id !== this.win.id,
      );
    });

    // this.webContents.openDevTools({ mode: 'detach' });

    if (process.env.NODE_ENV === 'development') {
      this.webContents.openDevTools({ mode: 'detach' });
      this.win.loadURL('http://localhost:4444/app.html');
    } else {
      // When loading the compiled renderer in production, use loadFile instead
      // of constructing a file:// URL manually. This avoids issues with
      // incorrectly joined paths (e.g. extra slashes or backslashes) which
      // can result in a blank window. See https://www.electronjs.org/docs/latest/api/browser-window#winloadfilefilepath-options
      const filePath = join(app.getAppPath(), 'build', 'app.html');
      this.win.loadFile(filePath);
    }

    this.win.on('enter-full-screen', () => {
      this.send('fullscreen', true);
      this.viewManager.fixBounds();
    });

    this.win.on('leave-full-screen', () => {
      this.send('fullscreen', false);
      this.viewManager.fixBounds();
    });

    this.win.on('enter-html-full-screen', () => {
      this.viewManager.fullscreen = true;
      this.send('html-fullscreen', true);
    });

    this.win.on('leave-html-full-screen', () => {
      this.viewManager.fullscreen = false;
      this.send('html-fullscreen', false);
    });

    (this.win as any).on('scroll-touch-begin', () => {
      this.send('scroll-touch-begin');
    });

    (this.win as any).on('scroll-touch-end', () => {
      this.viewManager.selected.send('scroll-touch-end');
      this.send('scroll-touch-end');
    });

    this.win.on('focus', () => {
      Application.instance.windows.current = this;
    });
  }

  public get id() {
    return this.win.id;
  }

  public get webContents() {
    // Guard against destroyed window/webContents to avoid runtime errors
    try {
      if (!this.win || this.win.isDestroyed()) return null as any;
      const wc = this.win.webContents as any;
      if (!wc || (typeof wc.isDestroyed === "function" && wc.isDestroyed())) return null as any;
      return wc;
    } catch {
      return null as any;
    }
  }

  public fixDragging() {
    const bounds = this.win.getBounds();
    this.win.setBounds({
      height: bounds.height + 1,
    });
    this.win.setBounds(bounds);
  }

  public send(channel: string, ...args: any[]) {
    const wc = this.webContents as any;
    if (!wc) { return; }
    try { wc.send(channel, ...args); } catch { /* swallow if window is gone */ }
  }

  public updateTitle() {
    const { selected } = this.viewManager;
    if (!selected) return;

    this.win.setTitle(
      selected.title.trim() === ''
        ? app.name
        : `${selected.title} - ${app.name}`,
    );
  }
}
