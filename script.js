// Функция для форматирования дат
function formatDates(dates) {
    if (dates.length === 1) {
        // Одна дата: "March 6"
        return new Date(dates[0]).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }

    const firstDate = new Date(dates[0]);
    const lastDate = new Date(dates[dates.length - 1]);

    const firstDay = firstDate.getDate();
    const lastDay = lastDate.getDate();
    const month = firstDate.toLocaleDateString('en-US', { month: 'short' });

    // Проверяем, в одном ли месяце даты
    if (firstDate.getMonth() === lastDate.getMonth()) {
        // Один месяц: "March 26 & 27"
        if (dates.length === 2) {
            return `${month} ${firstDay} & ${lastDay}`;
        } else {
            // Больше двух дат: "March 26-28"
            return `${month} ${firstDay}-${lastDay}`;
        }
    } else {
        // Разные месяцы: "April 30 – May 1"
        const firstMonth = firstDate.toLocaleDateString('en-US', { month: 'short' });
        const lastMonth = lastDate.toLocaleDateString('en-US', { month: 'short' });
        return `${firstMonth} ${firstDay} & ${lastMonth} ${lastDay}`;
    }
}

// Лейбл «since YYYY» показываем, только если последний концерт
// был более 10 лет назад
function lastInPtLabelHTML(year) {
    if (!year) return '';
    const currentYear = new Date().getFullYear();
    if (currentYear - year <= 10) return '';
    return `<span class="last-in-pt">since ${year}</span>`;
}

// Функция для коротких дат в фестивалях
function formatShortDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short'
    });
}

// Справочник площадок (venues.json): { slug: {name, city, mapLink} }.
// У концерта хранится только venue-slug — отсюда подтягиваются city и mapLink,
// чтобы одну и ту же ссылку на карту не вбивать руками для каждого концерта.
// Разворачивает venue-ссылки прямо в данных: проставляет item.city и
// item.mapLink из справочника. Если у item уже есть свои city/mapLink —
// они имеют приоритет (override). Итоговый city: «Город, Площадка».
function resolveVenues(data, venues = {}) {
    const apply = (item) => {
        const v = item.venue && venues[item.venue];
        if (v) {
            // Показываем только город; название площадки пока не выводим
            // (хранится в справочнике, может пригодиться позже).
            if (!item.city) item.city = v.city;
            if (!item.mapLink) item.mapLink = v.mapLink;
        }
        (item.concerts || []).forEach(apply);
    };
    data.forEach(apply);
    return data;
}

// Город + (опционально) иконка-стрелка с ссылкой на Google Maps.
// extraCls — доп. классы на обёртку (напр. 'detail', чтобы скрывать до раскрытия).
// Если mapLink не задан — просто текст, без иконки и без перехода.
function cityHTML(city, mapLink, extraCls = '') {
    if (!city) return '';
    const cls = `concert-city${extraCls ? ' ' + extraCls : ''}`;
    if (mapLink) {
        return `<a href="${mapLink}" target="_blank" rel="noopener" class="${cls} city-link map-link">${city}<img src="compass.svg" alt="Map" class="map-icon"></a>`;
    }
    return `<p class="${cls}">${city}</p>`;
}

// Диапазон дат фестиваля — от первого до последнего концерта.
// Используем ту же логику, что и для обычных концертов (formatDates).
function festivalDateRange(festival) {
    const allDates = festival.concerts
        .flatMap(c => c.dates)
        .slice()
        .sort();
    if (!allDates.length) return '';

    const first = new Date(allDates[0]);
    const last = new Date(allDates[allDates.length - 1]);

    // Один день
    if (allDates[0] === allDates[allDates.length - 1]) {
        return formatDates([allDates[0]]);
    }

    const firstDay = first.getDate();
    const lastDay = last.getDate();

    // Один месяц: «Jun 11–14»
    if (first.getMonth() === last.getMonth()) {
        const month = first.toLocaleDateString('en-US', { month: 'short' });
        return `${month} ${firstDay}–${lastDay}`;
    }

    // Разные месяцы: «Jul 31 – Aug 2»
    const firstMonth = first.toLocaleDateString('en-US', { month: 'short' });
    const lastMonth = last.toLocaleDateString('en-US', { month: 'short' });
    return `${firstMonth} ${firstDay} – ${lastMonth} ${lastDay}`;
}

