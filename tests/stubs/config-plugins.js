// A stand-in for expo/config-plugins, used only by tests: runs the plugin's change straight away on a fake manifest.
module.exports = { withAndroidManifest: (config, action) => action(config) };
