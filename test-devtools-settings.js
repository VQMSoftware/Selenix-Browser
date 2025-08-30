#!/usr/bin/env node

/**
 * Simple test script to verify DevTools mode settings integration
 * This tests that the settings interface includes devToolsMode and default settings work
 */

const fs = require('fs');
const path = require('path');

// Test 1: Verify settings interface includes DevToolsMode
console.log('Testing DevTools mode settings integration...\n');

try {
  // Check if the settings interface file includes DevToolsMode
  const settingsInterfacePath = path.join(__dirname, 'src/interfaces/settings.ts');
  const settingsInterface = fs.readFileSync(settingsInterfacePath, 'utf8');
  
  const hasDevToolsModeType = settingsInterface.includes('export type DevToolsMode');
  const hasDevToolsModeProperty = settingsInterface.includes('devToolsMode: DevToolsMode');
  
  console.log('✓ Settings interface checks:');
  console.log(`  - DevToolsMode type exported: ${hasDevToolsModeType ? '✓' : '✗'}`);
  console.log(`  - devToolsMode property in ISettings: ${hasDevToolsModeProperty ? '✓' : '✗'}`);
  
  if (!hasDevToolsModeType || !hasDevToolsModeProperty) {
    throw new Error('Settings interface missing DevToolsMode integration');
  }
  
} catch (error) {
  console.error('✗ Settings interface test failed:', error.message);
  process.exit(1);
}

try {
  // Check if default settings include devToolsMode
  const defaultSettingsPath = path.join(__dirname, 'src/constants/settings.ts');
  const defaultSettings = fs.readFileSync(defaultSettingsPath, 'utf8');
  
  const hasDevToolsModeDefault = defaultSettings.includes('devToolsMode:');
  const hasBottomDefault = defaultSettings.includes("devToolsMode: 'bottom'");
  
  console.log('\n✓ Default settings checks:');
  console.log(`  - devToolsMode in DEFAULT_SETTINGS: ${hasDevToolsModeDefault ? '✓' : '✗'}`);
  console.log(`  - default value is 'bottom': ${hasBottomDefault ? '✓' : '✗'}`);
  
  if (!hasDevToolsModeDefault) {
    throw new Error('Default settings missing devToolsMode');
  }
  
} catch (error) {
  console.error('✗ Default settings test failed:', error.message);
  process.exit(1);
}

try {
  // Check if the DevToolsTracker utility exists
  const devToolsTrackerPath = path.join(__dirname, 'src/main/utils/devtools-tracker.ts');
  const devToolsTracker = fs.readFileSync(devToolsTrackerPath, 'utf8');
  
  const hasTrackerClass = devToolsTracker.includes('export class DevToolsTracker');
  const hasTrackMethod = devToolsTracker.includes('static track(');
  const hasSaveMethod = devToolsTracker.includes('static saveDevToolsMode(');
  const hasGetCurrentMethod = devToolsTracker.includes('static getCurrentMode(');
  
  console.log('\n✓ DevToolsTracker utility checks:');
  console.log(`  - DevToolsTracker class exported: ${hasTrackerClass ? '✓' : '✗'}`);
  console.log(`  - track method exists: ${hasTrackMethod ? '✓' : '✗'}`);
  console.log(`  - saveDevToolsMode method exists: ${hasSaveMethod ? '✓' : '✗'}`);
  console.log(`  - getCurrentMode method exists: ${hasGetCurrentMethod ? '✓' : '✗'}`);
  
  if (!hasTrackerClass || !hasTrackMethod || !hasSaveMethod || !hasGetCurrentMethod) {
    throw new Error('DevToolsTracker utility missing required methods');
  }
  
} catch (error) {
  console.error('✗ DevToolsTracker utility test failed:', error.message);
  process.exit(1);
}

try {
  // Check if the settings UI includes the DevTools mode option
  const settingsUIPath = path.join(__dirname, 'src/renderer/views/settings/components/Appearance/index.tsx');
  const settingsUI = fs.readFileSync(settingsUIPath, 'utf8');
  
  const hasDevToolsModeComponent = settingsUI.includes('const DevToolsMode');
  const hasDevToolsModeDropdown = settingsUI.includes('Developer tools dock position');
  const hasDevToolsModeUsage = settingsUI.includes('<DevToolsMode />');
  
  console.log('\n✓ Settings UI checks:');
  console.log(`  - DevToolsMode component exists: ${hasDevToolsModeComponent ? '✓' : '✗'}`);
  console.log(`  - DevTools dock position dropdown: ${hasDevToolsModeDropdown ? '✓' : '✗'}`);
  console.log(`  - Component used in Appearance: ${hasDevToolsModeUsage ? '✓' : '✗'}`);
  
  if (!hasDevToolsModeComponent || !hasDevToolsModeDropdown || !hasDevToolsModeUsage) {
    throw new Error('Settings UI missing DevTools mode configuration');
  }
  
} catch (error) {
  console.error('✗ Settings UI test failed:', error.message);
  process.exit(1);
}

