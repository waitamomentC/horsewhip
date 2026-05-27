#!/usr/bin/env node
/**
 * Copy web MVP assets into extension/media (run after changing script.js / style.css).
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const media = path.resolve(__dirname, '../media');

const files = ['script.js', 'style.css', 'demo-data.js'];
const guardScript = 'pre-commit-guard.mjs';
const whipAudioNames = ['whip-crack.mp3', 'whip-crack.wav', 'whip-crack.ogg', 'whip-crack.m4a'];

if (!fs.existsSync(media)) fs.mkdirSync(media, { recursive: true });

for (const name of files) {
  const src = path.join(root, name);
  const dest = path.join(media, name);
  fs.copyFileSync(src, dest);
  console.log(`synced ${name} → extension/media/${name}`);
}

const guardSrc = path.join(__dirname, guardScript);
const guardDest = path.join(media, guardScript);
fs.copyFileSync(guardSrc, guardDest);
console.log(`synced scripts/${guardScript} → extension/media/${guardScript}`);

const soundDir = path.join(root, 'sound');
const officialWav = path.join(soundDir, 'whip.wav');
const copiedAudio = new Set();

function syncWhipAudio(srcPath, destName) {
  if (!fs.existsSync(srcPath) || copiedAudio.has(destName)) return;
  const dest = path.join(media, destName);
  fs.copyFileSync(srcPath, dest);
  copiedAudio.add(destName);
}

if (!fs.existsSync(officialWav)) {
  console.warn('warn: sound/whip.wav missing — run build after placing official whip audio');
} else {
  syncWhipAudio(officialWav, 'whip.wav');
  syncWhipAudio(officialWav, 'whip-crack.wav');
  console.log('synced official whip audio → extension/media/whip.wav');
}

const soundNames = ['whip.mp3', 'whip.ogg', 'whip.m4a', ...whipAudioNames];
for (const name of soundNames) {
  const fromSound = path.join(soundDir, name);
  if (fs.existsSync(fromSound)) syncWhipAudio(fromSound, name);
}

const mediaSrc = path.join(root, 'media');
for (const name of whipAudioNames) {
  const src = path.join(mediaSrc, name);
  if (!fs.existsSync(src)) continue;
  syncWhipAudio(src, name);
}

const licenseSrc = path.join(root, 'LICENSE');
const licenseDest = path.resolve(__dirname, '../LICENSE');
if (fs.existsSync(licenseSrc)) {
  fs.copyFileSync(licenseSrc, licenseDest);
  console.log('synced LICENSE → extension/LICENSE');
}
