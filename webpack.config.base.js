/* eslint-disable */
const { resolve } = require('path');
const { merge } = require('webpack-merge');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const createStyledComponentsTransformer =
  require('typescript-plugin-styled-components').default;
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
/* eslint-enable */

const INCLUDE = resolve(__dirname, 'src');

const BUILD_FLAGS = {
  ENABLE_EXTENSIONS: true,
  ENABLE_AUTOFILL: false,
};

// expose flags to app
process.env = {
  ...process.env,
  ...BUILD_FLAGS,
};

const dev = process.env.DEV === '1';
process.env.NODE_ENV = dev ? 'development' : 'production';

const styledComponentsTransformer = createStyledComponentsTransformer({
  minify: !dev,
  displayName: dev,
});

const tsLoader = {
  loader: 'ts-loader',
  options: {
    experimentalWatchApi: dev,
    transpileOnly: true, // keep typechecking in a separate plugin if desired
    getCustomTransformers: () => ({
      before: [styledComponentsTransformer],
    }),
  },
};

const rules = [
  {
    test: /\.(png|jpe?g|gif|svg|ico|icns)$/i,
    type: 'asset/resource',
    generator: {
      filename: 'res/[name].[contenthash:8][ext]',
    },
  },

  // Fonts (also through asset modules)
  {
    test: /\.(woff2?|eot|ttf|otf)$/i,
    type: 'asset/resource',
    generator: {
      filename: 'res/fonts/[name].[contenthash:8][ext]',
    },
  },

  // TypeScript / TSX
  {
    test: /\.(tsx?|ts)$/,
    include: INCLUDE,
    use: dev
      ? [
          // put babel first in dev so react-refresh works
          {
            loader: 'babel-loader',
            options: { plugins: ['react-refresh/babel'] },
          },
          tsLoader,
        ]
      : [tsLoader],
  },
];

const config = {
  mode: dev ? 'development' : 'production',

  devtool: dev ? 'eval-source-map' : false,

  output: {
    path: resolve(__dirname, 'build'),
    filename: '[name].bundle.js',
    // Use a non-MD4 hash to avoid OpenSSL 3 errors
    hashFunction: 'xxhash64',
    assetModuleFilename: 'res/[name].[contenthash:8][ext]',
  },

  module: { rules },

  // Electron-friendly
  node: {
    __dirname: false,
    __filename: false,
  },

  resolve: {
    modules: ['node_modules'],
    extensions: ['.js', '.jsx', '.tsx', '.ts', '.json'],
    alias: { '~': INCLUDE },
    plugins: [new TsconfigPathsPlugin()],
  },

  plugins: [
    new webpack.EnvironmentPlugin(['NODE_ENV', ...Object.keys(BUILD_FLAGS)]),
    // keep fast TS typechecking separate if you want (optional, safe to keep)
    new ForkTsCheckerWebpackPlugin({
      async: dev,
      typescript: {
        diagnosticOptions: { semantic: true, syntactic: true },
      },
    }),
  ],

  externals: {
    keytar: `require('keytar')`,
    electron: 'require("electron")',
    fs: 'require("fs")',
    os: 'require("os")',
    path: 'require("path")',
  },

  optimization: {
    minimize: !dev,
    minimizer: !dev
      ? [
          new TerserPlugin({
            extractComments: true,
            terserOptions: {
              ecma: 2017,
              output: { comments: false },
            },
            parallel: true,
          }),
        ]
      : [],
  },
};

// Helper utilities preserved from your original file

function getConfig(...cfg) {
  return merge(config, ...cfg);
}

const getHtml = (name) =>
  new HtmlWebpackPlugin({
    title: 'Wexond',
    template: 'static/pages/app.html',
    filename: `${name}.html`,
    chunks: [name],
  });

const applyEntries = (cfg, entries) => {
  for (const entry of entries) {
    cfg.entry[entry] = [
      `./src/renderer/pre-entry`,
      `./src/renderer/views/${entry}`,
    ];
    cfg.plugins.push(getHtml(entry));
  }
};

const getBaseConfig = (name) => {
  const cfg = {
    plugins: [],

    output: {},

    entry: {},

    optimization: {
      runtimeChunk: { name: `runtime.${name}` },
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: Infinity,
      },
    },
  };

  return cfg;
};

module.exports = { getConfig, dev, getHtml, applyEntries, getBaseConfig };
