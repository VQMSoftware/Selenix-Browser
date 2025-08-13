/* eslint-disable */
const {
  getConfig,
  applyEntries,
  getBaseConfig,
  dev,
} = require('./webpack.config.base');
const { join } = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const webpack = require('webpack');
/* eslint-enable */

const PORT = 4444;

const appConfig = getConfig(getBaseConfig('app'), {
  target: 'web',

  devServer: {
    // In webpack‑dev‑server v4 the old `contentBase` and `disableHostCheck`
    // options have been removed. Use the `static` property to serve static
    // content and `allowedHosts` to relax host checking. See the
    // migration guide for details.
    static: {
      directory: join(__dirname, 'build'),
    },
    port: PORT,
    hot: true,
    // Allow connections from any host. This replaces the deprecated
    // `disableHostCheck` option.
    allowedHosts: 'all',
  },

  plugins: dev
    ? [
        new webpack.HotModuleReplacementPlugin(),
        new ReactRefreshWebpackPlugin(),
      ]
    : [],
  // Override externals for renderer: do not treat 'electron' as an external
  // module. The default base config externalises 'electron' via require,
  // which causes `require('electron')` to be called at runtime in a web
  // environment and results in "require is not defined" errors. We remove
  // the electron external here so webpack attempts to resolve it normally.
  externals: {
    // Copy other externals from the base config except for electron. These
    // will be merged by webpack-merge. We use a function here that will
    // delegate unknown externals back to webpack. See
    // https://webpack.js.org/configuration/externals/ for details.
  },
  // Alias 'electron' to '@electron/remote' in the renderer. This ensures
  // imports such as `import { ipcRenderer } from 'electron'` are resolved
  // to the remote module, which proxies Electron APIs through IPC. Without
  // this alias, webpack would attempt to bundle the native electron module
  // which is not available in a sandboxed WebContentsViews.
  resolve: {
    alias: {
      ...(getBaseConfig('app').resolve?.alias || {}),
      electron: '@electron/remote',
    },
  },
});

const extPopupConfig = getConfig({
  target: 'web',

  entry: {},
  output: {},
});

applyEntries(appConfig, [
  ...(process.env.ENABLE_AUTOFILL ? ['form-fill', 'credentials'] : []),
  'app',
  'permissions',
  'auth',
  'find',
  'menu',
  'search',
  'preview',
  'tabgroup',
  'downloads-dialog',
  'add-bookmark',
  'zoom',
  'settings',
  'history',
  'newtab',
  'bookmarks',
]);

if (process.env.ENABLE_EXTENSIONS) {
  extPopupConfig.entry['extension-popup'] = [
    `./src/renderer/views/extension-popup`,
  ];
  extPopupConfig.plugins.push(
    new HtmlWebpackPlugin({
      title: 'selenix',
      template: 'static/pages/extension-popup.html',
      filename: `extension-popup.html`,
      chunks: [`vendor.app`, 'extension-popup'],
    }),
  );

  module.exports = [appConfig, extPopupConfig];
} else {
  module.exports = appConfig;
}
