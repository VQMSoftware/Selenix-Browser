const packageJson = require('../package.json');
const electronBuilderJson = require('../electron-builder.json');
const { promises } = require('fs');
const { resolve } = require('path');
const { run } = require('./utils');

const isNightly = packageJson.version.indexOf('nightly') !== -1;

const getPlatform = () => {
  if (process.platform === 'win32') return 'windows';
  else if (process.platform === 'darwin') return 'mac';
  return process.platform;
};

const getEnv = (name) => process.env[name.toUpperCase()] || null;

const setEnv = (name, value) => {
  if (value) {
    process.env[name.toUpperCase()] = value.toString();
  }
};

const getInput = (name) => {
  return getEnv(`INPUT_${name}`);
};

// Safely restore original files if we backed them up
const restoreOriginalsIfAny = async () => {
  const fs = require('fs');

  const pkgTmp = resolve(__dirname, '../temp-package.json');
  const ebTmp = resolve(__dirname, '../temp-electron-builder.json');

  try {
    if (fs.existsSync(pkgTmp)) {
      await promises.copyFile(pkgTmp, resolve(__dirname, '../package.json'));
      try { await promises.unlink(pkgTmp); } catch {}
    }
  } catch {}

  try {
    if (fs.existsSync(ebTmp)) {
      await promises.copyFile(ebTmp, resolve(__dirname, '../electron-builder.json'));
      try { await promises.unlink(ebTmp); } catch {}
    }
  } catch {}
};

(async () => {
  let platform;
  let release;

  try {
    release =
      (getEnv('release') === 'true' || getEnv('release') === true) &&
      getEnv('GH_TOKEN');
    platform = getPlatform();

    if (platform === 'mac') {
      setEnv('CSC_LINK', getEnv('mac_certs'));
      setEnv('CSC_KEY_PASSWORD', getEnv('mac_certs_password'));
    } else if (platform === 'windows') {
      setEnv('CSC_LINK', getEnv('windows_certs'));
      setEnv('CSC_KEY_PASSWORD', getEnv('windows_certs_password'));
    }

    // 1) Build FIRST using the original workspace name (prevents Yarn v4 workspace mismatch)
    run('yarn run build');

    // 2) Apply Nightly overrides ONLY for packaging
    if (isNightly) {
      // backup originals
      await promises.copyFile(
        resolve(__dirname, '../package.json'),
        resolve(__dirname, '../temp-package.json'),
      );
      await promises.copyFile(
        resolve(__dirname, '../electron-builder.json'),
        resolve(__dirname, '../temp-electron-builder.json'),
      );

      // Override package.json fields only for packaging
      const newPkg = {
        ...packageJson,
        // IMPORTANT: keep workspace name as-is to avoid Yarn confusion,
        // but if you truly want the packaged app to have a different "name",
        // put it under extraMetadata in electron-builder config (below).
        // Leaving "name" here as 'selenix-nightly' since your original script did it,
        // but because we already built, Yarn won't be impacted.
        name: 'selenix-nightly',
        repository: {
          type: 'git',
          url: 'git+https://github.com/vqmsoftware/Selenix-Browser-Nightly.git',
        },
      };

      await promises.writeFile(
        resolve(__dirname, '../package.json'),
        JSON.stringify(newPkg, null, 2),
      );

      const newEBConfig = {
        ...electronBuilderJson,
        appId: 'org.vqmsoftware.selenix-nightly',
        productName: 'Selenix Nightly',
        directories: {
          output: 'dist',
          buildResources: 'static/nightly-icons',
        },
        // This also lets us tweak the packaged app metadata without touching the workspace identity
        extraMetadata: {
          name: 'selenix-nightly',
        },
      };

      await promises.writeFile(
        resolve(__dirname, '../electron-builder.json'),
        JSON.stringify(newEBConfig, null, 2),
      );
    }

    // 3) Package
    run(
      `npx --no-install electron-builder --${platform} ${
        release ? '-p always' : ''
      }`,
    );
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    // 4) Always restore originals, even on error
    await restoreOriginalsIfAny();
  }
})();
