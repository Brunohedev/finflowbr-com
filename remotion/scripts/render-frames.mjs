import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = "/tmp/frames";
fs.mkdirSync(outDir, { recursive: true });

const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (config) => config,
});

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

const composition = await selectComposition({
  serveUrl: bundled,
  id: "main",
  puppeteerInstance: browser,
});

for (let f = 0; f < composition.durationInFrames; f++) {
  await renderStill({
    composition,
    serveUrl: bundled,
    output: path.join(outDir, `frame${String(f).padStart(4, "0")}.png`),
    frame: f,
    puppeteerInstance: browser,
    imageFormat: "png",
    transparent: true,
  });
  if (f % 20 === 0) console.log(`Rendered ${f}/${composition.durationInFrames}`);
}

await browser.close({ silent: false });
console.log("All frames rendered!");
