// Builds the website into dist/: the app itself, from the same code as the phone app, with the plain pages that live beside it in public/
// (privacy policy, terms, accessibility, licences, deleting an account, and the invite link page /j/). Expo copies public/ as it is.
import { execSync } from "node:child_process";

execSync("npx expo export --platform web --output-dir dist", { stdio: "inherit" });
console.log("Website built in dist/");
