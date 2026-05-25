#!/usr/bin/env node
/**
 * Copy web MVP assets into extension/media (run after changing script.js / style.css).
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const media = path.resolve(__dirname, '../media');

const files = ['script.js', 'style.css', 'demo-data.js'];

if (!fs.existsSync(media)) fs.mkdirSync(media, { recursive: true });

for (const name of files) {
  const src = path.join(root, name);
  const dest = path.join(media, name);
  fs.copyFileSync(src, dest);
  console.log(`synced ${name} → extension/media/${name}`);
}
