// Turns twa-manifest.json into the Android project that Google Play needs (a
// Trusted Web Activity: the website, full screen, with its own icon). The icons
// are read from this repo's public/ folder through a short-lived local server,
// so the build never depends on what is live on the website.
//
// Usage: node android/build-project.mjs  (CI then runs ./gradlew bundleRelease in android/build/project)
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConsoleLog, TwaGenerator, TwaManifest, fetchUtils } from "@bubblewrap/core";

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(here, "twa-manifest.json"), "utf8"));
const publicDir = path.resolve(here, config.publicDir ?? "../public");
const outDir = path.join(here, "build", "project");

const server = http.createServer((req, res) => {
  const file = path.join(publicDir, decodeURIComponent(new URL(req.url, "http://local").pathname));
  if (!file.startsWith(publicDir + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": "image/png" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const local = (url) => url && `http://127.0.0.1:${server.address().port}${new URL(url).pathname}`;

try {
  fetchUtils.setFetchEngine("node-fetch");
  const manifest = new TwaManifest({
    ...config,
    // Play needs a new, higher version code for every upload: CI passes its run number.
    appVersionCode: Number(process.env.VERSION_CODE || config.appVersionCode || 1),
    iconUrl: local(config.iconUrl),
    maskableIconUrl: local(config.maskableIconUrl),
    monochromeIconUrl: local(config.monochromeIconUrl),
    shortcuts: (config.shortcuts ?? []).map((s) => ({ ...s, chosenIconUrl: local(s.chosenIconUrl) })),
  });
  const errors = manifest.validate();
  if (errors) throw new Error(errors);
  fs.rmSync(outDir, { recursive: true, force: true });
  await new TwaGenerator().createTwaProject(outDir, manifest, new ConsoleLog("android"));
  console.log(`Android project ready in ${path.relative(process.cwd(), outDir)}`);
} finally {
  server.close();
}
