import { ipcRenderer } from 'electron';
import { makeObservable, observable } from 'mobx';
import { DialogStore } from '~/models/dialog-store';

/**
 * Minimal store for the Quick Menu.
 * Shows the update button when main says so; click triggers download+restart.
 * Any errors are also sent to renderer (main already shows a native popup).
 */
export class Store extends DialogStore {
  public alwaysOnTop = false;

  public updateAvailable = false;
  public updateError: string | null = null;

  constructor() {
    super();

    // Use makeObservable (compatible with subclasses).
    makeObservable(this, {
      alwaysOnTop: observable,
      updateAvailable: observable,
      updateError: observable,
    });

    this.registerIpcHandlers();
  }

  private registerIpcHandlers() {
    ipcRenderer.on('always-on-top-change', (_e, value: boolean) => {
      this.setAlwaysOnTop(value);
    });

    ipcRenderer.on('update-available', () => {
      this.setUpdateAvailable(true);
      this.setUpdateError(null);
    });

    ipcRenderer.on('update-not-available', () => {
      this.setUpdateAvailable(false);
    });

    ipcRenderer.on('update-error', (_e, message: string) => {
      // Keep a copy in store; the native popup already fired in main.
      this.setUpdateError(message || 'Update failed');
      // If you also want a renderer-side popup, uncomment:
      // try {
      //   const remote = require('@electron/remote');
      //   remote.dialog.showErrorBox('Update Error', this.updateError!);
      // } catch {}
    });

    // Ensure we know state on open
    ipcRenderer.send('update-check');
  }

  // Called by QuickMenu button
  public triggerUpdate() {
    ipcRenderer.send('update-download-and-install');
  }

  // Back-compat shim; harmless no-op.
  public save(): void {}

  // setters
  public setAlwaysOnTop(value: boolean) {
    this.alwaysOnTop = value;
  }
  public setUpdateAvailable(flag: boolean) {
    this.updateAvailable = flag;
  }
  public setUpdateError(message: string | null) {
    this.updateError = message;
  }
}

export default new Store();