// Цена фестиваля: показываем стоимость билета на один день со знаком «+»
// (напр. «1 day – €75, 4 days – €180» → €75+; «1 day – €35...75» → €35+).
// Билет на один день — самый дешёвый вариант, поэтому берём минимальное
// число. Если чисел нет (напр. «Free») — возвращаем строку как есть.
function festivalPriceRange(pricing) {
    if (!pricing) return '';
    // Берём только числа из ценовых токенов вида «€35» или «€35...75»,
    // чтобы не зацепить «1 day», «4 days» и т.п.
    const nums = (pricing.match(/€\s*\d+(?:\s*\.\.\.\s*\d+)?/g) || [])
        .flatMap(tok => (tok.match(/\d+/g) || []).map(Number));
    if (!nums.length) return pricing; // «Free» и подобное
    const min = Math.min(...nums);
    return `€${min}+`;
}

// Рендер одного списка концертов в указанный контейнер.
// data — массив концертов/фестивалей; container — DOM-элемент;
// ptDateMap (опционально) — Map «нормализованное имя артиста → дата его
// выступления в PT» (строкой, напр. «Mar 6»). Если артист уже играет в
// Португалии, в ES-списке рисуем рядом лейбл «Mar 6 in PT». Нужно только
// для ES-списка.
function renderConcertList(data, container, ptDateMap, onLayoutChange, pastSlot) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // ===== SPAIN FEATURE (можно удалить вместе с фичей) =====
        // Нормализация имени артиста для сравнения PT/ES
        const norm = (s) => (s || '').trim().toLowerCase();
        const ptDateFor = (artist) => (ptDateMap ? ptDateMap.get(norm(artist)) : undefined);
        // Лейбл «<date> in PT» в стиле .last-in-pt — для дублей в ES-списке
        function inPtLabelHTML(artist) {
            const d = ptDateFor(artist);
            if (!d) return '';
            return `<span class="last-in-pt in-pt-label">${d} in PT</span>`;
        }
        // ===== /SPAIN FEATURE =====

        function getLastDate(item) {
            if (item.type === 'festival') {
                const allDates = item.concerts.flatMap(c => c.dates);
                return new Date(allDates[allDates.length - 1]);
            }
            return new Date(item.dates[item.dates.length - 1]);
        }

        // Есть ли вообще прошедшие концерты — если нет, кнопку не показываем
        const hasPast = data.some(item => getLastDate(item) < today);

        // Кнопка переключения прошедших концертов. Живёт в левой части
        // sticky-плашки (pastSlot). Текст переключается Show/Hide.
        let showPast = false;
        let toggleBtn = null;
        function syncPastLabel() {
            if (toggleBtn) toggleBtn.textContent = showPast ? 'Hide past concerts' : 'Show past concerts';
        }
        if (hasPast) {
            toggleBtn = document.createElement('button');
            toggleBtn.className = 'toggle-past';
            syncPastLabel();
            toggleBtn.addEventListener('click', () => {
                showPast = !showPast;
                syncPastLabel();
                render();
                if (typeof onLayoutChange === 'function') onLayoutChange();
            });
            (pastSlot || container).appendChild(toggleBtn);
        }

        // Какие карточки раскрыты (по индексу в data)
        const expandedSet = new Set();

        // Первую показываемую карточку (первый предстоящий концерт/фестиваль)
        // открываем сразу
        const firstUpcomingIndex = data.findIndex(item => getLastDate(item) >= today);
        if (firstUpcomingIndex !== -1) {
            expandedSet.add(firstUpcomingIndex);
        }

        function insertDivider() {
            const divider = document.createElement('div');
            divider.className = 'today-divider';
            divider.innerHTML = `<div class="today-line"></div>`;
            container.appendChild(divider);
            dividerInserted = true;
        }

        let dividerInserted = false;

        function toggle(index) {
            const expanded = !expandedSet.has(index);
            if (expanded) {
                expandedSet.add(index);
            } else {
                expandedSet.delete(index);
            }

            // Обновляем только саму карточку, не пересоздавая её,
            // чтобы transition на margin и фоне отрабатывал
            const el = cardEls[index];
            if (el) {
                el.classList.toggle('expanded', expanded);
            }

            // ===== SPAIN FEATURE: высота карточки меняется (transition ~0.25s),
            // сообщаем наружу, чтобы пересчитать высоту вьюпорта =====
            if (typeof onLayoutChange === 'function') {
                onLayoutChange();
                // повторно после завершения CSS-анимации раскрытия
                setTimeout(onLayoutChange, 280);
            }
            // ===== /SPAIN FEATURE =====
        }

        // Хранилище отрисованных карточек по индексу — чтобы тоггл менял
        // класс на существующем элементе (иначе transition не отрабатывает)
        const cardEls = {};

        // Внутренняя разметка карточки. Детали всегда в DOM —
        // их появление/скрытие анимируется через CSS по классу .expanded
        function buildCardInner(item) {
            if (item.type === 'festival') {
                // Если у фестиваля есть отмеченные (featured) артисты,
                // в свёрнутом виде показываем только их, остальных скрываем
                const hasFeatured = item.concerts.some(c => c.featured);

                let concertsHTML = '';
                item.concerts.forEach(concert => {
                    const formattedDate = formatShortDate(concert.dates[0]);

                    let supportHTML = '';
                    if (concert.support && concert.support.length) {
                        const shown = concert.support.slice(0, 4);
                        supportHTML = `<p class="support detail">${shown.join(', ')}</p>`;
                    }

                    const lastInPtLabel = lastInPtLabelHTML(concert.lastInPortugal);

                    // Скрываем строку только когда есть featured и этот артист не featured
                    const hiddenCls = (hasFeatured && !concert.featured)
                        ? ' festival-concert-collapsible' : '';

                    // ===== SPAIN FEATURE: лейбл «<date> in PT», если артист уже есть в PT =====
                    const inPtLabel = inPtLabelHTML(concert.artist);
                    // ===== /SPAIN FEATURE =====

                    concertsHTML += `
                        <div class="festival-concert${hiddenCls}">
                            <div class="festival-concert-row">
                                <span class="artist">${concert.artist}${lastInPtLabel}${inPtLabel}</span>
                                <span class="date">${formattedDate}</span>
                            </div>
                            ${supportHTML}
                        </div>
                    `;
                });

                const festivalDates = festivalDateRange(item);
                const festivalPrice = festivalPriceRange(item.pricing);

                const festCityHTML = cityHTML(item.city, item.mapLink, 'detail');

                return `
                    <div class="festival-header concert-row">
                        <div class="concert-name">
                            <h3>${item.name}</h3>
                            ${festCityHTML}
                        </div>
                        <div class="concert-meta">
                            <p>${festivalDates}</p>
                            <div class="detail">
                                <a href="${item.link}" target="_blank" class="price-wrapper ticket-link">
                                    <span class="price">${festivalPrice}</span>
                                    <img src="ticket.svg" alt="Ticket" class="ticket-icon">
                                </a>
                            </div>
                        </div>
                    </div>
                    <div class="festival-concerts">
                        ${concertsHTML}
                    </div>
                `;
            } else {
                const formattedDates = formatDates(item.dates);

                const concertCityHTML = cityHTML(item.city, item.mapLink, 'detail');

                const lastInPtLabel = lastInPtLabelHTML(item.lastInPortugal);

                // ===== SPAIN FEATURE: лейбл «<date> in PT» для дубля в ES =====
                const inPtLabel = inPtLabelHTML(item.artist);
                // ===== /SPAIN FEATURE =====

                return `
                    <div class="concert-row">
                        <div class="concert-name">
                            <h3>${item.artist}${lastInPtLabel}${inPtLabel}</h3>
                            ${concertCityHTML}
                        </div>
                        <div class="concert-meta">
                            <p>${formattedDates}</p>
                            <div class="detail">
                                <a href="${item.link}" target="_blank" class="price-wrapper ticket-link">
                                    <span class="price">${item.price}</span>
                                    <img src="ticket.svg" alt="Ticket" class="ticket-icon">
                                </a>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        function render() {
        container.innerHTML = '';
        dividerInserted = false;
        for (const k in cardEls) delete cardEls[k];

        data.forEach((item, index) => {
            const expanded = expandedSet.has(index);
            const lastDate = getLastDate(item);
            const isPast = lastDate < today;

            // По умолчанию прошедшие концерты скрыты
            if (isPast && !showPast) {
                return;
            }

            // Разделитель «past / upcoming» показываем только когда видны прошедшие
            if (showPast && !dividerInserted && !isPast) {
                insertDivider();
            }

            const div = document.createElement('div');
            let cls = item.type === 'festival' ? 'festival-block' : 'concert';
            if (isPast) cls += ' past';
            if (expanded) cls += ' expanded';
            div.className = cls;

            div.innerHTML = buildCardInner(item);

            // Клик по карточке раскрывает детали; клик по цене — переход на билеты
            div.addEventListener('click', (e) => {
                if (e.target.closest('.ticket-link')) return;
                if (e.target.closest('.map-link')) return;
                toggle(index);
            });

            cardEls[index] = div;
            container.appendChild(div);
        });
        }

        render();
}

// ============================================================
// SPAIN FEATURE — переключатель PT/ES со слайдом.
// СЕЙЧАС ОТКЛЮЧЕНА (закомментирована) — фича на будущее, допиливается.
// Чтобы включить обратно: убрать обёртку /* ... */ вокруг этого блока
// (bootstrap'а) и закомментировать «ОРИГИНАЛЬНЫЙ БУТСТРАП» ниже. Также
// раскомментировать CSS-блок «SPAIN FEATURE» в main.css. Сам рендер с
// поддержкой ES-списка (функция renderConcertList с ptDateMap) остаётся
// в коде выше — он обратно совместим и не мешает одиночному списку.
// Данные лежат в concerts-es.json.
// ============================================================
// SPAIN FEATURE bootstrap — ВКЛЮЧЕНО.
Promise.all([
    fetch('concerts.json').then(r => r.json()),
    fetch('concerts-es.json').then(r => r.json()),
    fetch('venues.json').then(r => r.json()).catch(() => ({})),
])
    .then(([ptData, esData, venues]) => {
        // Разворачиваем venue-ссылки в city/mapLink для обоих списков.
        resolveVenues(ptData, venues);
        resolveVenues(esData, venues);

        const root = document.getElementById('concerts');

        // Map «имя PT-артиста → дата его выступления в PT» (включая
        // участников фестивалей). Дата форматируется как в списке («Mar 6»).
        // Нужна и для подсветки серым, и для лейбла «Mar 6 in PT» в ES.
        const norm = (s) => (s || '').trim().toLowerCase();
        const ptDateMap = new Map();
        const addPt = (artist, dates) => {
            if (!artist || !dates || !dates.length) return;
            const key = norm(artist);
            // Если артист встречается несколько раз — оставляем самую раннюю дату
            if (!ptDateMap.has(key)) ptDateMap.set(key, formatDates([dates[0]]));
        };
        ptData.forEach(item => {
            if (item.type === 'festival') {
                item.concerts.forEach(c => {
                    addPt(c.artist, c.dates);
                    // Артисты из support тоже играют в PT — индексируем их по
                    // дате хедлайнера их дня, чтобы подсветка «in PT» работала
                    // и для них (напр. Nick Cave в support фестиваля).
                    (c.support || []).forEach(name => addPt(name, c.dates));
                });
            } else {
                addPt(item.artist, item.dates);
            }
        });

        // Каркас: сегментный переключатель + два слайда (PT и ES) в «окне».
        // Скользящий индикатор (.country-toggle-thumb) ездит под активной
        // кнопкой; ширина/сдвиг задаются в JS по числу/индексу кнопок.
        root.innerHTML = `
            <div class="country-toggle-bar">
                <div class="past-slot">
                    <div class="past-slot-pane" data-country="pt"></div>
                    <div class="past-slot-pane" data-country="es" hidden></div>
                </div>
                <div class="country-toggle" role="tablist">
                    <span class="country-toggle-thumb" aria-hidden="true"></span>
                    <button class="country-toggle-btn active" data-country="pt" role="tab">PT</button>
                    <button class="country-toggle-btn" data-country="es" role="tab">ES</button>
                </div>
            </div>
            <div class="country-viewport">
                <div class="country-track">
                    <div class="country-pane" id="concerts-pt"></div>
                    <div class="country-pane" id="concerts-es"></div>
                </div>
            </div>
        `;

        const viewport = root.querySelector('.country-viewport');
        const track = root.querySelector('.country-track');
        const panePt = document.getElementById('concerts-pt');
        const paneEs = document.getElementById('concerts-es');
        const toggle = root.querySelector('.country-toggle');
        const thumb = root.querySelector('.country-toggle-thumb');
        const buttons = root.querySelectorAll('.country-toggle-btn');
        const pastSlotPt = root.querySelector('.past-slot-pane[data-country="pt"]');
        const pastSlotEs = root.querySelector('.past-slot-pane[data-country="es"]');

        let activeCountry = 'pt';

        // Скользящий индикатор: ставим его под активную кнопку по её
        // фактическим offsetLeft/offsetWidth (относительно .country-toggle).
        function syncThumb() {
            const active = [...buttons].find(b => b.dataset.country === activeCountry);
            if (!active || !thumb) return;
            thumb.style.width = active.offsetWidth + 'px';
            thumb.style.transform = `translateX(${active.offsetLeft}px)`;
        }

        // Зазор между странами (должен совпадать с gap у .country-track в CSS)
        const GAP = 20;

        // Высота вьюпорта = высота активной панели. Так список не
        // наследует высоту соседней страны, и хвост более длинной
        // (неактивной) панели не торчит снизу.
        function syncHeight() {
            const activePane = activeCountry === 'es' ? paneEs : panePt;
            viewport.style.height = activePane.offsetHeight + 'px';
        }

        // Сдвиг трека под активную страну. PT — позиция 0; ES — сдвиг
        // влево на фактическую ширину одной панели + зазор. Считаем в
        // пикселях по реальной ширине панели, чтобы исключить любую
        // неоднозначность с процентами в translateX.
        function syncSlide() {
            const offset = activeCountry === 'es' ? -(panePt.offsetWidth + GAP) : 0;
            track.style.transform = `translateX(${offset}px)`;
        }

        // Колбэк раскрытия карточки пересчитывает высоту только если
        // меняли активную в данный момент страну.
        const onPtLayout = () => { if (activeCountry === 'pt') syncHeight(); };
        const onEsLayout = () => { if (activeCountry === 'es') syncHeight(); };

        renderConcertList(ptData, panePt, undefined, onPtLayout, pastSlotPt);
        renderConcertList(esData, paneEs, ptDateMap, onEsLayout, pastSlotEs);

        // «Show past concerts» в плашке принадлежит активной стране —
        // показываем слот активной, прячем неактивный.
        function syncPastSlot() {
            pastSlotPt.hidden = activeCountry !== 'pt';
            pastSlotEs.hidden = activeCountry !== 'es';
        }

        // aria-hidden на неактивной панели — и для доступности,
        // и чтобы отрубить её клики (см. CSS pointer-events).
        function syncAria() {
            panePt.setAttribute('aria-hidden', activeCountry === 'pt' ? 'false' : 'true');
            paneEs.setAttribute('aria-hidden', activeCountry === 'es' ? 'false' : 'true');
        }

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                activeCountry = btn.dataset.country;
                buttons.forEach(b => b.classList.toggle('active', b === btn));
                syncSlide();
                syncAria();
                syncPastSlot();
                syncHeight();
                syncThumb();
            });
        });

        // Стартовая высота, aria, сдвиг и индикатор. Картинки (иконки
        // билета/карты) могут догрузиться позже и изменить высоту —
        // пересчитываем по load.
        syncAria();
        syncPastSlot();
        syncHeight();
        syncSlide();
        syncThumb();
        // При ресайзе меняется ширина панели/кнопок — пересчитываем сдвиг,
        // высоту и индикатор. disable-transition на время ресайза, чтобы
        // трек и индикатор не «ехали» рывками.
        const onResize = () => {
            const prevTrack = track.style.transition;
            const prevThumb = thumb ? thumb.style.transition : '';
            track.style.transition = 'none';
            if (thumb) thumb.style.transition = 'none';
            syncSlide();
            syncHeight();
            syncThumb();
            requestAnimationFrame(() => {
                track.style.transition = prevTrack;
                if (thumb) thumb.style.transition = prevThumb;
            });
        };
        window.addEventListener('load', () => { syncHeight(); syncSlide(); syncThumb(); });
        window.addEventListener('resize', onResize);
    })
    .catch(error => console.error('Ошибка загрузки данных:', error));
// ===== /SPAIN FEATURE — bootstrap (включено) =====

// ОРИГИНАЛЬНЫЙ БУТСТРАП (отключён, пока активна фича Испании):
// Грузим список концертов и справочник площадок параллельно, затем
// разворачиваем venue-ссылки в city/mapLink перед рендером.
/*
Promise.all([
    fetch('concerts.json').then(r => r.json()),
    fetch('venues.json').then(r => r.json()).catch(() => ({})),
])
    .then(([data, venues]) => {
        resolveVenues(data, venues);
        renderConcertList(data, document.getElementById('concerts'));
    })
    .catch(error => console.error('Ошибка загрузки данных:', error));
*/

// Подписка на рассылку.
// Локально (localhost) форма стучится в server.js на порту 3000.
// На проде (Netlify) — в serverless-функцию. И там, и там API-ключ Brevo
// живёт только на сервере, в браузер не попадает.
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const SUBSCRIBE_ENDPOINT = IS_LOCAL
    ? 'http://localhost:3000/subscribe'
    : '/.netlify/functions/subscribe';

function initSubscribeForm() {
    const form = document.querySelector('.subscribe-form');
    if (!form) return;

    const input = form.querySelector('.subscribe-input');
    const button = form.querySelector('.subscribe-button');
    const message = form.querySelector('.subscribe-message');

    function setMessage(text, type) {
        message.textContent = text;
        message.classList.remove('success', 'error');
        if (type) message.classList.add(type);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = input.value.trim();
        if (!email || !input.checkValidity()) {
            setMessage('Please enter a valid email address.', 'error');
            input.focus();
            return;
        }

        button.disabled = true;
        setMessage('Subscribing…', null);

        try {
            if (SUBSCRIBE_ENDPOINT) {
                const res = await fetch(SUBSCRIBE_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ email })
                });
                if (!res.ok) throw new Error('Request failed');
            } else {
                // Заглушка, пока бэкенд не подключён
                await new Promise(r => setTimeout(r, 500));
            }

            form.reset();
            setMessage("You're in. See you at the start of the month.", 'success');
            button.disabled = false;
        } catch (err) {
            setMessage('Something went wrong. Please try again.', 'error');
            button.disabled = false;
        }
    });
}

// Навешиваем обработчик после готовности DOM — на случай, если скрипт
// загружен в <head> без defer или форма появляется позже.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSubscribeForm);
} else {
    initSubscribeForm();
}
