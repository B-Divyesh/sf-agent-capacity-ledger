#!/bin/sh
set -eu

url="${1:-http://127.0.0.1:8080}"

node --input-type=module - "$url" <<'NODE'
import { chromium } from 'playwright';

const url = process.argv[2];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const consoleErrors = [];
const pageErrors = [];
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => pageErrors.push(error.message));
const response = await page.goto(url, { waitUntil: 'networkidle' });
if (!response?.ok()) throw new Error(`Document returned ${response?.status() ?? 'no response'}`);
const result = await page.evaluate(() => ({
  title: document.title,
  lang: document.documentElement.lang,
  mains: document.querySelectorAll('main').length,
  headings: document.querySelectorAll('h1').length,
  imagesWithoutAlt: [...document.images].filter(image => !image.hasAttribute('alt')).length,
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
if (!result.title || result.lang !== 'en' || result.mains !== 1 || result.headings !== 1 || result.imagesWithoutAlt || result.overflow > 1) {
  throw new Error(`Page checks failed: ${JSON.stringify(result)}`);
}
if (consoleErrors.length || pageErrors.length) throw new Error(`Browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`);
console.log(JSON.stringify({ url, ...result, consoleErrors: 0, pageErrors: 0 }));
await browser.close();
NODE
