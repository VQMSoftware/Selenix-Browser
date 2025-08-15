import { observable, computed, makeObservable } from 'mobx';
import { ISettings, ITheme, IVisitedItem } from '~/interfaces';
import { getTheme } from '~/utils/themes';
import { INewsItem } from '~/interfaces/news-item';
import { networkMainChannel } from '~/common/rpc/network';

type NewsBehavior = 'on-scroll' | 'always-visible' | 'hidden';
export type Preset = 'focused' | 'inspirational' | 'informational' | 'custom';

export class Store {
  @observable
  public settings: ISettings = { ...(window as any).settings };

  @computed
  public get theme(): ITheme {
    return getTheme(this.settings.theme);
  }

  @observable
  public news: INewsItem[] = [];

  @observable
  private _newsBehavior: NewsBehavior = 'on-scroll';

  @computed
  public get newsBehavior() {
    return this._newsBehavior;
  }

  public set newsBehavior(value: NewsBehavior) {
    this._newsBehavior = value;

    if (value === 'always-visible') {
      // Ensure we have at least one page of news ready
      this.loadNews().catch(console.error);
    }
  }

  @computed
  public get fullSizeImage() {
    // return this.newsBehavior === 'on-scroll' || this.newsBehavior === 'hidden';
    return true;
  }

  @observable
  public image = '';

  @observable
  private _imageVisible = true;

  public set imageVisible(value: boolean) {
    this._imageVisible = value;
    if (value && this.image === '') this.loadImage();
  }

  @computed
  public get imageVisible() {
    return this._imageVisible;
  }

  @observable
  private _changeImageDaily = true;

  public get changeImageDaily() { return this._changeImageDaily; }
  public set changeImageDaily(value: boolean) {
    const was = this._changeImageDaily;
    this._changeImageDaily = value;
    try { localStorage.setItem('changeImageDaily', JSON.stringify(value)); } catch {}

    // Only clear & refetch when toggling from false -> true.
    if (!was && value) {
      try {
        localStorage.removeItem('imageURL');
        localStorage.removeItem('imageDate');
        localStorage.removeItem('imageData'); // clear cached pixels
      } catch {}
      this.image = '';
      if (this.imageVisible) this.loadImage();
    }
  }

  @observable
  public topSitesVisible = true;

  @observable
  public quickMenuVisible = true;

  @observable
  public overflowVisible = false;

  @observable
  private _preferencesContent: 'main' | 'custom' = 'main';

  public set preferencesContent(value: 'main' | 'custom') {
    this._preferencesContent = value;
    this.overflowVisible = false;
  }

  @computed
  public get preferencesContent() {
    return this._preferencesContent;
  }

  @observable
  private _dashboardSettingsVisible = false;

  public set dashboardSettingsVisible(value: boolean) {
    this._dashboardSettingsVisible = value;

    if (!value) {
      this.preferencesContent = 'main';
    }
  }

  @computed
  public get dashboardSettingsVisible() {
    return this._dashboardSettingsVisible;
  }

  @observable
  private _preset: Preset = 'inspirational';

  @computed
  public get preset() {
    return this._preset;
  }

  public set preset(value: Preset) {
    this._preset = value;

    if (['focused', 'informational', 'inspirational'].includes(value)) {
      this.quickMenuVisible = true;
      this.topSitesVisible = true;
      // Only set to true if it's not already true, to avoid wiping cache.
      if (!this._changeImageDaily) this.changeImageDaily = true;
    }

    if (['focused', 'inspirational'].includes(value)) {
      this.newsBehavior = 'on-scroll';
    }

    if (['informational', 'inspirational'].includes(value)) {
      this.imageVisible = true;
    }

    if (value === 'focused') {
      this.imageVisible = false;
    } else if (value === 'informational') {
      this.newsBehavior = 'always-visible';
    }

    localStorage.setItem('preset', value);
  }

  private page = 1;
  private loaded = true;

  @observable
  public topSites: IVisitedItem[] = [];

  public constructor() {
    makeObservable(this);

    (window as any).updateSettings = (settings: ISettings) => {
      this.settings = { ...this.settings, ...settings };
    };

    this._preset = (localStorage.getItem('preset') as Preset) || this._preset;

    if (this._preset === 'custom') {
      [
        'changeImageDaily',
        'quickMenuVisible',
        'topSitesVisible',
        'imageVisible',
      ].forEach((x) => {
        const raw = localStorage.getItem(x);
        (this as any)[x] = raw == null ? (this as any)[x] : JSON.parse(raw);
      });

      const nb = localStorage.getItem('newsBehavior') as NewsBehavior | null;
      if (nb) this.newsBehavior = nb;
    } else {
      // Apply preset without resetting daily cache unnecessarily
      this.preset = this._preset;
    }

    if (this.imageVisible) {
      this.loadImage();
    }

    // Load top sites initially
    this.loadTopSites().catch(console.error);

    // window.onscroll = () => {
    //   this.updateNews();
    // };

    // window.onresize = () => {
    //   this.updateNews();
    // };
  }

  public async loadImage() {
    // Stable local "today" key
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    const todayKey = `${y}-${m}-${d}`;

    // Normalize stored date (supports old formats)
    const toKey = (s: string): string | null => {
      if (!s) return null;
      if (/\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      const dt = new Date(s);
      if (isNaN(dt.getTime())) return null;
      const yy = dt.getFullYear();
      const mm = (dt.getMonth() + 1).toString().padStart(2, '0');
      const dd = dt.getDate().toString().padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    };

    const savedDate = localStorage.getItem('imageDate') || '';
    const savedKey = toKey(savedDate);
    const cachedDataUrl = localStorage.getItem('imageData'); // cached pixels

    // If daily mode ON and we already have today's pixels, use them without any network request.
    if (this._changeImageDaily && cachedDataUrl && savedKey === todayKey) {
      this.image = cachedDataUrl;
      return;
    }

    // Otherwise, fetch a new image and cache the actual pixels as a data URL.
    const pickUrl = () => {
      // If you have a "custom provider" toggle elsewhere, branch here.
      return 'https://picsum.photos/1920/1080';
    };

    const url = pickUrl();

    try {
      const resp = await fetch(url);
      const blob = await resp.blob();

      // Convert blob -> data URL so we store exact pixels and avoid provider randomness
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      this.image = dataUrl;

      // Persist both the resolved URL (optional) and the actual pixels (mandatory)
      try {
        localStorage.setItem('imageURL', resp.url || url);
        localStorage.setItem('imageData', dataUrl);
        localStorage.setItem('imageDate', todayKey);
      } catch {
        // ignore quota/failure
      }
    } catch (e) {
      console.error(e);
      // If fetch fails but we have any cached pixels, prefer showing them
      if (cachedDataUrl) {
        this.image = cachedDataUrl;
      }
    }
  }

  // === Methods required elsewhere ===

  public async loadTopSites() {
    try {
      this.topSites = await (window as any).getTopSites(8);
    } catch (e) {
      console.error('loadTopSites failed:', e);
      this.topSites = [];
    }
  }

  public async loadNews() {
    try {
      // Replace '' with your real endpoint or add params like ?lang=
      const { data } = await networkMainChannel.getInvoker().request('');
      const json = JSON.parse(data);

      if (json && Array.isArray(json.articles)) {
        if (this.page === 1) {
          this.news = json.articles;
        } else {
          this.news = this.news.concat(json.articles);
        }
        this.page += 1;
        this.loaded = true;
      } else {
        throw new Error('Error fetching news');
      }
    } catch (e) {
      console.error('loadNews failed:', e);
      throw e;
    }
  }
}

export default new Store();
