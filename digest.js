#!/usr/bin/env node
/*
 * Monthly digest generator for the concerts.pt newsletter.
 *
 * Picks every concert/festival happening in a given month, and separately
 * flags the ones added recently (so you can highlight new additions).
 * Outputs both plain text and HTML — copy whichever you need into Brevo.
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

// ---- load data -------------------------------------------------------------
const dataPath = path.join(__dirname, 'concerts.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// "new" cutoff: a concert is new if its `added` date is within the window.
const cutoff = new Date(now);
cutoff.setDate(cutoff.getDate() - newWindowDays);
cutoff.setHours(0, 0, 0, 0);

// ---- helpers ---------------------------------------------------------------
function monthOf(dateStr) {
  return dateStr.slice(0, 7); // "2026-07-09" -> "2026-07"
}

function isAddedRecently(addedStr) {
  if (!addedStr) return false;
  return new Date(addedStr) >= cutoff;
}

// Format a list of ISO dates into something human, e.g. "July 9", "July 9 & 10",
// "July 9–11", "July 30 & August 1".
function formatDates(dates) {
  const opts = { month: 'long', day: 'numeric' };
  if (dates.length === 1) {
    return new Date(dates[0]).toLocaleDateString('en-US', opts);
  }
  const first = new Date(dates[0]);
  const last = new Date(dates[dates.length - 1]);
  const month = first.toLocaleDateString('en-US', { month: 'long' });
  if (first.getMonth() === last.getMonth()) {
    if (dates.length === 2) return `${month} ${first.getDate()} & ${last.getDate()}`;
    return `${month} ${first.getDate()}–${last.getDate()}`;
  }
  const lastMonth = last.toLocaleDateString('en-US', { month: 'long' });
  return `${month} ${first.getDate()} & ${lastMonth} ${last.getDate()}`;
}

// Build a flat list of "events" for the target month.
// Each event: { name, dates[], when, price, link, isFestival, isNew }
function collectEvents(month) {
  const events = [];

  for (const item of data) {
    if (item.type === 'festival') {
      // A festival shows up if any of its shows fall in the month.
      const inMonth = item.concerts.filter(c =>
        c.dates.some(d => monthOf(d) === month)
      );
      if (inMonth.length === 0) continue;

      const allDates = inMonth.flatMap(c => c.dates).sort();
      // Festival is "new" if the festival itself or any shown act was added recently.
      const isNew =
        isAddedRecently(item.added) ||
        inMonth.some(c => isAddedRecently(c.added));

      events.push({
        name: item.name,
        headliners: inMonth.map(c => c.artist),
        dates: allDates,
        when: formatDates(allDates),
        price: item.pricing,
        link: item.link,
        isFestival: true,
        isNew,
        sortKey: allDates[0],
      });
    } else {
      if (!item.dates.some(d => monthOf(d) === month)) continue;
      events.push({
        name: item.artist,
        headliners: [],
        dates: item.dates,
        when: formatDates(item.dates),
        price: item.price,
        link: item.link,
        isFestival: false,
        isNew: isAddedRecently(item.added),
        sortKey: item.dates[0],
      });
    }
  }

  events.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return events;
}

// Pretty month label, e.g. "July 2026"
function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

// ---- render ----------------------------------------------------------------
const events = collectEvents(targetMonth);
const label = monthLabel(targetMonth);
const newEvents = events.filter(e => e.isNew);

function plainLine(e) {
  const tag = e.isFestival ? ' (festival)' : '';
  let line = `• ${e.name}${tag} — ${e.when} — ${e.price}`;
  if (e.isFestival && e.headliners.length) {
    line += `\n    feat. ${e.headliners.join(', ')}`;
  }
  line += `\n    ${e.link}`;
  return line;
}

function renderPlain() {
  const out = [];
  out.push(`Concerts in Portugal — ${label}`);
  out.push('');
  if (events.length === 0) {
    out.push('Nothing on the calendar this month.');
  } else {
    for (const e of events) out.push(plainLine(e));
  }
  if (newEvents.length) {
    out.push('');
    out.push(`Added since last time (last ${newWindowDays} days):`);
    for (const e of newEvents) out.push(`• ${e.name} — ${e.when}`);
  }
  return out.join('\n');
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderHtml() {
  const rows = events.map(e => {
    const newBadge = e.isNew ? ' <strong>(new)</strong>' : '';
    const feat = e.isFestival && e.headliners.length
      ? `<br><span style="color:#888;font-size:14px;">feat. ${esc(e.headliners.join(', '))}</span>`
      : '';
    return `<p style="margin:0 0 12px 0;">
  <a href="${esc(e.link)}" style="color:#000;text-decoration:none;font-weight:bold;">${esc(e.name)}</a>${newBadge}
  &nbsp;—&nbsp;${esc(e.when)}&nbsp;—&nbsp;<span style="color:#888;">${esc(e.price)}</span>${feat}
</p>`;
  }).join('\n');

  const newBlock = newEvents.length
    ? `<hr style="border:none;border-top:1px solid #000;margin:24px 0;">
<p style="margin:0 0 8px 0;"><strong>Added since last time</strong></p>
${newEvents.map(e => `<p style="margin:0 0 4px 0;">${esc(e.name)} — ${esc(e.when)}</p>`).join('\n')}`
    : '';

  return `<div style="font-family:Arial,sans-serif;color:#000;max-width:600px;">
<h2 style="text-transform:uppercase;letter-spacing:1px;font-weight:400;">Concerts in Portugal — ${esc(label)}</h2>
${events.length ? rows : '<p>Nothing on the calendar this month.</p>'}
${newBlock}
</div>`;
}

// ---- output ----------------------------------------------------------------
console.log(renderPlain());
if (wantHtml) {
  console.log('\n\n----- HTML (for Brevo) -----\n');
  console.log(renderHtml());
}
