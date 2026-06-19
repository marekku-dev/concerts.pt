// Функция для форматирования дат
function formatDates(dates) {
    if (dates.length === 1) {
        // Одна дата: "March 6"
        return new Date(dates[0]).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric'
        });
    }

    const firstDate = new Date(dates[0]);
    const lastDate = new Date(dates[dates.length - 1]);

    const firstDay = firstDate.getDate();
    const lastDay = lastDate.getDate();
    const month = firstDate.toLocaleDateString('en-US', { month: 'long' });

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
        const firstMonth = firstDate.toLocaleDateString('en-US', { month: 'long' });
        const lastMonth = lastDate.toLocaleDateString('en-US', { month: 'long' });
        return `${firstMonth} ${firstDay} & ${lastMonth} ${lastDay}`;
    }
}

// Функция для коротких дат в фестивалях
function formatShortDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long'
    });
}

fetch('concerts.json')
    .then(response => response.json())
    .then(data => {
        const container = document.getElementById('concerts');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let dividerInserted = false;

        function getLastDate(item) {
            if (item.type === 'festival') {
                const allDates = item.concerts.flatMap(c => c.dates);
                return new Date(allDates[allDates.length - 1]);
            }
            return new Date(item.dates[item.dates.length - 1]);
        }

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

        data.forEach((item, index) => {
            const lastDate = getLastDate(item);
            const isPast = lastDate < today;

            if (!dividerInserted && !isPast) {
                insertDivider();
            }

            if (item.type === 'festival') {
                // Блок фестиваля
                const festivalDiv = document.createElement('div');
                let festClass = 'festival-block';
                if (isPast) festClass += ' past';
                if (!dividerInserted || (index > 0 && !isPast && container.lastElementChild && container.lastElementChild.classList.contains('today-divider'))) {
                    festClass += ' no-border-top';
                }
                festivalDiv.className = festClass;

                // Генерируем список концертов фестиваля
                let concertsHTML = '';
                item.concerts.forEach(concert => {
                    const formattedDate = formatShortDate(concert.dates[0]);

                    concertsHTML += `
                        <div class="festival-concert">
                            <span class="artist">${concert.artist}</span>
                            <span class="date">${formattedDate}</span>
                        </div>
                    `;
                });

                festivalDiv.innerHTML = `
                    <a href="${item.link}" target="_blank" class="festival-link">
                        <div class="festival-header">
                            <h3>${item.name}<!-- <span class="fest-badge">FEST</span> --></h3>
                            <div class="price-wrapper">
                                <p class="price">${item.pricing}</p>
                                <img src="ticket.svg" alt="Ticket" class="ticket-icon">
                            </div>
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

                div.innerHTML = `
                    <a href="${item.link}" target="_blank" class="concert-link">
                        <div class="concert-row">
                            <h3>${item.artist}
                                <span class="price-wrapper">
                                    <span class="price">${item.price}</span>
                                    <img src="ticket.svg" alt="Ticket" class="ticket-icon">
                                </span>
                            </h3>
                            <p>${formattedDates}</p>
                        </div>
                    </a>
                `;

                container.appendChild(div);
            }
        });
    })
    .catch(error => console.error('Ошибка загрузки данных:', error));
