import { observable, computed, makeObservable } from 'mobx';
import { EXTENSIONS_PROTOCOL } from '~/constants';
// The Node.js `url` module is no longer bundled by default in recent versions
// of Webpack. To build URLs in the renderer process we leverage the
// WHATWG `URL` constructor instead of `url.format`. See
// https://developer.mozilla.org/en-US/docs/Web/API/URL/URL for details.

interface Options {
  icon: string;
  title: string;
  popup: string;
  extensionId: string;
}

export class IBrowserAction {
  // Observable
  public icon?: string = '';

  public _popup?: string = '';

  public title?: string = '';

  public badgeBackgroundColor?: string = 'gray';

  public badgeTextColor?: string = 'white';

  public badgeText?: string = '';

  // Computed
  public get popup() {
    return this._popup;
  }
  // ---

  public set popup(url: string) {
    if (!url) {
      this._popup = null;
    } else if (url.startsWith(EXTENSIONS_PROTOCOL)) {
      this._popup = url;
    } else {
      // Construct the URL for the popup using the WHATWG URL API. This replicates
      // the behaviour of `url.format` by combining the extension protocol,
      // extension ID and the provided path. The base must include the
      // protocol and hostname (extensionId) separated by `//` so that the
      // constructor treats the second argument as a path on the same origin.
      try {
        const base = `${EXTENSIONS_PROTOCOL}//${this.extensionId}`;
        const constructed = new URL(url, base);
        this._popup = constructed.toString();
      } catch {
        // If URL construction fails (e.g. invalid base), fall back to a simple
        // concatenation which mirrors the original behaviour of `url.format`.
        const normalizedPath = url.startsWith('/') ? url : `/${url}`;
        this._popup = `${EXTENSIONS_PROTOCOL}//${this.extensionId}${normalizedPath}`;
      }
    }
  }

  public tabId?: number;

  public extensionId?: string;

  public wasOpened = false;

  public constructor(options: Options) {
    makeObservable(this, {
      icon: observable,
      _popup: observable,
      title: observable,
      badgeBackgroundColor: observable,
      badgeText: observable,
      badgeTextColor: observable,
      popup: computed,
    });

    const { icon, title, extensionId, popup } = options;
    this.icon = icon;
    this.title = title;
    this.extensionId = extensionId;
    this.popup = popup;
  }
}
