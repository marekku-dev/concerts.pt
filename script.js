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

// Функция для коротких дат в фестивалях
function formatShortDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short'
    });
}

fetch('concerts.json')
    .then(response => response.json())
    .then(data => {
        const container = document.getElementById('concerts');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        function getLastDate(item) {
            if (item.type === 'festival') {
                const allDates = item.concerts.flatMap(c => c.dates);
                return new Date(allDates[allDates.length - 1]);
            }
            return new Date(item.dates[item.dates.length - 1]);
        }

        // Есть ли вообще прошедшие концерты — если нет, кнопку не показываем
        const hasPast = data.some(item => getLastDate(item) < today);

        // Кнопка переключения над списком
        let showPast = false;
        let toggleBtn = null;
        if (hasPast) {
            toggleBtn = document.createElement('button');
            toggleBtn.className = 'toggle-past';
            toggleBtn.addEventListener('click', () => {
                showPast = !showPast;
                render();
            });
        }

        // Какие карточки раскрыты (по индексу в data)
        const expandedSet = new Set();

        function insertDivider() {
            const divider = document.createElement('div');
            divider.className = 'today-divider';
            divider.innerHTML = `
                <div class="today-divider-past">past</div>
                <div class="today-divider-upcoming">upcoming</div>
            `;
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
        }

        // Хранилище отрисованных карточек по индексу — чтобы тоггл менял
        // класс на существующем элементе (иначе transition не отрабатывает)
        const cardEls = {};

        // Внутренняя разметка карточки. Детали всегда в DOM —
        // их появление/скрытие анимируется через CSS по классу .expanded
        function buildCardInner(item) {
            if (item.type === 'festival') {
                let concertsHTML = '';
                item.concerts.forEach(concert => {
                    const formattedDate = formatShortDate(concert.dates[0]);

                    let supportHTML = '';
                    if (concert.support && concert.support.length) {
                        const shown = concert.support.slice(0, 4);
                        supportHTML = `<p class="support detail">${shown.join(', ')}</p>`;
                    }

                    concertsHTML += `
                        <div class="festival-concert">
                            <div class="festival-concert-row">
                                <span class="artist">${concert.artist}</span>
                                <span class="date">${formattedDate}</span>
                            </div>
                            ${supportHTML}
                        </div>
                    `;
                });

                return `
                    <div class="festival-header">
                        <h3>${item.name}<!-- <span class="fest-badge">FEST</span> --></h3>
                        <div class="detail">
                            <a href="${item.link}" target="_blank" class="price-wrapper ticket-link">
                                <p class="price">${item.pricing}</p>
                                <img src="ticket.svg" alt="Ticket" class="ticket-icon">
                            </a>
                        </div>
                    </div>
                    <div class="festival-concerts">
                        ${concertsHTML}
                    </div>
                `;
            } else {
                const formattedDates = formatDates(item.dates);

                const cityHTML = item.city
                    ? `<p class="concert-city detail">${item.city}</p>` : '';

                const lastInPtHTML = item.lastInPortugal
                    ? `<p class="last-in-pt detail">First time since ${item.lastInPortugal}</p>` : '';

                return `
                    <div class="concert-row">
                        <div class="concert-name">
                            <h3>${item.artist}</h3>
                            ${cityHTML}
                            ${lastInPtHTML}
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
                toggle(index);
            });

            cardEls[index] = div;
            container.appendChild(div);
        });
        }

        render();
    })
    .catch(error => console.error('Ошибка загрузки данных:', error));

// Подписка на рассылку
// TODO: подставь сюда свой endpoint от Brevo/Zoho, когда будет готов.
// Пока null — форма просто имитирует успешную отправку.
const SUBSCRIBE_ENDPOINT = null;

(function () {
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
})();
