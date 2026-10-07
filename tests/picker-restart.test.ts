/*
 * Adding pictures when Android has left Expo's photo picker "unregistered" (expo issue #50386): the app recognises it and offers a one-tap
 * restart, and a config plugin stops the usual cause (the main screen being rebuilt on a font / display / language change).
 */
const Module = require("module");
const path = require("node:path");
const { readFileSync, existsSync } = require("node:fs");
const MAP: Record<string, string> = { "expo/config-plugins": path.join(__dirname, "stubs", "config-plugins.js") };
const orig = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...rest: unknown[]) { return MAP[request] ?? orig.call(this, request, ...rest); };

const { isPickerRegistrationError, RESTART_TITLE, RESTART_MESSAGE, restartManualMessage } = require("../src/lib/pickerErrors");
const plugin = require("../plugins/withKeepScreenAlive");
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");

// ---------- recognising the failure
const real = "Call to function 'ExponentImagePicker.launchImageLibraryAsync' has been rejected.\n→ Caused by: java.lang.IllegalStateException: Attempting to launch an unregistered ActivityResultLauncher with contract expo.modules.imagepicker.contracts.ImageLibraryContract@ae96622 and input ImageLibraryContractOptions(options=expo.modules.imagepicker.ImagePickerOptions@ae7dfe). You must ensure the ActivityResultLauncher is registered before calling launch()";
ok("the exact error from the phone is recognised", isPickerRegistrationError(new Error(real)) && isPickerRegistrationError(real));
ok("…whether it arrives as an Error, text, or wrapped in a cause", isPickerRegistrationError({ message: "boom", cause: { message: real } }) && isPickerRegistrationError({ code: "ERR", message: real }));
ok("the camera version of the same failure is recognised too", isPickerRegistrationError(new Error("Attempting to launch an unregistered ActivityResultLauncher with contract expo.modules.imagepicker.contracts.CameraContract@1")));
ok("ordinary failures are NOT mistaken for it (they still surface as errors)", !isPickerRegistrationError(new Error("Permission denied")) && !isPickerRegistrationError("ERR_PICKER_CANCELLED") && !isPickerRegistrationError(null) && !isPickerRegistrationError(undefined) && !isPickerRegistrationError({}) && !isPickerRegistrationError(42));
ok("the offer is worded for a parent: what happened, that restarting fixes it, and that they will be back where they were", /restart/i.test(RESTART_TITLE) && /font or display size/.test(RESTART_MESSAGE) && /where you were/.test(RESTART_MESSAGE) && /4D Ages/.test(restartManualMessage("4D Ages")) && !/ActivityResultLauncher|Exception|expo\./.test(RESTART_MESSAGE));

// ---------- the recovery is wired into the one place pictures are picked
const media = read("src/lib/media.ts"), share = read("src/lib/shareIntake.ts"), kt = read("modules/share-intake/android/src/main/java/expo/modules/shareintake/ShareIntakeModule.kt");
ok("every picker in the app goes through pickMedia (so one fix covers adding photos, avatars, family pictures, import…)", !/launchImageLibraryAsync|launchCameraAsync/.test(["app/(tabs)/add.tsx", "src/components/Screen.tsx", "src/components/MemberSheet.tsx", "src/components/MediaEditor.tsx", "src/lib/addPhotos.ts"].map(read).join("\n")));
ok("pickMedia catches the failure, offers the restart, and returns nothing chosen (callers carry on as if the picker was closed)", /catch \(e\) \{\s*if \(isPickerRegistrationError\(e\)\) \{\s*offerRestart\(\);\s*return \[\];/.test(media) && /throw e;/.test(media));
ok("any OTHER picker error is still thrown, not swallowed", /throw e;/.test(media));
ok("the offer has Not now / Restart, and if this build can't restart it says to close and reopen the app", /text: "Not now", style: "cancel"/.test(media) && /text: "Restart"/.test(media) && /restartManualMessage\(APP_NAME\)/.test(media));
ok("the restart is a native function, with a safe fallback when the build doesn't have it yet", /restartApp\(\): void/.test(share) && /typeof mod\.restartApp !== "function"\) return false/.test(share) && /Function\("restartApp"\)/.test(kt));
ok("the native restart relaunches the app in a fresh task and ends the old process", /getLaunchIntentForPackage\(c\.packageName\)/.test(kt) && /FLAG_ACTIVITY_NEW_TASK or Intent\.FLAG_ACTIVITY_CLEAR_TASK/.test(kt) && /startActivity\(launch\)/.test(kt) && /Runtime\.getRuntime\(\)\.exit\(0\)/.test(kt));
ok("after the restart the app returns to the same child and tab (the remembered 'where I was')", /resume\.load\(\)/.test(read("app/_layout.tsx")) && /isTab\(resume\.get\(\)\.tab\)/.test(read("app/(tabs)/_layout.tsx")));

// ---------- preventing the usual cause
ok("the config plugin adds font size, display size, language and layout direction to what the main screen handles itself", ["fontScale", "density", "locale", "layoutDirection", "smallestScreenSize"].every((c) => plugin.ADD_CONFIG_CHANGES.includes(c)));
ok("it keeps everything Expo already declared and adds only what is missing, once", plugin.mergeConfigChanges("keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode") === "keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode|fontScale|density|locale|layoutDirection|smallestScreenSize|colorMode|navigation");
ok("running it twice changes nothing (no duplicates)", (() => { const once = plugin.mergeConfigChanges("uiMode|locale"); return plugin.mergeConfigChanges(once) === once && once.split("|").filter((x: string) => x === "locale").length === 1; })());
ok("it copes with nothing declared yet", plugin.mergeConfigChanges(undefined).split("|").length === plugin.ADD_CONFIG_CHANGES.length && plugin.mergeConfigChanges("").includes("fontScale"));
const manifest = () => ({ modResults: { manifest: { application: [{ activity: [{ $: { "android:name": ".SomethingElse", "android:configChanges": "orientation" } }, { $: { "android:name": ".MainActivity", "android:configChanges": "keyboard|uiMode" } }] }] } } });
const done = plugin(manifest());
const acts = done.modResults.manifest.application[0].activity;
ok("applied to the generated manifest, only the MAIN screen changes", acts[1].$["android:configChanges"] === "keyboard|uiMode|fontScale|density|locale|layoutDirection|smallestScreenSize|colorMode|navigation" && acts[0].$["android:configChanges"] === "orientation");
ok("an unexpected manifest shape never breaks the build", (() => { try { plugin({ modResults: { manifest: {} } }); plugin({ modResults: undefined }); plugin({ modResults: { manifest: { application: [{}] } } }); return true; } catch { return false; } })());
const app = JSON.parse(read("app.json")).expo;
ok("the plugin is registered in app.json and exists", app.plugins.includes("./plugins/withKeepScreenAlive") && existsSync(path.join(__dirname, "..", "plugins", "withKeepScreenAlive.js")));
ok("the README tells the parent what to do right now and what was changed", /swipe the app away|Swipe .* away/i.test(read("README.md")) && /50386/.test(read("README.md")));
console.log(fails ? `${fails} FAILED` : "all picker-restart tests passed");
