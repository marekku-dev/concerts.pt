/*
 * Shared digest logic for the concerts.pt newsletter.
 *
 * Both the CLI (digest.js) and the Netlify scheduled function
 * (netlify/functions/monthly-digest.js) import from here, so the
 * "what's playing this month" logic lives in exactly one place.
 */

// ---- helpers ---------------------------------------------------------------
function monthOf(dateStr) {
  return dateStr.slice(0, 7); // "2026-07-09" -> "2026-07"
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

// Pretty month label, e.g. "July 2026"
function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

// Build a flat, date-sorted list of events for a target month.
// `data`        — parsed concerts.json (array)
// `month`       — "YYYY-MM"
// `cutoff`      — Date; an event is "new" if its `added` is >= cutoff
function collectEvents(data, month, cutoff) {
  const isAddedRecently = (addedStr) =>
    addedStr ? new Date(addedStr) >= cutoff : false;

  const events = [];

  for (const item of data) {
    if (item.type === 'festival') {
      const inMonth = item.concerts.filter(c =>
        c.dates.some(d => monthOf(d) === month)
      );
      if (inMonth.length === 0) continue;

      const allDates = inMonth.flatMap(c => c.dates).sort();
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

// ---- renderers -------------------------------------------------------------
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderPlain(events, label, newWindowDays) {
  const newEvents = events.filter(e => e.isNew);
  const plainLine = (e) => {
    const tag = e.isFestival ? ' (festival)' : '';
    let line = `• ${e.name}${tag} — ${e.when} — ${e.price}`;
    if (e.isFestival && e.headliners.length) {
      line += `\n    feat. ${e.headliners.join(', ')}`;
    }
    line += `\n    ${e.link}`;
    return line;
  };

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

function renderHtml(events, label) {
  const newEvents = events.filter(e => e.isNew);

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

// ---- high-level convenience -------------------------------------------------
// Returns everything a caller needs for a given month.
//   data          — parsed concerts.json
//   targetMonth   — "YYYY-MM"
//   newWindowDays — lookback window for the "new" flag (default 30)
//   now           — reference date (default: real now), used to compute cutoff
function buildDigest(data, targetMonth, newWindowDays = 30, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - newWindowDays);
  cutoff.setHours(0, 0, 0, 0);

  const events = collectEvents(data, targetMonth, cutoff);
  const label = monthLabel(targetMonth);

  return {
    label,                       // "July 2026"
    events,                      // sorted event objects
    newEvents: events.filter(e => e.isNew),
    plain: renderPlain(events, label, newWindowDays),
    html: renderHtml(events, label),
  };
}

module.exports = {
  monthOf,
  formatDates,
  monthLabel,
  collectEvents,
  renderPlain,
  renderHtml,
  buildDigest,
};
