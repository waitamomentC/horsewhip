const $ = (sel) => document.querySelector(sel);

import { hw } from './hw.js';

function isPluginHost() {
  return document.body.classList.contains('hw-plugin');
}

Object.assign(hw, { $, els, isPluginHost });
