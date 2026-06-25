# SEO-аудит и план для concerts.pt

Цель: продвижение в поисковой выдаче для двух аудиторий — туристы (английский) и местные жители Португалии (португальский).

Дата: июнь 2026.

---

## Короткий ответ

Да, SEO для concerts.pt не просто уместно — это, вероятно, **самый сильный канал роста**. Причины:

- **Высокий поисковый интент.** Люди гуглят «concerts in Portugal 2026», «Lisbon concerts», «who's playing in Porto», «concertos em Lisboa». Они уже хотят ровно то, что у тебя есть.
- **Точное доменное имя** (concerts.pt) — сильный сигнал релевантности и доверия.
- **Свежий, структурированный контент** (даты, площадки, цены) — Google любит афиши и умеет показывать их как rich results.

Минус: сейчас базовой SEO-инфраструктуры почти нет, а контент рендерится через JS. Ниже — что именно и в каком порядке чинить.

---

## Аудит текущего состояния

### Что уже хорошо
- Чистая семантика: один `<h1>`, осмысленный `<h2>`, `<footer>`.
- Open Graph теги есть (title, image, url, site_name).
- Данные о концертах хранятся структурированно в `concerts.json` — это золото для JSON-LD.
- Лёгкий сайт, статика на Netlify — быстрая загрузка из коробки.

### Критичные пробелы

1. **Контент рендерится через JavaScript.** `<div id="concerts">` пустой в HTML, наполняется из `script.js`. Google рендерит JS, но: медленнее индексирует, рискованнее, и часть краулеров (соцсети, некоторые поисковики) JS вообще не выполняют. Сейчас бот видит почти пустую страницу.

2. **Нет `<meta name="description">`.** Это текст сниппета в выдаче — влияет на кликабельность напрямую.

3. **Нет structured data (JSON-LD).** Для концертов есть schema.org `MusicEvent`. Это даёт rich results: даты, площадки, цены прямо в Google, иногда карусель событий. Для сайта-афиши — огромный буст.

4. **Нет `sitemap.xml` и `robots.txt`.** Без них индексация медленнее и менее предсказуема.

5. **`lang="en"` при двуязычной цели.** Для местных нужна либо отдельная PT-версия с `hreflang`, либо как минимум корректная языковая разметка.

6. **Нет Twitter Card тегов** (`twitter:card`, `twitter:title`, `twitter:image`). OG частично подхватывается, но явные теги надёжнее.

7. **`<title>` статичный и неоптимальный.** «Concerts in Portugal 2026» — ок, но можно усилить городами/ключами.

8. **Нет канонического URL** (`<link rel="canonical">`).

---

## План действий (по приоритету)

### Приоритет 1 — фундамент (быстро, высокий эффект)

**1.1. Meta description.** Добавить в `<head>`:
```html
<meta name="description" content="Hand-picked list of major international artists performing live in Portugal in 2026 — Lisbon, Porto and beyond. Dates, venues and ticket links in one place.">
```

**1.2. JSON-LD structured data (`MusicEvent`).** Самое важное изменение. Генерировать из `concerts.json` — у тебя уже есть все поля (artist, dates, price, link, city). Вариант: добавить блок `<script type="application/ld+json">` либо статически (через build-шаг из JSON), либо инжектить тем же `script.js`, что рендерит концерты. Статически — надёжнее для SEO.

Пример на один концерт:
```json
{
  "@context": "https://schema.org",
  "@type": "MusicEvent",
  "name": "The Kooks",
  "startDate": "2026-03-06",
  "location": { "@type": "Place", "name": "Lisbon", "address": "Lisbon, Portugal" },
  "offers": { "@type": "Offer", "url": "https://...", "priceCurrency": "EUR" },
  "eventStatus": "https://schema.org/EventScheduled"
}
```
Обернуть все события в массив `@graph` или `ItemList`.

**1.3. robots.txt** (в корне):
```
User-agent: *
Allow: /
Sitemap: https://concerts.pt/sitemap.xml
```

**1.4. sitemap.xml** (в корне). Для одностраничника — простой, но обязателен:
```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://concerts.pt/</loc><lastmod>2026-06-21</lastmod></url>
</urlset>
```
`lastmod` стоит обновлять при каждом апдейте списка (можно автоматизировать в том же месте, где обновляется «Last updated»).

**1.5. Canonical + Twitter cards:**
```html
<link rel="canonical" href="https://concerts.pt/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Concerts in Portugal 2026">
<meta name="twitter:image" content="https://concerts.pt/opengraph.png">
```

### Приоритет 2 — рендеринг контента для ботов

**2.1. Сделать концерты видимыми в HTML.** Сейчас бот видит пустой `#concerts`. Варианты по возрастанию усилий:
- **Лучший для статики:** на этапе деплоя сгенерировать HTML-список концертов прямо в `index.html` из `concerts.json` (Netlify build-шаг / небольшой Node-скрипт). JS оставить для интерактива.
- **Альтернатива:** Netlify prerendering / serverless рендер.
- Минимум: убедиться, что текущий JS-рендер выполняется быстро и без ошибок (Google-бот должен успеть отрендерить).

Это снимает главный риск: что Google индексирует тебя как пустую страницу.

### Приоритет 3 — двуязычность (для местных)

**3.1. Решить структуру.** Варианты:
- `/` (EN) + `/pt/` (португальский) — раздельные страницы, чистый `hreflang`. Рекомендую.
- Один URL с переключателем (как Spain toggle) — хуже для SEO, т.к. Google видит один язык на URL.

**3.2. hreflang теги** (когда появится PT-версия):
```html
<link rel="alternate" hreflang="en" href="https://concerts.pt/">
<link rel="alternate" hreflang="pt" href="https://concerts.pt/pt/">
<link rel="alternate" hreflang="x-default" href="https://concerts.pt/">
```

**3.3. Перевести ключевой текст** на PT-странице: `<title>`, `<h1>`, description, intro. Целевые запросы местных: «concertos em Portugal 2026», «concertos Lisboa», «concertos Porto».

### Приоритет 4 — контент и ключевые слова

- **Город в заголовках.** Запросы с городами («Lisbon concerts», «Porto concerts») — отдельный трафик. Стоит подумать о секциях/якорях по городам или даже отдельных страницах `/lisbon`, `/porto`.
- **Страницы по артистам** (амбициозно): отдельная страница на крупного артиста («Tame Impala Portugal 2026») ловит брендовый трафик. Каждая — с своим JSON-LD. Это самый сильный долгосрочный ход, но и самый трудозатратный.
- **Расширить intro-текст** — больше естественных ключевых слов (города, «live music», «tour dates», «tickets»).

### Приоритет 5 — измерение и индексация

- **Google Search Console.** Подтвердить домен, отправить sitemap, отслеживать запросы и ошибки индексации. Бесплатно, обязательно.
- **Bing Webmaster Tools** — заодно, минута работы.
- У тебя уже стоит Umami — хорошо для трафика, но GSC покажет именно поисковые запросы и позиции.

---

## Рекомендуемый первый шаг

Сделать **Приоритет 1 целиком** (meta description, JSON-LD, robots.txt, sitemap, canonical, twitter cards) + **2.1** (HTML-рендер концертов на деплое). Это закрывает 80% технического SEO за один заход и не требует переписывать сайт.

Затем подключить **Google Search Console** и через 2–4 недели смотреть, по каким запросам уже приходят люди — это подскажет, куда расширяться (города/артисты) в Приоритете 4.

PT-версию (Приоритет 3) — отдельным этапом, когда EN-фундамент устаканится.
