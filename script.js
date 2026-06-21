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
            if (expandedSet.has(index)) {
                expandedSet.delete(index);
            } else {
                expandedSet.add(index);
            }
            render();
        }

        function render() {
        container.innerHTML = '';
        dividerInserted = false;

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

            if (item.type === 'festival') {
                // Блок фестиваля
                const festivalDiv = document.createElement('div');
                let festClass = 'festival-block';
                if (isPast) festClass += ' past';
                if (expanded) festClass += ' expanded';
                festivalDiv.className = festClass;

                // Генерируем список концертов фестиваля
                let concertsHTML = '';
                item.concerts.forEach(concert => {
                    const formattedDate = formatShortDate(concert.dates[0]);

                    let artistText = concert.artist;
                    if (expanded && concert.support && concert.support.length) {
                        const shown = concert.support.slice(0, 4);
                        artistText += `<span class="support">, ${shown.join(', ')}</span>`;
                    }

                    concertsHTML += `
                        <div class="festival-concert">
                            <span class="artist">${artistText}</span>
                            <span class="date">${formattedDate}</span>
                        </div>
                    `;
                });

                let festPriceHTML = '';
                if (expanded) {
                    festPriceHTML = `
                        <a href="${item.link}" target="_blank" class="price-wrapper ticket-link">
                            <p class="price">${item.pricing}</p>
                            <img src="ticket.svg" alt="Ticket" class="ticket-icon">
                        </a>
                    `;
                }

                festivalDiv.innerHTML = `
                    <div class="festival-header">
                        <h3>${item.name}<!-- <span class="fest-badge">FEST</span> --></h3>
                        ${festPriceHTML}
                    </div>
                    <div class="festival-concerts">
                        ${concertsHTML}
                    </div>
                `;

                // Клик по фестивалю раскрывает детали; клик по цене — переход на билеты
                festivalDiv.addEventListener('click', (e) => {
                    if (e.target.closest('.ticket-link')) return;
                    toggle(index);
                });

                container.appendChild(festivalDiv);

            } else {
                // Обычный концерт
                const div = document.createElement('div');
                div.className = isPast ? 'concert past' : 'concert';

                const formattedDates = formatDates(item.dates);

                let cityHTML = '';
                if (expanded && item.city) {
                    cityHTML = `<p class="concert-city">${item.city}</p>`;
                }

                let lastInPtHTML = '';
                if (expanded && item.lastInPortugal) {
                    lastInPtHTML = `<p class="last-in-pt">First time since ${item.lastInPortugal}</p>`;
                }

                let priceHTML = '';
                if (expanded) {
                    priceHTML = `
                        <a href="${item.link}" target="_blank" class="price-wrapper ticket-link">
                            <span class="price">${item.price}</span>
                            <img src="ticket.svg" alt="Ticket" class="ticket-icon">
                        </a>
                    `;
                }

                if (expanded) div.className += ' expanded';

                div.innerHTML = `
                    <div class="concert-row">
                        <div class="concert-name">
                            <h3>${item.artist}</h3>
                            ${cityHTML}
                            ${lastInPtHTML}
                        </div>
                        <div class="concert-meta">
                            <p>${formattedDates}</p>
                            ${priceHTML}
                        </div>
                    </div>
                `;

                // Клик по концерту раскрывает детали; клик по цене — переход на билеты
                div.addEventListener('click', (e) => {
                    if (e.target.closest('.ticket-link')) return;
                    toggle(index);
                });

                container.appendChild(div);
            }
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
