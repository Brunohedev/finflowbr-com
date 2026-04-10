import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (config) => config,
});

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: {
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  },
  chromeMode: "chrome-for-testing",
});

const composition = await selectComposition({
  serveUrl: bundled,
  id: "main",
  puppeteerInstance: browser,
});

// Render as WebM with transparency
await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "vp8",
  outputLocation: "/mnt/documents/finflow-animation.webm",
  puppeteerInstance: browser,
  muted: true,
  concurrency: 1,
  pixelFormat: "yuva420p",
});

await browser.close({ silent: false });
console.log("Done!");
