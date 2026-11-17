// Shared helpers for the model-craft scripts: find playwright-core, a browser
// with a real GPU, and settings, on macOS, Linux or Windows.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// playwright-core: the skill's own node_modules (npm install in the skill folder),
// then the current project, then a global install.
export function loadPlaywright({ exit = true } = {}) {
  const bases = [SKILL_DIR + "/", process.cwd() + "/"];
  if (process.env.NODE_PATH) for (const p of process.env.NODE_PATH.split(path.delimiter)) bases.push(p + "/");
  for (const base of bases) {
    try { return createRequire(base)("playwright-core"); } catch {}
  }
  if (!exit) return null;
  console.error(`playwright-core not found. Run:  cd "${SKILL_DIR}" && npm install`);
  process.exit(1);
}

// A Chrome/Chromium to drive. MODELCRAFT_CHROME wins; then common install paths;
// undefined means "use Playwright's own Chromium" (npx playwright install chromium).
export function findChrome() {
  const env = process.env.MODELCRAFT_CHROME || process.env.CHROME_PATH;
  if (env && fs.existsSync(env)) return env;
  const local = process.env.LOCALAPPDATA || "", pf = process.env.PROGRAMFILES || "C:\\Program Files", pf86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
  const candidates = {
    darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium",
      path.join(os.homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome")],
    linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium"],
    win32: [path.join(pf, "Google/Chrome/Application/chrome.exe"), path.join(pf86, "Google/Chrome/Application/chrome.exe"), path.join(local, "Google/Chrome/Application/chrome.exe")],
  }[process.platform] || [];
  return candidates.find((p) => p && fs.existsSync(p));
}

// Launch flags that give headless Chrome a working WebGL2 on each platform.
export function gpuArgs() {
  const base = ["--ignore-gpu-blocklist", "--enable-gpu"];
  if (process.platform === "darwin") return [...base, "--use-angle=metal"];
  return [...base, "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]; // software WebGL: slower, always available
}

export async function launch(chromium) {
  const executablePath = findChrome();
  try {
    return await chromium.launch({ executablePath, args: gpuArgs() });
  } catch (err) {
    console.error(`Could not start a browser${executablePath ? " at " + executablePath : ""}.\n` +
      `Install Chrome, set MODELCRAFT_CHROME to a Chrome/Chromium binary, or run:  npx playwright install chromium`);
    throw err;
  }
}
