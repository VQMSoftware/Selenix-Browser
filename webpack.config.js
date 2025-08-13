/* eslint-disable */
const { getConfig, dev } = require('./webpack.config.base');
const { spawn, execSync } = require('child_process');
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

let terser = require('terser');
/* eslint-enable */

let electronProcess;

const mainConfig = getConfig({
  target: 'electron-main',

  devtool: dev ? 'inline-source-map' : false,

  watch: dev,

  entry: {
    main: './src/main',
  },

  plugins: [
    new CopyPlugin({
      patterns: [
        {
          // Use the package's exported entry (no subpath) to satisfy "exports"
          from: require.resolve('@ghostery/adblocker-electron-preload'),
          to: 'preload.js',
          transform: async (fileContent) =>
            (await terser.minify(fileContent.toString())).code.toString(),
        },
      ],
    }),
  ],
});

const preloadConfig = getConfig({
  target: 'web',

  devtool: false,

  watch: dev,

  entry: {
    'view-preload': './src/preloads/view-preload',
  },

  plugins: [
    new ForkTsCheckerWebpackPlugin({
      async: dev,
      typescript: {
        memoryLimit: 4096,
        mode: 'readonly',
        configFile: 'tsconfig.json',
        typescriptPath: require.resolve('typescript'),
      },
    }),
    ...(process.env.ANALYZE ? [new BundleAnalyzerPlugin()] : []),
  ],
});

if (process.env.ENABLE_EXTENSIONS) {
  preloadConfig.entry['popup-preload'] = './src/preloads/popup-preload';
  preloadConfig.entry['extensions-preload'] = './src/preloads/extensions-preload';
}

if (process.env.START === '1') {
  mainConfig.plugins.push({
    apply: (compiler) => {
      compiler.hooks.afterEmit.tap('AfterEmitPlugin', () => {
        if (electronProcess) {
          try {
            if (process.platform === 'win32') {
              execSync(`taskkill /pid ${electronProcess.pid} /f /t`);
            } else {
              electronProcess.kill();
            }
            electronProcess = null;
          } catch (e) {}
        }

        // Launch a new Electron process without inheriting the NODE_OPTIONS
        // environment variable. The build pipeline sets NODE_OPTIONS to
        // --openssl-legacy-provider for Webpack builds; however Electron
        // rejects unknown options in NODE_OPTIONS. By creating a copy of
        // process.env and deleting NODE_OPTIONS, we ensure Electron starts
        // normally. See https://nodejs.org/api/cli.html#node_options for details.
        const envCopy = { ...process.env };
        if (envCopy.NODE_OPTIONS) {
          delete envCopy.NODE_OPTIONS;
        }
        electronProcess = spawn('npm', ['start'], {
          shell: true,
          env: envCopy,
          stdio: 'inherit',
        });
      });
    },
  });
}

module.exports = [mainConfig, preloadConfig];
