// Netlify Function: приём подписки и форвард контакта в Brevo.
// Боевой аналог локального server.js. Деплоится автоматически вместе с сайтом.
//
// Эндпоинт после деплоя:  /.netlify/functions/subscribe
//
// Переменные окружения задаются в Netlify (Site settings → Environment variables),
// НЕ в коде:
//   BREVO_API_KEY  — ключ из Brevo (xkeysib-...)
//   BREVO_LIST_ID  — ID списка (например, 2). Необязательно.

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
    };

    // Префлайт CORS
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // .trim() на случай лишних пробелов/переносов в значении переменной.
    const API_KEY = (process.env.BREVO_API_KEY || '').trim();
    const LIST_ID = (process.env.BREVO_LIST_ID || '').trim();

    if (!API_KEY) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server not configured: BREVO_API_KEY missing' }) };
    }

    let email;
    try {
        email = JSON.parse(event.body || '{}').email;
    } catch (_) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email' }) };
    }

    const payload = { email, updateEnabled: true };
    if (LIST_ID) payload.listIds = [Number(LIST_ID)];

    try {
        // На рантайме Netlify (Node 18+) fetch доступен глобально.
        const res = await fetch('https://api.brevo.com/v3/contacts', {
            method: 'POST',
            headers: {
                'api-key': API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        // 201 — создан, 204 — обновлён. Оба = успех.
        if (res.status === 201 || res.status === 204) {
            return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
        }

        const data = await res.json().catch(() => ({}));
        // Контакт уже есть в базе — для подписки это тоже успех.
        if (data && data.code === 'duplicate_parameter') {
            return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
        }

        return { statusCode: 502, headers, body: JSON.stringify({ error: 'Brevo request failed', details: data }) };
    } catch (err) {
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'Brevo request failed', details: String(err) }) };
    }
};
