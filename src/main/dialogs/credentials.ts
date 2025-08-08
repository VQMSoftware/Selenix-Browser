import { VIEW_Y_OFFSET } from '~/constants/design';
import { AppWindow } from '../windows';
import { PersistentDialog } from './dialog'; // Changed from Dialog to PersistentDialog

const WIDTH = 350;
const HEIGHT = 271;

export class CredentialsDialog extends PersistentDialog {
  public appWindow: AppWindow;
  public declare browserWindow: Electron.BrowserWindow; // Add this declaration

  public constructor(appWindow: AppWindow) {
    super({
      name: 'credentials',
      bounds: {
        height: HEIGHT,
        width: WIDTH,
        y: VIEW_Y_OFFSET,
      },
    });

    this.appWindow = appWindow;
    this.browserWindow = appWindow.win;
  }

  public rearrange() {
    const { width } = this.appWindow.win.getContentBounds();
    super.rearrange({
      x: width - WIDTH,
    });
  }
}