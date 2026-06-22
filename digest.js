#!/usr/bin/env node
/*
 * Monthly digest generator for the concerts.pt newsletter (CLI).
 *
 * Thin wrapper around digest-core.js — the actual logic is shared with the
 * Netlify scheduled function so they never drift apart.
 *
 * Usage:
 *   node digest.js                 # current month, "new" = added in last 30 days
 *   node digest.js 2026-07         # a specific month (YYYY-MM)
 *   node digest.js 2026-07 14      # ...and "new" = added in last 14 days
 *   node digest.js --html          # print HTML version too
 *
 * Flags can go anywhere: `node digest.js 2026-08 --html 7`
 */

const fs = require('fs');
const path = require('path');
const { buildDigest } = require('./digest-core');

// ---- arguments -------------------------------------------------------------
const args = process.argv.slice(2);
const wantHtml = args.includes('--html');
const positional = args.filter(a => !a.startsWith('--'));

const now = new Date();
const defaultMonth =
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

const targetMonth = positional[0] || defaultMonth;        // "YYYY-MM"
const newWindowDays = Number(positional[1]) || 30;        // "new" lookback

if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
  console.error(`Bad month "${targetMonth}". Expected format YYYY-MM, e.g. 2026-07.`);
  process.exit(1);
}

// ---- load data & build -----------------------------------------------------
const dataPath = path.join(__dirname, 'concerts.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const digest = buildDigest(data, targetMonth, newWindowDays, now);

// ---- output ----------------------------------------------------------------
console.log(digest.plain);
if (wantHtml) {
  console.log('\n\n----- HTML (for Brevo) -----\n');
  console.log(digest.html);
}
