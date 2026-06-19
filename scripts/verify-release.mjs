#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const iconSizes = ["16", "32", "48", "128"];

function pass(message) {
  console.log(`✓ ${message}`);
}

function fail(message) {
  failures.push(message);
  console.error(`✗ ${message}`);
}

function assert(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

async function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  return JSON.parse(await readFile(absolutePath, "utf8"));
}

async function readPngSize(relativePath) {
  const buffer = await readFile(path.join(root, relativePath));
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    throw new Error(`${relativePath} is not a PNG file`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function collectFiles(directory, predicate = () => true) {
  const absoluteDirectory = path.join(root, directory);
  if (!existsSync(absoluteDirectory)) return [];

  const files = [];
  for (const entry of await readdir(absoluteDirectory)) {
    const absoluteEntry = path.join(absoluteDirectory, entry);
    const relativeEntry = path.relative(root, absoluteEntry);
    const entryStat = await stat(absoluteEntry);
    if (entryStat.isDirectory()) {
      files.push(...await collectFiles(relativeEntry, predicate));
    } else if (predicate(relativeEntry)) {
      files.push(relativeEntry);
    }
  }
  return files;
}

function getLocaleKeys(locale) {
  return Object.keys(locale).sort();
}

function assertSameKeys(leftName, leftKeys, rightName, rightKeys) {
  const leftOnly = leftKeys.filter((key) => !rightKeys.includes(key));
  const rightOnly = rightKeys.filter((key) => !leftKeys.includes(key));
  assert(
    leftOnly.length === 0 && rightOnly.length === 0,
    `${leftName} and ${rightName} locale keys match`
  );
  if (leftOnly.length > 0) fail(`${leftName} only keys: ${leftOnly.join(", ")}`);
  if (rightOnly.length > 0) fail(`${rightName} only keys: ${rightOnly.join(", ")}`);
}

async function verifyManifest() {
  const manifest = await readJson("dist/manifest.json");
  assert(manifest.manifest_version === 3, "dist manifest is MV3");
  assert(typeof manifest.name === "string" && manifest.name.length > 0, "manifest has a name");
  assert(
    typeof manifest.description === "string" && manifest.description.length > 0,
    "manifest has a description"
  );
  assert(typeof manifest.version === "string" && manifest.version.length > 0, "manifest has a version");
  assert(manifest.default_locale === "en", "manifest default locale is en");
  assert(
    Array.isArray(manifest.permissions) && manifest.permissions.includes("storage"),
    "manifest includes storage permission"
  );
  assert(
    Array.isArray(manifest.host_permissions) && manifest.host_permissions.includes("https://archiveofourown.org/*"),
    "manifest includes AO3 host permission"
  );
  assert(manifest.action?.default_popup === "popup.html", "manifest action opens popup.html");
  assert(typeof manifest.action?.default_title === "string", "manifest action has default title");
  for (const size of iconSizes) {
    assert(manifest.icons?.[size] === `icons/icon-${size}.png`, `manifest icons.${size} is configured`);
    assert(
      manifest.action?.default_icon?.[size] === `icons/icon-${size}.png`,
      `manifest action.default_icon.${size} is configured`
    );
  }
  assert(manifest.options_page === "options.html", "manifest options page is configured");
}

async function verifyIconFiles() {
  for (const size of iconSizes) {
    const relativePath = `dist/icons/icon-${size}.png`;
    assert(existsSync(path.join(root, relativePath)), `dist icon-${size}.png exists`);
    if (existsSync(path.join(root, relativePath))) {
      const dimensions = await readPngSize(relativePath);
      assert(
        dimensions.width === Number(size) && dimensions.height === Number(size),
        `dist icon-${size}.png is ${size}x${size}`
      );
    }
  }
}

async function verifyLocales() {
  const en = await readJson("public/_locales/en/messages.json");
  const zh = await readJson("public/_locales/zh_CN/messages.json");
  assertSameKeys("en", getLocaleKeys(en), "zh_CN", getLocaleKeys(zh));

  for (const [localeName, locale] of [["en", en], ["zh_CN", zh]]) {
    const invalidKeys = Object.entries(locale)
      .filter(([, value]) => typeof value?.message !== "string" || value.message.length === 0)
      .map(([key]) => key);
    assert(invalidKeys.length === 0, `${localeName} locale messages are non-empty`);
    if (invalidKeys.length > 0) fail(`${localeName} invalid locale keys: ${invalidKeys.join(", ")}`);
  }
}

async function verifyNoDsStore() {
  const metadataFiles = await collectFiles("dist", (file) => path.basename(file) === ".DS_Store");
  assert(metadataFiles.length === 0, "dist contains no .DS_Store files");
  if (metadataFiles.length > 0) fail(`Remove metadata files: ${metadataFiles.join(", ")}`);
}

async function cleanDistMetadata() {
  const metadataFiles = await collectFiles("dist", (file) => path.basename(file) === ".DS_Store");
  for (const file of metadataFiles) {
    await rm(path.join(root, file));
  }
  if (metadataFiles.length > 0) pass(`removed ${metadataFiles.length} macOS metadata file(s) from dist`);
}

async function verifyNoGradientCss() {
  const cssFiles = [
    ...await collectFiles("src", (file) => file.endsWith(".css")),
    ...await collectFiles("dist/assets", (file) => file.endsWith(".css")),
  ];
  const offenders = [];
  for (const file of cssFiles) {
    const text = await readFile(path.join(root, file), "utf8");
    if (/gradient\s*\(/i.test(text)) offenders.push(file);
  }
  assert(offenders.length === 0, "CSS contains no gradient backgrounds");
  if (offenders.length > 0) fail(`Gradient references: ${offenders.join(", ")}`);
}


try {
  assert(existsSync(path.join(root, "dist/manifest.json")), "dist manifest exists");
  await verifyManifest();
  await verifyIconFiles();
  await verifyLocales();
  await cleanDistMetadata();
  await verifyNoDsStore();
  await verifyNoGradientCss();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

if (failures.length > 0) {
  console.error(`\nRelease verification failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log("\nRelease verification passed.");
