import { WebContentsView, app, ipcMain } from 'electron';
import { enable } from '@electron/remote/main';
import { join } from 'path';
import { SearchDialog } from '../dialogs/search';
import { PreviewDialog } from '../dialogs/preview';
import { PersistentDialog } from '../dialogs/dialog';
import { Application } from '../application';
import { IRectangle } from '~/interfaces';

interface IDialogTabAssociation {
  tabId?: number;
  getTabInfo?: (tabId: number) => any;
  setTabInfo?: (tabId: number, ...args: any[]) => void;
}

type BoundsDisposition = 'move' | 'resize';

interface IDialogShowOptions {
  name: string;
  browserWindow: Electron.BrowserWindow;
  hideTimeout?: number;
  devtools?: boolean;
  tabAssociation?: IDialogTabAssociation;
  onWindowBoundsUpdate?: (disposition: BoundsDisposition) => void;
  onHide?: (dialog: IDialog) => void;
  getBounds: () => IRectangle;
}

interface IDialog {
  name: string;
  webContentsView: WebContentsView;
  id: number;
  tabIds: number[];
  _sendTabInfo: (tabId: number) => void;
  hide: (tabId?: number) => void;
  handle: (name: string, cb: (...args: any[]) => any) => void;
  on: (name: string, cb: (...args: any[]) => any) => void;
  rearrange: (bounds?: IRectangle) => void;
}

export const roundifyRectangle = (rect: IRectangle): IRectangle => {
  const newRect: any = { ...rect };
  Object.keys(newRect).forEach((key) => {
    if (!isNaN(newRect[key])) newRect[key] = Math.round(newRect[key]);
  });
  return newRect;
};

export class DialogsService {
  public childViews: WebContentsView[] = [];
  public contentViewDetails = new Map<number, boolean>();
  public dialogs: IDialog[] = [];

  public persistentDialogs: PersistentDialog[] = [];

  public run() {
    this.createContentView();

    this.persistentDialogs.push(new SearchDialog());
    this.persistentDialogs.push(new PreviewDialog());
  }

  private createContentView() {
    const view = new WebContentsView({
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        backgroundThrottling: false,
        webviewTag: true,
      },
    });

    enable(view.webContents);

    // Ensure the view and its renderer are both transparent BEFORE load.
    (view as any).setBackgroundColor?.('#00000000');
    (view.webContents as any).setBackgroundColor?.('#00000000');

    // Transparent boot page to avoid any black until the real HTML is loaded.
    const transparentBoot = `data:text/html;charset=utf-8,
      <meta charset="utf-8">
      <style>
        html,body,#app{margin:0;height:100%;background:transparent !important}
      </style>
      <div id="app"></div>`;
    view.webContents.loadURL(transparentBoot);

    view.webContents.on('dom-ready', () => {
      try {
        view.webContents.insertCSS(`
          html, body, #app { background: transparent !important; }
        `);
      } catch {}
    });

    this.childViews.push(view);
    this.contentViewDetails.set(view.webContents.id, false);

