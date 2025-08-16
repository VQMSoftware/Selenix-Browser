import * as React from 'react';
import { observer } from 'mobx-react-lite';

import {
  Line,
  MenuItem,
  MenuItems,
  Content,
  Icon,
  MenuItemTitle,
  Shortcut,
  RightControl,
} from './style';
import store from '../../store';
import { ipcRenderer } from 'electron';
// Use @electron/remote instead of the deprecated remote module.
import * as remote from '@electron/remote';
import { WEBUI_BASE_URL, WEBUI_URL_SUFFIX } from '~/constants/files';
import { Switch } from '~/renderer/components/Switch';
import {
  ICON_FIRE,
  ICON_TOPMOST,
  ICON_TAB,
  ICON_WINDOW,
  ICON_INCOGNITO,
  ICON_HISTORY,
  ICON_BOOKMARKS,
  ICON_SETTINGS,
  ICON_EXTENSIONS,
  ICON_DOWNLOAD,
  ICON_FIND,
  ICON_PRINT,
} from '~/renderer/constants/icons';
import { getWebUIURL } from '~/common/webui';


// === StrictMode + stable-layout first-open fade ===
const __useInsertion: typeof React.useLayoutEffect =
  // Prefer useInsertionEffect (pre-paint), fall back to layout effect if not available
  (React as any).useInsertionEffect || React.useLayoutEffect;

function __primeHidden(el: HTMLElement) {
  el.style.visibility = 'hidden';
  el.style.opacity = '0';
  el.style.transform = 'translateY(6px)';
  el.style.willChange = 'opacity, transform';
}

