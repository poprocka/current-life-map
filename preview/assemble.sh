#!/bin/sh
# Rebuild the single-file preview from current source.
set -e
node scripts/build-pdf-assets.mjs >/dev/null 2>&1
node preview/build.mjs
npx tailwindcss -i src/app/globals.css -c tailwind.config.ts --content "./src/**/*.tsx,./preview/**/*.tsx" -o preview/out/app.css --minify 2>/dev/null
node -e '
const fs=require("fs");
const js=fs.readFileSync("preview/out/app.js","utf8").replace(/<\/script/gi,"<\\/script");
const css=fs.readFileSync("preview/out/app.css","utf8");
const html=fs.readFileSync("preview/current-life-map.html","utf8");
fs.writeFileSync("preview/current-life-map.html", html
  .replace(/<style>[\s\S]*?<\/style>/, ()=>`<style>\n/* Single deliberate visual world (Linen / Mahogany / Burgundy) — same tokens as the app. */\n:root{color-scheme:light}\n${css}\n</style>`)
  .replace(/<script>[\s\S]*<\/script>\s*$/, ()=>`<script>${js}</script>`));'