    return view;
  }

  public show(options: IDialogShowOptions): IDialog {
    const {
      name,
      browserWindow,
      getBounds,
      devtools,
      onHide,
      hideTimeout,
      onWindowBoundsUpdate,
      tabAssociation,
    } = options;

    const foundDialog = this.getDynamic(name);

    let webContentsView = foundDialog
      ? foundDialog.webContentsView
      : this.childViews.find(
          (x) => !this.contentViewDetails.get(x.webContents.id),
        );

    if (!webContentsView) {
      webContentsView = this.createContentView();
    }

    const appWindow = Application.instance.windows.fromBrowserWindow(
      browserWindow,
    );

    if (foundDialog && tabAssociation) {
      foundDialog.tabIds.push(tabAssociation.tabId!);
      foundDialog._sendTabInfo(tabAssociation.tabId!);
    }

    browserWindow.webContents.send('dialog-visibility-change', name, true);

    this.contentViewDetails.set(webContentsView.webContents.id, true);

    if (foundDialog) {
      // Only attach if it’s already loaded; otherwise wait to avoid black flash.
      if ((foundDialog.webContentsView.webContents as any).isLoading?.()) {
        foundDialog.webContentsView.webContents.once('dom-ready', () => {
          browserWindow.contentView.addChildView(webContentsView!);
          foundDialog.rearrange();
        });
      } else {
        browserWindow.contentView.addChildView(webContentsView);
        foundDialog.rearrange();
      }
      return null as any;
    }

    // Pre-position with a 1×1 rect while hidden; real sizing happens at dom-ready.
    webContentsView.setBounds({ x: 0, y: 0, width: 1, height: 1 });

    if (devtools) {
      webContentsView.webContents.openDevTools({ mode: 'detach' });
    }

    const tabsEvents: {
      activate?: (id: number) => void;
      remove?: (id: number) => void;
    } = {};

    const windowEvents: {
      resize?: () => void;
      move?: () => void;
    } = {};

    const channels: string[] = [];

    const dialog: IDialog = {
      webContentsView,
      id: webContentsView.webContents.id,
      name,
      tabIds: [tabAssociation?.tabId!],
      _sendTabInfo: (tabId) => {
        if (tabAssociation?.getTabInfo) {
          const data = tabAssociation.getTabInfo(tabId);
          webContentsView.webContents.send('update-tab-info', tabId, data);
        }
      },
      hide: (tabId) => {
        const { selectedId } = appWindow.viewManager;

        dialog.tabIds = dialog.tabIds.filter(
          (x) => x !== (tabId || selectedId),
        );

        if (tabId && tabId !== selectedId) return;

        browserWindow.webContents.send('dialog-visibility-change', name, false);

        try {
          browserWindow.contentView.removeChildView(webContentsView);
        } catch {}

        if (tabAssociation && dialog.tabIds.length > 0) return;

        ipcMain.removeAllListeners(`hide-${webContentsView.webContents.id}`);
        channels.forEach((x) => {
          ipcMain.removeHandler(x);
          ipcMain.removeAllListeners(x);
        });

        this.dialogs = this.dialogs.filter((x) => x.id !== dialog.id);

        this.contentViewDetails.set(webContentsView.webContents.id, false);

        if (this.childViews.length > 1) {
          const unusedViews = this.childViews.filter(
            (view) =>
              !this.contentViewDetails.get(view.webContents.id) &&
              view !== this.childViews[0],
          );

          if (unusedViews.length > 0) {
            const viewToRemove = unusedViews[0];
            const index = this.childViews.indexOf(viewToRemove);
            if (index !== -1) {
              Application.instance.windows.list.forEach((window) => {
                try {
                  window.win.contentView.removeChildView(viewToRemove);
                } catch (e) {
                  console.error('Error removing browser view:', e);
                }
              });

              this.contentViewDetails.delete(viewToRemove.webContents.id);
              this.childViews.splice(index, 1);

              try {
                // Blank it first to avoid one last composite on some GPUs.
                if (!viewToRemove.webContents.isDestroyed()) {
                  viewToRemove.webContents.loadURL('about:blank');
                }
                (viewToRemove as any).destroy?.();
              } catch (e) {
                console.error('Error destroying browser view:', e);
              }
            }
          }
        } else {
          // Keep the sole reusable view transparent & blank.
          webContentsView.webContents.loadURL('about:blank');
          (webContentsView as any).setBackgroundColor?.('#00000000');
          (webContentsView.webContents as any).setBackgroundColor?.(
            '#00000000',
          );
        }

        if (tabAssociation) {
          appWindow.viewManager.off('activated', tabsEvents.activate!);
          appWindow.viewManager.off('removed', tabsEvents.remove!);
        }

        browserWindow.removeListener('resize', windowEvents.resize!);
        browserWindow.removeListener('move', windowEvents.move!);

        if (onHide) onHide(dialog);
      },
      handle: (name, cb) => {
        const channel = `${name}-${webContentsView.webContents.id}`;
        ipcMain.handle(channel, (...args) => cb(...args));
        channels.push(channel);
      },
      on: (name, cb) => {
        const channel = `${name}-${webContentsView.webContents.id}`;
        ipcMain.on(channel, (...args) => cb(...args));
        channels.push(channel);
      },
      rearrange: (rect) => {
        rect = rect || {};
        webContentsView.setBounds({
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          ...roundifyRectangle(getBounds()),
          ...roundifyRectangle(rect),
        });
      },
    };

    tabsEvents.activate = (id) => {
      const visible = dialog.tabIds.includes(id);
      browserWindow.webContents.send('dialog-visibility-change', name, visible);

      if (visible) {
        dialog._sendTabInfo(id);
        try {
          browserWindow.contentView.removeChildView(webContentsView);
        } catch {}
        browserWindow.contentView.addChildView(webContentsView);
      } else {
        try {
          browserWindow.contentView.removeChildView(webContentsView);
        } catch {}
      }
    };

    tabsEvents.remove = (id) => {
      dialog.hide(id);
    };

    const emitWindowBoundsUpdate = (type: BoundsDisposition) => {
      if (
        tabAssociation &&
        !dialog.tabIds.includes(appWindow.viewManager.selectedId)
      ) {
        onWindowBoundsUpdate?.(type);
      }
    };

    windowEvents.move = () => emitWindowBoundsUpdate('move');
    windowEvents.resize = () => emitWindowBoundsUpdate('resize');

    if (tabAssociation) {
      appWindow.viewManager.on('removed', tabsEvents.remove!);
      appWindow.viewManager.on('activated', tabsEvents.activate!);
    }

    if (onWindowBoundsUpdate) {
      browserWindow.on('resize', windowEvents.resize!);
      browserWindow.on('move', windowEvents.move!);
    }

    webContentsView.webContents.once('dom-ready', () => {
      dialog.rearrange();
      // Attach only now to avoid any opaque paint.
      try {
        browserWindow.contentView.addChildView(webContentsView);
      } catch {}
      webContentsView.webContents.focus();
    });

    if (process.env.NODE_ENV === 'development') {
      webContentsView.webContents.loadURL(`http://localhost:4444/${name}.html`);
    } else {
      const filePath = join(app.getAppPath(), 'build', `${name}.html`);
      webContentsView.webContents.loadFile(filePath);
    }

    ipcMain.on(`hide-${webContentsView.webContents.id}`, () => {
      dialog.hide();
    });

    if (tabAssociation) {
      dialog.on('loaded', () => {
        dialog._sendTabInfo(tabAssociation.tabId!);
      });

      if (tabAssociation.setTabInfo) {
        dialog.on('update-tab-info', (e, tabId, ...args) => {
          tabAssociation.setTabInfo!(tabId, ...args);
        });
      }
    }

    this.dialogs.push(dialog);

    return dialog;
  }

  public getContentViews = () => {
    return this.childViews.concat(
      Array.from(this.persistentDialogs).map((x) => x.webContentsView),
    );
    // Note: PersistentDialog already applies the same transparency fixes.
  };

  public destroy = () => {
    this.getContentViews().forEach((view) => {
      try {
        Application.instance.windows.list.forEach((window) => {
          try {
            window.win.contentView.removeChildView(view);
          } catch {}
        });
        try {
          if (!view.webContents.isDestroyed()) {
            view.webContents.loadURL('about:blank');
          }
        } catch {}
        (view as any).destroy?.();
      } catch (e) {
        console.error('Error destroying browser view:', e);
      }
    });
    this.childViews = [];
    this.contentViewDetails.clear();
  };

  public sendToAll = (channel: string, ...args: any[]) => {
    this.getContentViews().forEach(
      (x) =>
        !x.webContents.isDestroyed() && x.webContents.send(channel, ...args),
    );
  };

  public get(name: string) {
    return this.getDynamic(name) || this.getPersistent(name);
  }

  public getDynamic(name: string) {
    return this.dialogs.find((x) => x.name === name);
  }

  public getPersistent(name: string) {
    return this.persistentDialogs.find((x) => x.name === name);
  }

  public isVisible = (name: string) => {
    return this.getDynamic(name) || this.getPersistent(name)?.visible;
  };
}
