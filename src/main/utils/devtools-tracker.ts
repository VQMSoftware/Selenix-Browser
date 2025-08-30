import { Application } from '../application';
import { DevToolsMode } from '~/interfaces';

/**
 * Utility to track and persist devtools dock mode changes
 */
export class DevToolsTracker {
  private static trackedWebContents = new Set<Electron.WebContents>();

  /**
   * Start tracking devtools dock mode changes for a webContents
   */
  static track(webContents: Electron.WebContents): void {
    if (this.trackedWebContents.has(webContents)) {
      return; // Already tracking
    }

    this.trackedWebContents.add(webContents);

    // Track when devtools is opened
    const onDevToolsOpened = () => {
      const devTools = webContents.devToolsWebContents;
      if (devTools) {
        // Listen for devtools focus events which can indicate dock state changes
        const onDevToolsFocused = () => {
          // When devtools is focused, check if user manually changed dock state
          // This is a heuristic approach since there's no direct dock-state-changed event
          this.checkAndSaveDevToolsMode(webContents);
        };

        devTools.on('focus', onDevToolsFocused);
        
        // Clean up when devtools is closed
        devTools.once('destroyed', () => {
          devTools.removeAllListeners('focus');
        });
      }
    };

    // Track when devtools is closed
    const onDevToolsClosed = () => {
      // Save final state when devtools is closed
      this.checkAndSaveDevToolsMode(webContents);
    };

    webContents.on('devtools-opened', onDevToolsOpened);
    webContents.on('devtools-closed', onDevToolsClosed);

    // Clean up when webContents is destroyed
    webContents.once('destroyed', () => {
      this.trackedWebContents.delete(webContents);
      webContents.removeAllListeners('devtools-opened');
      webContents.removeAllListeners('devtools-closed');
    });
  }

  /**
   * Manually save a devtools mode (can be called when we know the user changed it)
   */
  static saveDevToolsMode(mode: DevToolsMode): void {
    const settings = Application.instance.settings;
    if (settings.object.devToolsMode !== mode) {
      settings.updateSettings({ devToolsMode: mode });
    }
  }

  /**
   * Get the current saved devtools mode
   */
  static getCurrentMode(): DevToolsMode {
    const settings = Application.instance.settings;
    return settings.object.devToolsMode || 'bottom';
  }

  /**
   * Heuristic to check if devtools dock mode might have changed
   * This is called periodically to detect manual dock state changes
   */
  private static checkAndSaveDevToolsMode(webContents: Electron.WebContents): void {
    // Since we can't directly detect dock state changes, we'll use a simple heuristic:
    // If devtools is open and detached (separate window), assume it's 'undocked' or 'detach'
    // This is not perfect but better than losing user preferences
    if (webContents.isDevToolsOpened()) {
      const devTools = webContents.devToolsWebContents;
      if (devTools && devTools.isFocused && devTools.isFocused()) {
        // If devtools has focus and is in a separate window, it's likely undocked/detached
        // We'll default to 'undocked' as it's more common than 'detach'
        const currentMode = this.getCurrentMode();
        if (currentMode === 'bottom' || currentMode === 'right') {
          // User likely undocked from docked state
          this.saveDevToolsMode('undocked');
        }
      }
    }
  }
}