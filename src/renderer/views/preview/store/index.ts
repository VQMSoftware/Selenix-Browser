import { ipcRenderer } from 'electron';
import { observable, computed, makeObservable } from 'mobx';
// Webpack 5 no longer provides polyfills for Node.js core modules like
// `url`. Since the renderer runs in a browser context, we use the
// WHATWG `URL` constructor instead of Node's `url.parse`. See
// https://developer.mozilla.org/en-US/docs/Web/API/URL for details.
import { WEBUI_BASE_URL, WEBUI_PROTOCOL } from '~/constants/files';
import { DialogStore } from '~/models/dialog-store';

export class Store extends DialogStore {
  private timeout: any;
  private timeout1: any;

  // Observable

  public title = '';

  public url = '';

  public x = 0;

  public xTransition = false;

  // Computed

  public get domain() {
    let protocol: string | undefined;
    let hostname: string | undefined;
    try {
      // Use the WHATWG URL API to parse the URL. This gives us access to
      // `protocol` and `hostname` properties directly. If the URL is invalid
      // (e.g. an empty string), the constructor will throw.
      const parsed = new URL(this.url);
      protocol = parsed.protocol;
      hostname = parsed.hostname;
    } catch {
      protocol = undefined;
      hostname = undefined;
    }

    if (
      WEBUI_BASE_URL.startsWith(WEBUI_PROTOCOL) &&
      this.url.startsWith(WEBUI_BASE_URL)
    ) {
      return `${protocol ?? ''}//${hostname ?? ''}`;
    }

    if (protocol === 'file:') {
      return 'local or shared file';
    }

    return hostname ?? '';
  }

  constructor() {
    super({ visibilityWrapper: false, persistent: true });

    makeObservable(this, {
      title: observable,
      url: observable,
      x: observable,
      xTransition: observable,
      domain: computed,
    });

    ipcRenderer.on('visible', (e, visible, tab) => {
      clearTimeout(this.timeout);
      clearTimeout(this.timeout1);

      if (!visible) {
        this.visible = false;
      }

      if (visible) {
        this.timeout1 = setTimeout(() => {
          this.xTransition = true;
        }, 80);
      } else if (!visible) {
        this.timeout = setTimeout(() => {
          this.xTransition = false;
        }, 100);
      }

      if (tab) {
        this.title = tab.title;
        this.url = tab.url;
        this.x = tab.x;

        if (visible && this.title !== '' && this.url !== '') {
          this.visible = visible;
        }
      }
    });
  }
}

export default new Store();
