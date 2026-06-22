/*
 * Netlify Scheduled Function — runs on the 1st of each month (see netlify.toml).
 *
 * It builds the monthly digest from concerts.json and creates a DRAFT email
 * campaign in Brevo (list #2 by default). It does NOT send anything — you
 * review the draft in Brevo and hit Send yourself.
 *
 * Env vars (set in Netlify → Site configuration → Environment variables):
 *   BREVO_API_KEY    — required, the Brevo API key (server-side only)
 *   BREVO_LIST_ID    — list to target (default "2")
 *   SENDER_NAME      — campaign sender name (default "Concerts in Portugal")
 *   SENDER_EMAIL     — campaign sender email (default "info@concerts.pt")
 *   DIGEST_TEST_MONTH — optional "YYYY-MM" override, handy for manual testing
 */

const fs = require('fs');
const path = require('path');
const { buildDigest } = require('../../digest-core');

exports.handler = async () => {
  const API_KEY = (process.env.BREVO_API_KEY || '').trim();
  const LIST_ID = Number((process.env.BREVO_LIST_ID || '2').trim());
  const SENDER_NAME = (process.env.SENDER_NAME || 'Concerts in Portugal').trim();
  const SENDER_EMAIL = (process.env.SENDER_EMAIL || 'info@concerts.pt').trim();

  if (!API_KEY) {
    console.error('BREVO_API_KEY missing — aborting.');
    return { statusCode: 500, body: 'BREVO_API_KEY missing' };
  }

  // Target month: the current month (or an override for testing).
  const now = new Date();
  const targetMonth =
    (process.env.DIGEST_TEST_MONTH || '').trim() ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Load concerts.json. With Netlify `included_files` the file is bundled
  // relative to the project root (process.cwd()), but locally it lives next to
  // digest-core.js. Try a few sensible locations so it works in both worlds.
  let data;
  const candidates = [
    path.join(process.cwd(), 'concerts.json'),
    path.join(__dirname, 'concerts.json'),
    path.join(__dirname, '..', '..', 'concerts.json'),
  ];
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) {
    console.error('Could not find concerts.json. Looked in:', candidates.join(', '));
    return { statusCode: 500, body: 'concerts.json not found' };
  }
  try {
    data = JSON.parse(fs.readFileSync(found, 'utf8'));
  } catch (err) {
    console.error('Could not parse concerts.json:', String(err));
    return { statusCode: 500, body: 'concerts.json invalid' };
  }

  const digest = buildDigest(data, targetMonth, 30, now);

  // Nothing playing this month → skip making an empty draft.
  if (digest.events.length === 0) {
    console.log(`No events for ${digest.label} — no draft created.`);
    return { statusCode: 200, body: `No events for ${digest.label}; skipped.` };
  }

  const campaign = {
    name: `Concerts in Portugal — ${digest.label}`, // internal name (you see it in Brevo)
    subject: `What's playing in Portugal — ${digest.label}`,
    sender: { name: SENDER_NAME, email: SENDER_EMAIL },
    htmlContent: digest.html,
    recipients: { listIds: [LIST_ID] },
    // No scheduledAt → stays a DRAFT. You send it manually.
  };

  try {
    const res = await fetch('https://api.brevo.com/v3/emailCampaigns', {
      method: 'POST',
      headers: {
        'api-key': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(campaign),
    });

    const body = await res.json().catch(() => ({}));

    if (res.status === 201) {
      console.log(`✅ Draft campaign created for ${digest.label} (id ${body.id}), ${digest.events.length} events.`);
      return { statusCode: 200, body: `Draft created: id ${body.id}` };
    }

    console.error('Brevo campaign creation failed:', res.status, JSON.stringify(body));
    return { statusCode: 502, body: `Brevo error ${res.status}` };
  } catch (err) {
    console.error('Request to Brevo failed:', String(err));
    return { statusCode: 502, body: 'Request failed' };
  }
};
