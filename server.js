// Локальный прокси для подписки через Brevo.
// Запуск:  BREVO_API_KEY="xkeysib-..." BREVO_LIST_ID="3" node server.js
// Форма (script.js) шлёт POST /subscribe { "email": "..." },
// а этот сервер добавляет API-ключ и форвардит запрос в Brevo.
//
// Зачем прокси: API-ключ Brevo нельзя класть во фронтенд-код (его видно
// в браузере). Ключ живёт только здесь, в переменной окружения.

const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
// .trim() убирает случайные пробелы/переносы строки из ключа при копипасте —
// иначе Node падает с ERR_INVALID_CHAR при формировании заголовка.
const API_KEY = (process.env.BREVO_API_KEY || '').trim();
const LIST_ID = (process.env.BREVO_LIST_ID || '').trim(); // ID списка в Brevo (число), необязательно

// Откуда разрешаем запросы (твой локальный сайт). '*' — для удобства теста.
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

if (!API_KEY) {
    console.error('\n❌ Не задан BREVO_API_KEY. Запусти так:');
    console.error('   BREVO_API_KEY="xkeysib-..." BREVO_LIST_ID="3" node server.js\n');
    process.exit(1);
}

// HTTP-заголовки разрешают только ASCII. Если в ключе остались умные кавычки,
// кириллица или прочий мусор от копипаста — ловим это сразу с понятной подсказкой.
if (!/^[\x20-\x7E]+$/.test(API_KEY)) {
    console.error('\n❌ В BREVO_API_KEY есть недопустимые символы (возможно, «умные» кавычки');
    console.error('   или лишние пробелы при копировании). Скопируй ключ заново из Brevo,');
    console.error('   вставь в обычных прямых кавычках "..." и запусти снова.\n');
    process.exit(1);
}

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

function sendJson(res, status, obj) {
    setCors(res);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
}

// Отправляем контакт в Brevo через их REST API.
function createBrevoContact(email) {
    return new Promise((resolve, reject) => {
        const payload = {
            email: email,
            updateEnabled: true, // не падать, если контакт уже есть
        };
        if (LIST_ID) payload.listIds = [Number(LIST_ID)];

        const body = JSON.stringify(payload);

        const req = https.request({
            hostname: 'api.brevo.com',
            path: '/v3/contacts',
            method: 'POST',
            headers: {
                'api-key': API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        }, (apiRes) => {
            let data = '';
            apiRes.on('data', (chunk) => (data += chunk));
            apiRes.on('end', () => {
                // 201 — создан, 204 — обновлён. Оба = успех.
                if (apiRes.statusCode === 201 || apiRes.statusCode === 204) {
                    resolve({ ok: true });
                } else {
                    let parsed;
                    try { parsed = JSON.parse(data); } catch (_) { parsed = { raw: data }; }
                    // Brevo возвращает "duplicate_parameter", если контакт уже в базе —
                    // для теста подписки это тоже считаем успехом.
                    if (parsed && parsed.code === 'duplicate_parameter') {
                        resolve({ ok: true, duplicate: true });
                    } else {
                        reject({ status: apiRes.statusCode, body: parsed });
                    }
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

const server = http.createServer((req, res) => {
    // Префлайт CORS
    if (req.method === 'OPTIONS') {
        setCors(res);
        res.writeHead(204);
        return res.end();
    }

    if (req.method === 'POST' && req.url === '/subscribe') {
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk;
            if (raw.length > 1e4) req.destroy(); // защита от слишком больших тел
        });
        req.on('end', async () => {
            let email;
            try {
                email = JSON.parse(raw).email;
            } catch (_) {
                return sendJson(res, 400, { error: 'Invalid JSON' });
            }

            if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
                return sendJson(res, 400, { error: 'Invalid email' });
            }

            try {
                const result = await createBrevoContact(email);
                console.log(`✅ ${email} → Brevo${result.duplicate ? ' (уже был)' : ''}`);
                return sendJson(res, 200, { ok: true });
            } catch (err) {
                console.error('❌ Brevo error:', JSON.stringify(err));
                return sendJson(res, 502, { error: 'Brevo request failed', details: err });
            }
        });
        return;
    }

    sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
    console.log(`\n🚀 Прокси подписки запущен: http://localhost:${PORT}`);
    console.log(`   POST /subscribe  { "email": "..." }`);
    console.log(`   Список Brevo: ${LIST_ID ? `#${LIST_ID}` : '(не задан — контакт без списка)'}\n`);
});
