/*
 * Expo config plugin: stop Android from destroying and rebuilding the app's main screen when the phone's font size, display size or language
 * changes. Each rebuild leaves Expo's photo picker "unregistered" until the whole app restarts (expo issue #50386), which showed up as
 * "Attempting to launch an unregistered ActivityResultLauncher" when adding pictures.
 *
 * The screen declares that it handles these changes itself (React Native already reacts to them), so nothing is rebuilt. Applied to the generated
 * Android project by `npm run android:sync` (expo prebuild); nothing in android/ is edited by hand.
 */
const { withAndroidManifest } = require("expo/config-plugins");

/** The configuration changes the main screen should handle itself, in addition to the ones Expo already lists (orientation, size, dark mode…). */
const ADD_CONFIG_CHANGES = ["fontScale", "density", "locale", "layoutDirection", "smallestScreenSize", "colorMode", "navigation"];

/** "a|b" + ["b","c"] → "a|b|c": keeps what is there, adds what is missing, never repeats. */
function mergeConfigChanges(existing, add = ADD_CONFIG_CHANGES) {
  const set = new Set(String(existing || "").split("|").map((s) => s.trim()).filter(Boolean));
  for (const a of add) set.add(a);
  return [...set].join("|");
}

function withKeepScreenAlive(config) {
  return withAndroidManifest(config, (mod) => {
    const app = mod.modResults && mod.modResults.manifest && mod.modResults.manifest.application && mod.modResults.manifest.application[0];
    const main = app && app.activity && app.activity.find((a) => a && a.$ && a.$["android:name"] === ".MainActivity");
    if (main) main.$["android:configChanges"] = mergeConfigChanges(main.$["android:configChanges"]);
    return mod;
  });
}

module.exports = withKeepScreenAlive;
module.exports.mergeConfigChanges = mergeConfigChanges;
module.exports.ADD_CONFIG_CHANGES = ADD_CONFIG_CHANGES;
