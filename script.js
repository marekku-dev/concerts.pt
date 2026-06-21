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

        // Кнопка раскрытия всех исполнителей фестивалей
        let expanded = false;
        const expandBtn = document.createElement('button');
        expandBtn.className = 'toggle-past expand-lineup';
        expandBtn.addEventListener('click', () => {
            expanded = !expanded;
            render();
        });

        // Строка с кнопками над списком
        const controlsRow = document.createElement('div');
        controlsRow.className = 'controls-row';

        function insertDivider() {
            const divider = document.createElement('div');
            divider.className = 'today-divider';
            divider.innerHTML = `
                <div class="today-divider-past">past</div>
                <div class="today-line"></div>
                <div class="today-divider-upcoming">upcoming</div>
            `;
            const prevEl = container.lastElementChild;
            if (prevEl && prevEl.classList.contains('festival-block')) {
                prevEl.classList.add('no-border-bottom');
            }
            container.appendChild(divider);
            dividerInserted = true;
        }

        let dividerInserted = false;

        function render() {
        container.innerHTML = '';
        dividerInserted = false;

        controlsRow.innerHTML = '';
        // Кнопка показа прошедших концертов временно отключена
        // if (toggleBtn) {
        //     toggleBtn.textContent = showPast ? 'Hide past concerts' : 'Show past concerts';
        //     controlsRow.appendChild(toggleBtn);
        // }
        expandBtn.textContent = expanded ? 'Hide details' : 'Show details';
        controlsRow.appendChild(expandBtn);
        container.appendChild(controlsRow);

        data.forEach((item, index) => {
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
                if (index > 0 && !isPast && container.lastElementChild && container.lastElementChild.classList.contains('today-divider')) {
                    festClass += ' no-border-top';
                }
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
                        <div class="price-wrapper">
                            <p class="price">${item.pricing}</p>
                            <img src="ticket.svg" alt="Ticket" class="ticket-icon">
                        </div>
                    `;
                }

                festivalDiv.innerHTML = `
                    <a href="${item.link}" target="_blank" class="festival-link">
                        <div class="festival-header">
                            <h3>${item.name}<!-- <span class="fest-badge">FEST</span> --></h3>
                            ${festPriceHTML}
                        </div>
                        <div class="festival-concerts">
                            ${concertsHTML}
                        </div>
                    </a>
                `;

                container.appendChild(festivalDiv);

            } else {
                // Обычный концерт
                const div = document.createElement('div');
                div.className = isPast ? 'concert past' : 'concert';

                const formattedDates = formatDates(item.dates);

                let lastInPtHTML = '';
                if (expanded && item.lastInPortugal) {
                    lastInPtHTML = `<p class="last-in-pt">First time since ${item.lastInPortugal}</p>`;
                }

                let priceHTML = '';
                if (expanded) {
                    priceHTML = `
                        <span class="price-wrapper">
                            <span class="price">${item.price}</span>
                            <img src="ticket.svg" alt="Ticket" class="ticket-icon">
                        </span>
                    `;
                }

                div.innerHTML = `
                    <a href="${item.link}" target="_blank" class="concert-link">
                        <div class="concert-row">
                            <div class="concert-name">
                                <h3>${item.artist}</h3>
                                ${lastInPtHTML}
                            </div>
                            <div class="concert-meta">
                                <p>${formattedDates}</p>
                                ${priceHTML}
                            </div>
                        </div>
                    </a>
                `;

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