function __animateIn(el: HTMLElement) {
  el.style.transition = 'opacity 160ms ease, transform 200ms ease';
  // force a reflow to commit initial styles
  void el.offsetWidth;
  requestAnimationFrame(() => {
    el.style.visibility = 'visible';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
}

function __waitStableLayout(el: HTMLElement, timeoutMs = 350): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    let prevW = -1, prevH = -1;
    let stableFrames = 0;
    function tick() {
      if (!el.isConnected) {
        if (performance.now() - start > timeoutMs) return resolve();
        return requestAnimationFrame(tick);
      }
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (w === prevW && h === prevH && (w > 0 || h > 0)) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
        prevW = w; prevH = h;
      }
      if (stableFrames >= 2) {
        return resolve();
      }
      if (performance.now() - start > timeoutMs) {
        return resolve();
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

async function __readyThenAnimate(el: HTMLElement, didRef: { current: boolean }) {
  if (didRef.current) return; // guard StrictMode double-call
  didRef.current = true;
  try {
    if ('fonts' in document && (document as any).fonts?.ready) {
      await (document as any).fonts.ready;
    }
  } catch {}
  await __waitStableLayout(el, 400);
  __animateIn(el);
}
// === /fix ===


const onFindClick = () => {
  /*
  // TODO(sentialx): get selected tab
  ipcRenderer.send(
    `find-show-${store.windowId}`,
    store.tabs.selectedTab.id,
    store.tabs.selectedTab.findInfo,
  );*/
};

const onDarkClick = () => {
  // Toggle dark contents and persist via store.save() (now a no-op shim if not implemented).
  store.settings.darkContents = !store.settings.darkContents;
  store.save();
};

const onPrintClick = () => {
  ipcRenderer.send('Print', null);
  store.hide();
};

const onFindInPageClick = () => {
  ipcRenderer.send(`find-in-page-${store.windowId}`);
  store.hide();
};

const onAlwaysClick = () => {
  store.alwaysOnTop = !store.alwaysOnTop;
  remote.getCurrentWindow().setAlwaysOnTop(store.alwaysOnTop);
};

const onNewWindowClick = () => {
  ipcRenderer.send('create-window');
};

const onIncognitoClick = () => {
  ipcRenderer.send('create-window', true);
};

const addNewTab = (url: string) => {
  ipcRenderer.send(`add-tab-${store.windowId}`, {
    url,
    active: true,
  });
  store.hide();
};

const goToWebUIPage = (name: string) => () => {
  addNewTab(getWebUIURL(name));
};

const goToURL = (url: string) => () => {
  addNewTab(url);
};

/**
 * Handle the click on the update entry.
 * Single-click → download + restart (wired in store.triggerUpdate()).
 * No progress UI, no text changes.
 */
const onUpdateClick = () => {
  store.triggerUpdate();
};

export const QuickMenu = observer(() => {
  const __qmRef = React.useRef<HTMLDivElement | null>(null);
  const __didOnce = React.useRef(false);

  // Pre-paint hide to avoid flicker even in StrictMode
  __useInsertion(() => {
    const el = __qmRef.current;
    if (!el) return;
    __primeHidden(el);
  }, []);

  // After mount, wait for layout to settle, then animate exactly once
  React.useLayoutEffect(() => {
    const el = __qmRef.current;
    if (!el || __didOnce.current) return;
    __readyThenAnimate(el, __didOnce);
  }, []);

  return (
    <div ref={__qmRef}
      style={{
        display: 'flex',
        flexFlow: 'column',
      }}
    >
      <Content>
        <MenuItems>
          {/* Update entry. Show only when an update is available. */}
          {store.updateAvailable && (
            <>
              <MenuItem onClick={onUpdateClick}>
                <Icon icon={ICON_FIRE}></Icon>
                <MenuItemTitle>
                  {`Update ${remote.app.name}`}
                </MenuItemTitle>
              </MenuItem>
              <Line />
            </>
          )}

          <MenuItem onClick={onAlwaysClick}>
            <Icon icon={ICON_TOPMOST} />
            <MenuItemTitle>Always on top</MenuItemTitle>
            <RightControl>
              <Switch dense value={store.alwaysOnTop}></Switch>
            </RightControl>
          </MenuItem>
          <Line />
          <MenuItem onClick={goToWebUIPage('newtab')}>
            <Icon icon={ICON_TAB} />
            <MenuItemTitle>New tab</MenuItemTitle>
            <Shortcut>Ctrl+T</Shortcut>
          </MenuItem>
          <MenuItem onClick={onNewWindowClick}>
            <Icon icon={ICON_WINDOW} />
            <MenuItemTitle>New window</MenuItemTitle>
            <Shortcut>Ctrl+N</Shortcut>
          </MenuItem>
          <MenuItem onClick={onIncognitoClick}>
            <Icon icon={ICON_INCOGNITO} />
            <MenuItemTitle>New incognito window</MenuItemTitle>
            <Shortcut>Ctrl+Shift+N</Shortcut>
          </MenuItem>
          <Line />
          <MenuItem onClick={goToWebUIPage('history')} arrow>
            <Icon icon={ICON_HISTORY} />
            <MenuItemTitle>History</MenuItemTitle>
          </MenuItem>
          <MenuItem onClick={goToWebUIPage('bookmarks')} arrow>
            <Icon icon={ICON_BOOKMARKS} />
            <MenuItemTitle>Bookmarks</MenuItemTitle>
          </MenuItem>
          <MenuItem disabled onClick={goToWebUIPage('downloads')}>
            <Icon icon={ICON_DOWNLOAD} />
            <MenuItemTitle>Downloads</MenuItemTitle>
          </MenuItem>
          <Line />
          <MenuItem onClick={goToWebUIPage('settings')}>
            <Icon icon={ICON_SETTINGS} />
            <MenuItemTitle>Settings</MenuItemTitle>
          </MenuItem>
          {/* TODO: <MenuItem onClick={goToWebUIPage('extensions')}> */}
          <MenuItem
            onClick={goToURL(
              'https://chrome.google.com/webstore/category/extensions',
            )}
          >
            <Icon icon={ICON_EXTENSIONS} />
            <MenuItemTitle>Extensions</MenuItemTitle>
          </MenuItem>
          <Line />
          <MenuItem onClick={onFindInPageClick}>
            <Icon icon={ICON_FIND} />
            <MenuItemTitle>Find in page</MenuItemTitle>
            <Shortcut>Ctrl+F</Shortcut>
          </MenuItem>
          <MenuItem onClick={onPrintClick}>
            <Icon icon={ICON_PRINT} />
            <MenuItemTitle>Print</MenuItemTitle>
            <Shortcut>Ctrl+P</Shortcut>
          </MenuItem>
        </MenuItems>
      </Content>
    </div>
  );
});
