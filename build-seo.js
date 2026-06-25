#!/usr/bin/env node
/*
 * build-seo.js — генерация SEO-артефактов для concerts.pt.
 *
 * Запускается на этапе деплоя (см. netlify.toml). Делает три вещи из
 * concerts.json + venues.json:
 *
 *   1) JSON-LD (schema.org MusicEvent) — встраивается в <head> между
 *      маркером <!-- SEO:JSONLD --> и тегом <script ... script.js>.
 *      Даёт Google rich results: даты, площадки, цены, ссылки на билеты.
 *
 *   2) Статический HTML-fallback списка концертов — встраивается в
 *      #concerts между маркерами SEO:PRERENDER:START/END. Боты (и соцсети,
 *      и пользователи без JS) видят реальный контент сразу, не пустой div.
 *      На клиенте script.js всё равно перерисует #concerts интерактивно —
 *      этот HTML лишь fallback для индексации.
 *
 *   3) sitemap.xml с актуальным lastmod.
 *
 * Скрипт идемпотентен: повторный запуск перезаписывает содержимое между
 * маркерами, ничего не дублируя. Зависимостей нет (чистый Node).
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SITE = 'https://concerts.pt';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const readJSON = (f) => JSON.parse(read(f));

// --- утилиты ---------------------------------------------------------------

// Экранирование для вставки в HTML-текст/атрибуты.
function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Извлечь минимальную цену (в EUR) из строк вида «€26...39», «€20...35»,
// «1 day – €75, 4 days – €180». Возвращает число или null.
function minPrice(str) {
    if (!str) return null;
    const nums = (str.match(/€\s*\d+/g) || []).map((t) => Number(t.replace(/\D/g, '')));
    return nums.length ? Math.min(...nums) : null;
}

// Развернуть venue-slug в city/mapLink из справочника (как resolveVenues
// в script.js, но без мутации исходных данных сверх нужного).
function resolveCity(item, venues) {
    if (item.city) return item.city;
    const v = item.venue && venues[item.venue];
    return v ? v.city : null;
}
function resolveVenueName(item, venues) {
    const v = item.venue && venues[item.venue];
    return v ? v.name : null;
}

// Форматирование даты для отображения, в стиле script.js («Mar 6»).
function fmtDate(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}

// --- JSON-LD ---------------------------------------------------------------

function eventNode({ name, startDate, endDate, city, venueName, url, price }) {
    const locationName = venueName || city || 'Portugal';
    const node = {
        '@type': 'MusicEvent',
        name,
        startDate,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
            '@type': 'Place',
            name: locationName,
            address: {
                '@type': 'PostalAddress',
                addressLocality: city || undefined,
                addressCountry: 'PT',
            },
        },
    };
    if (endDate && endDate !== startDate) node.endDate = endDate;
    if (url) {
        node.offers = {
            '@type': 'Offer',
            url,
            priceCurrency: 'EUR',
            availability: 'https://schema.org/InStock',
        };
        if (price != null) node.offers.price = String(price);
    }
    return node;
}

function buildJsonLd(data, venues) {
    const events = [];

    for (const item of data) {
        if (item.type === 'festival') {
            const city = resolveCity(item, venues);
            const venueName = resolveVenueName(item, venues);
            const allDates = item.concerts.flatMap((c) => c.dates).slice().sort();
            const price = minPrice(item.pricing);
            // Сам фестиваль как событие
            events.push(
                eventNode({
                    name: item.name,
                    startDate: allDates[0],
                    endDate: allDates[allDates.length - 1],
                    city,
                    venueName,
                    url: item.link,
                    price,
                })
            );
        } else {
            const city = resolveCity(item, venues);
            const venueName = resolveVenueName(item, venues);
            const dates = item.dates.slice().sort();
            events.push(
                eventNode({
                    name: item.artist,
                    startDate: dates[0],
                    endDate: dates[dates.length - 1],
                    city,
                    venueName,
                    url: item.link,
                    price: minPrice(item.price),
                })
            );
        }
    }

    const graph = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebSite',
                name: 'Concerts in Portugal 2026',
                url: SITE + '/',
            },
            {
                '@type': 'ItemList',
                name: 'Concerts in Portugal 2026',
                numberOfItems: events.length,
                itemListElement: events.map((ev, i) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    item: ev,
                })),
            },
        ],
    };

    return '<script type="application/ld+json">\n' +
        JSON.stringify(graph, null, 2) +
        '\n\t</script>';
}

// --- Статический HTML-fallback --------------------------------------------

function buildPrerender(data, venues) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = [];
    for (const item of data) {
        if (item.type === 'festival') {
            const city = resolveCity(item, venues);
            const allDates = item.concerts.flatMap((c) => c.dates).slice().sort();
            const start = allDates[0];
            const lineup = item.concerts.map((c) => esc(c.artist)).join(', ');
            rows.push(
                `\t\t<li class="prerender-item">` +
                `<a href="${esc(item.link)}" rel="noopener">` +
                `<strong>${esc(item.name)}</strong></a>` +
                (city ? ` — ${esc(city)}` : '') +
                ` (${esc(fmtDate(start))})` +
                (lineup ? `<span class="prerender-lineup">: ${lineup}</span>` : '') +
                `</li>`
            );
        } else {
            const city = resolveCity(item, venues);
            const start = item.dates.slice().sort()[0];
            rows.push(
                `\t\t<li class="prerender-item">` +
                `<a href="${esc(item.link)}" rel="noopener">` +
                `<strong>${esc(item.artist)}</strong></a>` +
                (city ? ` — ${esc(city)}` : '') +
                ` (${esc(fmtDate(start))})` +
                (item.price ? ` · ${esc(item.price)}` : '') +
                `</li>`
            );
        }
    }

    // Класс prerender-list — чтобы при желании можно было скрыть/стилизовать.
    // script.js всё равно заменит innerHTML #concerts на интерактивную версию.
    return (
        `<div id="concerts">\n` +
        `\t<ul class="prerender-list">\n` +
        rows.join('\n') +
        `\n\t</ul>\n` +
        `\t</div>`
    );
}

// --- sitemap ---------------------------------------------------------------

function buildSitemap() {
    const today = new Date().toISOString().slice(0, 10);
    return (
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        `  <url>\n` +
        `    <loc>${SITE}/</loc>\n` +
        `    <lastmod>${today}</lastmod>\n` +
        `    <changefreq>weekly</changefreq>\n` +
        `    <priority>1.0</priority>\n` +
        `  </url>\n` +
        `</urlset>\n`
    );
}

// --- инъекция в index.html -------------------------------------------------

function injectBetween(html, startMarker, endMarker, replacement) {
    const startIdx = html.indexOf(startMarker);
    const endIdx = html.indexOf(endMarker);
    if (startIdx === -1 || endIdx === -1) {
        throw new Error(`Маркеры не найдены: ${startMarker} / ${endMarker}`);
    }
    const before = html.slice(0, startIdx + startMarker.length);
    const after = html.slice(endIdx);
    return before + '\n\t' + replacement + '\n\t' + after;
}

function injectAfter(html, marker, replacement) {
    const idx = html.indexOf(marker);
    if (idx === -1) throw new Error(`Маркер не найден: ${marker}`);
    const afterMarker = idx + marker.length;
    let rest = html.slice(afterMarker);

    // Идемпотентность: если после маркера уже есть один или несколько ранее
    // вставленных JSON-LD блоков, вырезаем их все, прежде чем вставлять новый.
    // Иначе при каждом прогоне блок дублировался бы (он сам начинается с
    // <script>, поэтому раньше поиск «следующего <script» находил его же).
    const jsonLd = /^\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/;
    while (jsonLd.test(rest)) {
        rest = rest.replace(jsonLd, '');
    }

    return html.slice(0, afterMarker) + '\n\t' + replacement + '\n' + rest;
}

// --- main ------------------------------------------------------------------

function main() {
    const data = readJSON('concerts.json');
    let venues = {};
    try {
        venues = readJSON('venues.json');
    } catch (_) {
        /* venues.json опционален */
    }

    let html = read('index.html');

    // 1) JSON-LD в <head>
    html = injectAfter(html, '<!-- SEO:JSONLD -->', buildJsonLd(data, venues));

    // 2) Статический HTML-fallback в #concerts
    html = injectBetween(
        html,
        '<!-- SEO:PRERENDER:START -->',
        '<!-- SEO:PRERENDER:END -->',
        buildPrerender(data, venues)
    );

    fs.writeFileSync(path.join(ROOT, 'index.html'), html);

    // 3) sitemap.xml
    fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), buildSitemap());

    const eventCount = data.length;
    console.log(`[build-seo] OK — ${eventCount} events, JSON-LD + prerender + sitemap written.`);
}

main();
