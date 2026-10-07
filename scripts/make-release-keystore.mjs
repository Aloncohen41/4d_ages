#!/usr/bin/env node
/*
 * Makes the release key that signs every published APK, once:  npm run signing:key
 *
 * Android only installs an update over an app when both are signed with the same key, so this key must be made once, kept for good, and
 * never replaced: lose it (or its password) and nobody can update — they would have to uninstall, which erases the app's data.
 *
 * It writes two files into a folder OUTSIDE the project (default ~/4d-ages-signing, or the folder you name), and prints no password:
 *   release.keystore      the key itself
 *   github-secrets.env    the four secrets the Release workflow needs, ready for:  gh secret set -f <that file>
 * Keep a copy of the whole folder somewhere safe (a password manager). It refuses to run if a key is already there.
 *
 * Uses Java's keytool when Java is installed, otherwise openssl; both make the same kind of file (PKCS12).
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ALIAS = "fourdages";
const OWNER = "4D Ages";
const DAYS = "10000";   // about 27 years: the key has to outlive the app

const dir = resolve(process.argv[2] || join(homedir(), "4d-ages-signing"));
const keystore = join(dir, "release.keystore");
const secrets = join(dir, "github-secrets.env");

function works(command, args) {
  try { execFileSync(command, args, { stdio: "ignore" }); return true; } catch { return false; }
}

/** Runs a tool with the password in its environment (never on its command line, where other programs could read it). Quiet unless it fails. */
function run(command, args, password) {
  execFileSync(command, args, { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, KEYSTORE_PASSWORD: password } });
}

function withKeytool(password) {
  run("keytool", ["-genkeypair", "-keystore", keystore, "-storetype", "PKCS12", "-alias", ALIAS, "-keyalg", "RSA", "-keysize", "2048",
    "-validity", DAYS, "-dname", `CN=${OWNER}`, "-storepass:env", "KEYSTORE_PASSWORD", "-keypass:env", "KEYSTORE_PASSWORD"], password);
}

function withOpenssl(password) {
  const tmp = mkdtempSync(join(tmpdir(), "4d-ages-key-"));
  try {
    const key = join(tmp, "key.pem"), cert = join(tmp, "cert.pem");
    run("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", DAYS, "-subj", `/CN=${OWNER}`], password);
    run("openssl", ["pkcs12", "-export", "-inkey", key, "-in", cert, "-name", ALIAS, "-out", keystore, "-passout", "env:KEYSTORE_PASSWORD"], password);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (existsSync(keystore)) {
  console.error(`✗ There is already a release key at ${keystore}.\n  It is not replaced: a new key could not update the app on anyone's phone. To add its secrets to GitHub again:  gh secret set -f ${secrets}`);
  process.exit(1);
}

const tool = works("keytool", ["-help"]) ? withKeytool : works("openssl", ["version"]) ? withOpenssl : null;
if (!tool) {
  console.error("✗ Neither Java's keytool nor openssl was found. Install one of them (Java 17, or OpenSSL) and run this again.");
  process.exit(1);
}

mkdirSync(dir, { recursive: true, mode: 0o700 });
const password = randomBytes(24).toString("hex");
tool(password);
chmodSync(keystore, 0o600);
writeFileSync(secrets, [
  `ANDROID_KEYSTORE_BASE64=${readFileSync(keystore).toString("base64")}`,
  `ANDROID_KEYSTORE_PASSWORD=${password}`,
  `ANDROID_KEY_ALIAS=${ALIAS}`,
  `ANDROID_KEY_PASSWORD=${password}`,
  "",
].join("\n"), { mode: 0o600 });

console.log(`✓ Release key made (with ${tool === withKeytool ? "keytool" : "openssl"}):
    ${keystore}
    ${secrets}

Next:
  1. Copy the folder ${dir} somewhere safe (a password manager). It cannot be made again.
  2. Give the key to GitHub (needs the GitHub CLI, signed in as someone who can change the repository's settings):
       gh secret set -f ${secrets}
     or by hand: Settings → Secrets and variables → Actions → one secret per line of that file.
  3. Release: push a tag named v<the version in app.json>, e.g.  git tag v1.0.0 && git push origin v1.0.0`);
