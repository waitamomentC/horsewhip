#!/usr/bin/env node
/**
 * Copy web MVP assets into extension/media (run after changing script.js / style.css).
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const media = path.resolve(__dirname, '../media');

const files = ['script.js', 'style.css', 'demo-data.js'];
const whipAudioNames = ['whip-crack.mp3', 'whip-crack.wav', 'whip-crack.ogg', 'whip-crack.m4a'];

if (!fs.existsSync(media)) fs.mkdirSync(media, { recursive: true });

for (const name of files) {
  const src = path.join(root, name);
  const dest = path.join(media, name);
  fs.copyFileSync(src, dest);
  console.log(`synced ${name} → extension/media/${name}`);
}

const mediaSrc = path.join(root, 'media');
for (const name of whipAudioNames) {
  const src = path.join(mediaSrc, name);
  if (!fs.existsSync(src)) continue;
  const dest = path.join(media, name);
  fs.copyFileSync(src, dest);
  console.log(`synced media/${name} → extension/media/${name}`);
}
