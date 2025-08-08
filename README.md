> NOTICE: This project at the time of writing this uses out of date packages and components, i am working to update everything and add improvements along the way.

<p align="center">
  <a href="https://vqmsoftware.github.io"><img src="static/icons/icon.png" width="256"></a>
</p>

<div align="center">
  <h1>Selenix Browser</h1>

[![Build Status](https://github.com/VQMSoftware/selenix-Browser/actions/workflows/build.yml/badge.svg)](https://github.com/VQMSoftware/selenix-Browser/actions)
[![Downloads](https://img.shields.io/github/downloads/VQMSoftware/selenix-Browser/total.svg?style=flat-square)](https://VQMSoftware.github.io)
[![Discord](https://discordapp.com/api/guilds/1402495455077732422/widget.png?style=shield)](https://discord.gg/x6BKcWM4pf)

selenix is a web browser built from wexond base (the version used was prior to them closing the code), on top of modern web technologies such as `Electron` and `React`, that can also be used as a framework to create a custom web browser (see the [License](#license) section).

</div>

# Table of Contents:
- [Motivation](#motivation)
- [Features](#features)
- [Screenshots](#screenshots)
- [Downloads](#downloads)
- [Contributing](#contributing)
- [Development](#development)
  - [Running](#running)
- [Documentation](#documentation)
- [License](#license)

# Motivation

## My Motivation

wexond discontenued and sold there project a while ago, i really love there projects, this repo aims to legally use it as a base with a commit tag that had the GPL license file with it, the spacific one i used is located [`here`](https://github.com/wexond/browser-base/tree/v5.2.0)

## There original Motivation statment.

Compiling and editing Chromium directly may be challenging and time consuming, so we decided to build Wexond with modern web technologies. Hence, the development effort and time is greatly reduced. Either way Firefox is based on Web Components and Chrome implements new dialogs in WebUI (which essentially is hosted in WebContents).

# Features

- **selenixShield** - Browse the web without any ads and don't allow websites to track you. Thanks to the selenixShield powered by [Cliqz](https://github.com/cliqz-oss/adblocker), websites can load even 8 times faster!
- **Chromium without Google services and low resources usage** - Since selenixuses Electron and wexond under the hood which is based on only several and the most important Chromium components, it's not bloated with redundant Google tracking services and others.
- **Fast and fluent UI** - The animations are really smooth and their timings are perfectly balanced.
- **Highly customizable new tab page** - Customize almost an every aspect of the new tab page!
- **Customizable browser UI** - Choose whether Selenix should have compact or normal UI.
- **Tab groups** - Easily group tabs, so it's hard to get lost.
- **Scrollable tabs**
- **Partial support for Chrome extensions** - Install some extensions directly from Chrome Web Store\* (see [#1](https://github.com/VQMSoftware/Selenix-Browser/issues/1)) (work in progress)

## Other basic features

- Downloads popup with currently downloaded items (download manager WebUI page is WIP)
- History manager
- Bookmarks bar & manager
- Settings
- Find in page
- Dark and light theme
- Omnibox with autocomplete algorithm similar to Chromium
- State of the art tab system

# Screenshots

![image](https://user-images.githubusercontent.com/11065386/81024159-d9388f80-8e72-11ea-85e7-6c30e3b66554.png)

UI normal variant:
![image](https://user-images.githubusercontent.com/11065386/81024186-f40b0400-8e72-11ea-976e-cd1ca1b43ad8.png)

UI compact variant:
![image](https://user-images.githubusercontent.com/11065386/81024222-13099600-8e73-11ea-9fc9-3c63a034403d.png)
![image](https://user-images.githubusercontent.com/11065386/81024252-2ddc0a80-8e73-11ea-9f2f-6c9a4a175c60.png)

# Downloads
- [Stable, beta and Nightly versions](https://github.com/VQMSoftware/Selenix-Browser/releases)

# Development

## Running

Make sure you have **node v14.21.3** downloaded as that is the current version that this project is using, this will later modernize tho, you can find this older version at  [`Node.js`](https://nodejs.org/en/) and make sure you install yarn v1 which you can find on [`Yarns`](https://classic.yarnpkg.com/en/docs/install/#windows-stable) install instructions.

to switch between node versions you will need nvm (node version mamager) which you can find [`here`](https://github.com/nvm-sh/nvm/releases).


### Windows

Make sure you have build tools installed. You can install them by running this command as **administrator**:

```bash
$ npm i -g windows-build-tools
```

```bash
$ yarn # Install needed depedencies.
$ yarn rebuild # Rebuild native modules using Electron headers.
$ yarn dev # Run Wexond in development mode
```

### More commands

```bash
$ yarn compile-win32 # Package Selenix for Windows
$ yarn compile-linux # Package Selenix for Linux
$ yarn compile-darwin # Package Selenix for macOS
$ yarn lint # Runs linter
$ yarn lint-fix # Runs linter and automatically applies fixes
```

More commands can be found in [`package.json`](package.json).

# Documentation

Guides and the API reference are located in [`docs`](docs) directory.

# License

This project is licensed under [GPL-3](LICENSE) and an additional license under [PATENTS](PATENTS) file.