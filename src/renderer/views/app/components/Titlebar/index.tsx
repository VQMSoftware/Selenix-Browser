import { observer } from 'mobx-react-lite';
import * as React from 'react';
// Import ipcRenderer from electron and remote from the external package since
// the built-in remote was removed from recent Electron versions.
import { ipcRenderer } from 'electron';
import * as remote from '@electron/remote';

import store from '../../store';
import { Tabbar } from '../Tabbar';
import { platform } from 'os';
import { StyledTitlebar, FullscreenExitButton } from './style';
import { NavigationButtons } from '../NavigationButtons';
import { RightButtons } from '../RightButtons';

const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
  if (store.addressbarFocused) {
    e.preventDefault();
  }
};

const onFullscreenExit = (e: React.MouseEvent<HTMLDivElement>) => {
  remote.getCurrentWindow().setFullScreen(false);
};

export const Titlebar = observer(() => {
  return (
    <StyledTitlebar
      onMouseDown={onMouseDown}
      isFullscreen={store.isFullscreen}
      isHTMLFullscreen={store.isHTMLFullscreen}
    >
      {store.isCompact && <NavigationButtons />}
      <Tabbar />
      {store.isCompact && <RightButtons />}

      {/* When using native OS window controls, we don't render custom controls.
          On Linux, if we're in fullscreen, show an explicit exit button since
          native controls are typically hidden in fullscreen. */}
      {platform() === 'linux' && store.isFullscreen && (
        <FullscreenExitButton
          style={{
            height: store.isCompact ? '100%' : 32,
          }}
          onMouseUp={onFullscreenExit}
          theme={store.theme}
        />
      )}
    </StyledTitlebar>
  );
});