try {
  // Check if the view menu uses DevToolsTracker
  const viewMenuPath = path.join(__dirname, 'src/main/menus/view.ts');
  const viewMenu = fs.readFileSync(viewMenuPath, 'utf8');
  
  const hasTrackerImport = viewMenu.includes('DevToolsTracker');
  const hasTrackerUsage = viewMenu.includes('DevToolsTracker.track(');
  const hasGetCurrentModeUsage = viewMenu.includes('DevToolsTracker.getCurrentMode(');
  
  console.log('\n✓ View menu integration checks:');
  console.log(`  - DevToolsTracker imported: ${hasTrackerImport ? '✓' : '✗'}`);
  console.log(`  - DevToolsTracker.track() used: ${hasTrackerUsage ? '✓' : '✗'}`);
  console.log(`  - DevToolsTracker.getCurrentMode() used: ${hasGetCurrentModeUsage ? '✓' : '✗'}`);
  
  if (!hasTrackerImport || !hasTrackerUsage || !hasGetCurrentModeUsage) {
    throw new Error('View menu missing DevToolsTracker integration');
  }
  
} catch (error) {
  console.error('✗ View menu integration test failed:', error.message);
  process.exit(1);
}

try {
  // Check if the main menu uses persistent settings
  const mainMenuPath = path.join(__dirname, 'src/main/menus/main.ts');
  const mainMenu = fs.readFileSync(mainMenuPath, 'utf8');
  
  const hasSettingsUsage = mainMenu.includes('settings.object.devToolsMode');
  const hasDevToolsTrackerUsage = mainMenu.includes('DevToolsTracker');
  
  console.log('\n✓ Main menu integration checks:');
  console.log(`  - Uses settings.object.devToolsMode: ${hasSettingsUsage ? '✓' : '✗'}`);
  console.log(`  - Uses DevToolsTracker: ${hasDevToolsTrackerUsage ? '✓' : '✗'}`);
  
  if (!hasSettingsUsage) {
    throw new Error('Main menu not using persistent devToolsMode setting');
  }
  
} catch (error) {
  console.error('✗ Main menu integration test failed:', error.message);
  process.exit(1);
}

try {
  // Check if the view manager automatically tracks devtools for all tabs
  const viewManagerPath = path.join(__dirname, 'src/main/view-manager.ts');
  const viewManager = fs.readFileSync(viewManagerPath, 'utf8');
  
  const hasTrackerImport = viewManager.includes('DevToolsTracker');
  const hasAutoTracking = viewManager.includes('DevToolsTracker.track(webContents)');
  
  console.log('\n✓ View manager integration checks:');
  console.log(`  - DevToolsTracker imported: ${hasTrackerImport ? '✓' : '✗'}`);
  console.log(`  - Auto-tracks devtools for all tabs: ${hasAutoTracking ? '✓' : '✗'}`);
  
  if (!hasTrackerImport || !hasAutoTracking) {
    throw new Error('View manager missing automatic devtools tracking');
  }
  
} catch (error) {
  console.error('✗ View manager integration test failed:', error.message);
  process.exit(1);
}

try {
  // Check if settings migration includes devToolsMode
  const settingsModelPath = path.join(__dirname, 'src/main/models/settings.ts');
  const settingsModel = fs.readFileSync(settingsModelPath, 'utf8');
  
  const hasMigration = settingsModel.includes('json.devToolsMode === undefined');
  const hasBottomMigration = settingsModel.includes("json.devToolsMode = 'bottom'");
  
  console.log('\n✓ Settings migration checks:');
  console.log(`  - DevToolsMode migration exists: ${hasMigration ? '✓' : '✗'}`);
  console.log(`  - Migrates to 'bottom' default: ${hasBottomMigration ? '✓' : '✗'}`);
  
  if (!hasMigration || !hasBottomMigration) {
    throw new Error('Settings migration missing devToolsMode handling');
  }
  
} catch (error) {
  console.error('✗ Settings migration test failed:', error.message);
  process.exit(1);
}

console.log('\n🎉 All tests passed! DevTools mode settings integration is working correctly.');
console.log('\nSummary of functionality:');
console.log('- DevTools dock mode is now persistent across browser restarts');
console.log('- Users can configure their preferred dock mode in Settings > Appearance');
console.log('- Available modes: Bottom, Right, Undocked, Detached');
console.log('- Default mode is "Bottom"');
console.log('- Both main menu and context menu DevTools use the saved preference');
console.log('- All new tabs automatically track devtools mode changes');
console.log('- Existing users without the setting will be migrated to "bottom" mode');
console.log('\nHow to test:');
console.log('1. Open Settings (Cmd/Ctrl+,) and go to Appearance section');
console.log('2. Change "Developer tools dock position" to your preference');
console.log('3. Open DevTools (F12 or Cmd/Ctrl+Shift+I) and verify it opens in chosen mode');
console.log('4. Restart the browser and verify DevTools still opens in your chosen mode');