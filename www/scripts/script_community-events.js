// ========== script_community-events.js ==========

class EventsManager {
    constructor() {
        this.currentFilter = 'upcoming';
        this.searchQuery = '';
        this.tournaments = [];
        this.calendarEvents = [];
        this.init();
    }

    async init() {
        // Проверка авторизации — только для зарегистрированных пользователей
        if (!window.authService || !window.authService.isAuthenticated()) {
            const container = document.querySelector('.events-container');
            const banner = document.querySelector('.countdown-banner');
            if (banner) banner.style.display = 'none';
            if (container) {
                container.innerHTML = `
                    <div style="text-align:center;padding:6rem 2rem;min-height:50vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                        <div style="font-size:5rem;margin-bottom:1.5rem;">🔒</div>
                        <h2 style="font-size:2rem;margin-bottom:1rem;color:white;">Доступ только для участников</h2>
                        <p style="color:#aaa;font-size:1.1rem;margin-bottom:2rem;max-width:500px;">
                            Турниры и события доступны только авторизованным пользователям.
                            Войдите или зарегистрируйтесь, чтобы получить доступ.
                        </p>
                        <div style="display:flex;gap:1rem;">
                            <button onclick="window.openLoginModal()"
                                    style="background:#4a90e2;color:white;border:none;padding:0.8rem 2rem;border-radius:8px;cursor:pointer;font-weight:bold;font-size:1rem;">
                                Войти
                            </button>
                            <button onclick="window.openRegisterModal()"
                                    style="background:transparent;color:#4a90e2;border:2px solid #4a90e2;padding:0.8rem 2rem;border-radius:8px;cursor:pointer;font-weight:bold;font-size:1rem;">
                                Зарегистрироваться
                            </button>
                        </div>
                    </div>
                `;
            }
            return;
        }

        this.loadData();
        this.startCountdown();
        this.renderTournaments();
        this.renderCalendar();
        this.setupEventListeners();
    }

    // ========== ДАННЫЕ ==========
    loadData() {
        this.tournaments = [
            {
                id: 1,
                title: 'Кубок Новых Героев',
                description: 'Еженедельный турнир для игроков любого ранга. Сразитесь за звание лучшей команды и получите ценные призы!',
                status: 'upcoming',
                date: '2026-06-15T20:00:00',
                prize: '25 000 ₽',
                format: '6v6',
                mode: 'Захват точек',
                players: 32,
                maxPlayers: 64,
                registered: 28,
                banner: '../assets/images/community/season.jpg',
                type: 'tournament',
                rules: [
                    'Формат 6v6, матчи до 2 побед',
                    'Обязательное присутствие в Discord',
                    'Запрещены читы и эксплойты',
                    'Все герои доступны для выбора'
                ],
                organizer: 'Marvel Rivals League'
            },
            {
                id: 2,
                title: 'Битва Сезона: Лето 2026',
                description: 'Главный турнир сезона с увеличенным призовым фондом. Топ-команды получат эксклюзивные скины!',
                status: 'upcoming',
                date: '2026-06-28T18:00:00',
                prize: '100 000 ₽',
                format: '6v6',
                mode: 'Смешанный',
                players: 128,
                maxPlayers: 128,
                registered: 97,
                banner: '../assets/images/community/doom.jpg',
                type: 'tournament',
                rules: [
                    'Формат 6v6, групповая стадия + плей-офф',
                    'Обязательная регистрация команды',
                    'Матчи проходят по выходным',
                    'Стримы всех матчей на Twitch'
                ],
                organizer: 'Marvel Rivals League'
            },
            {
                id: 3,
                title: 'Дуэль Героев 1v1',
                description: 'Покажите своё мастерство в индивидуальном турнире. Лучший игрок получит титул "Чемпион Арены"!',
                status: 'ongoing',
                date: '2026-06-01T19:00:00',
                prize: '15 000 ₽',
                format: '1v1',
                mode: 'Арена',
                players: 16,
                maxPlayers: 32,
                registered: 32,
                banner: '../assets/images/community/asgard.jpg',
                type: 'tournament',
                rules: [
                    'Формат 1v1, матчи до 3 побед',
                    'Запрещены повторяющиеся герои',
                    'Раунд длится 5 минут',
                    'Победитель определяется по очкам'
                ],
                organizer: 'Community Team'
            },
            {
                id: 4,
                title: 'Ночной Турнир',
                description: 'Вечерний турнир для ночных сов. Уютная атмосфера, приятные призы и море фана!',
                status: 'past',
                date: '2026-05-20T23:00:00',
                prize: '10 000 ₽',
                format: '3v3',
                mode: 'Захват флага',
                players: 24,
                maxPlayers: 24,
                registered: 24,
                banner: '../assets/images/community/season.jpg',
                type: 'tournament',
                rules: [
                    'Формат 3v3',
                    'Ограничение по времени — 15 минут',
                    'Победа по захвату флага или по очкам'
                ],
                organizer: 'Community Team'
            },
            {
                id: 5,
                title: 'Кубок Дружбы',
                description: 'Турнир для дружеских команд. Отличная возможность попробовать свои силы в соревновательной игре!',
                status: 'past',
                date: '2026-05-10T17:00:00',
                prize: '5 000 ₽',
                format: '6v6',
                mode: 'Эскорт',
                players: 40,
                maxPlayers: 40,
                registered: 40,
                banner: '../assets/images/community/asgard.jpg',
                type: 'tournament',
                rules: [
                    'Формат 6v6',
                    'Дружеские матчи без строгих правил',
                    'Приз за участие — всем!'
                ],
                organizer: 'Marvel Rivals League'
            },
            {
                id: 6,
                title: 'Стрим с Разработчиками',
                description: 'Прямой эфир с командой разработчиков Marvel Rivals. Обсуждение нового сезона, ответы на вопросы и розыгрыш призов!',
                status: 'upcoming',
                date: '2026-06-10T19:00:00',
                prize: 'Эксклюзивные скины',
                format: 'Прямой эфир',
                mode: 'Q&A',
                players: 0,
                maxPlayers: 0,
                registered: 0,
                banner: '../assets/images/community/doom.jpg',
                type: 'stream',
                rules: [
                    'Стрим на Twitch и YouTube',
                    'Чат-вопросы принимаются заранее',
                    'Розыгрыш среди зрителей'
                ],
                organizer: 'NetEase Games'
            }
        ];

        this.calendarEvents = [
            {
                day: 1,
                month: 'Июн',
                title: 'Дуэль Героев 1v1',
                desc: 'Финал турнира',
                time: '19:00 МСК',
                type: 'tournament'
            },
            {
                day: 10,
                month: 'Июн',
                title: 'Стрим с Разработчиками',
                desc: 'Прямой эфир, Q&A, розыгрыш',
                time: '19:00 МСК',
                type: 'stream'
            },
            {
                day: 15,
                month: 'Июн',
                title: 'Кубок Новых Героев',
                desc: 'Старт регистрации',
                time: '20:00 МСК',
                type: 'tournament'
            },
            {
                day: 20,
                month: 'Июн',
                title: 'Встреча Кланов',
                desc: 'Обсуждение стратегий',
                time: '18:00 МСК',
                type: 'meetup'
            },
            {
                day: 22,
                month: 'Июн',
                title: 'Турнир "Ночной Дозор"',
                desc: 'Ночной турнир 3v3',
                time: '23:00 МСК',
                type: 'tournament'
            },
            {
                day: 28,
                month: 'Июн',
                title: 'Битва Сезона: Лето 2026',
                desc: 'Главный турнир сезона',
                time: '18:00 МСК',
                type: 'tournament'
            }
        ];
    }

    // ========== ТАЙМЕР ОБРАТНОГО ОТСЧЁТА ==========
    startCountdown() {
        const targetDate = new Date('2026-06-15T20:00:00').getTime();

        const updateTimer = () => {
            const now = new Date().getTime();
            const diff = targetDate - now;

            if (diff <= 0) {
                document.getElementById('timerDays').textContent = '00';
                document.getElementById('timerHours').textContent = '00';
                document.getElementById('timerMinutes').textContent = '00';
                document.getElementById('timerSeconds').textContent = '00';
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            document.getElementById('timerDays').textContent = String(days).padStart(2, '0');
            document.getElementById('timerHours').textContent = String(hours).padStart(2, '0');
            document.getElementById('timerMinutes').textContent = String(minutes).padStart(2, '0');
            document.getElementById('timerSeconds').textContent = String(seconds).padStart(2, '0');
        };

        updateTimer();
        setInterval(updateTimer, 1000);
    }

    // ========== РЕНДЕР ТУРНИРОВ ==========
    renderTournaments() {
        const grid = document.getElementById('tournamentsGrid');
        if (!grid) return;

        let filtered = this.tournaments;

        // Фильтр по статусу
        if (this.currentFilter === 'upcoming') {
            filtered = filtered.filter(t => t.status !== 'past');
        } else {
            filtered = filtered.filter(t => t.status === 'past');
        }

        // Поиск
        if (this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(t =>
                t.title.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                t.organizer.toLowerCase().includes(q)
            );
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="no-tournaments">
                    <h3>${this.currentFilter === 'upcoming' ? 'Нет активных турниров' : 'Нет завершённых турниров'}</h3>
                    <p>${this.searchQuery ? 'Попробуйте изменить поисковый запрос' : 'Загляните позже — новые турниры появляются регулярно'}</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(t => this.createTournamentCard(t)).join('');
    }

    createTournamentCard(t) {
        const statusText = t.status === 'upcoming' ? 'Скоро' : t.status === 'ongoing' ? 'Идёт' : 'Завершён';
        const statusClass = t.status === 'upcoming' ? 'upcoming' : t.status === 'ongoing' ? 'ongoing' : 'finished';
        const isPast = t.status === 'past';

        const playersText = t.maxPlayers > 0
            ? `${t.registered}/${t.maxPlayers}`
            : '—';

        const playerAvatars = t.registered > 0
            ? `<div class="players-avatars">
                ${t.registered >= 3 ? '<span>👤</span><span>👤</span><span>+'+ (t.registered - 2) +'</span>' : '<span>👤</span>'.repeat(t.registered)}
               </div>`
            : '';

        return `
            <div class="tournament-card ${isPast ? 'past' : ''}" onclick="eventsManager.showTournamentDetail(${t.id})">
                <div class="tournament-card-banner">
                    <div class="banner-bg" style="background-image: url('${t.banner}'); background-size: cover; background-position: center;">
                        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:4rem;opacity:0.15;">
                            ${t.type === 'stream' ? '🎙️' : '🏆'}
                        </div>
                    </div>
                    <div class="banner-overlay"></div>
                    <span class="tournament-status ${statusClass}">${statusText}</span>
                </div>
                <div class="tournament-card-body">
                    <h3>${this.escapeHtml(t.title)}</h3>
                    <p>${this.escapeHtml(t.description)}</p>
                    <div class="tournament-meta">
                        <span class="tournament-meta-item">
                            <span class="meta-icon">📅</span>
                            ${this.formatDate(t.date)}
                        </span>
                        <span class="tournament-meta-item">
                            <span class="meta-icon">🏅</span>
                            <span class="meta-highlight">${t.prize}</span>
                        </span>
                        <span class="tournament-meta-item">
                            <span class="meta-icon">🎮</span>
                            ${t.format}
                        </span>
                        <span class="tournament-meta-item">
                            <span class="meta-icon">👥</span>
                            ${playersText}
                        </span>
                    </div>
                    <div class="tournament-card-footer">
                        <div class="tournament-players">
                            ${playerAvatars}
                            ${t.registered > 0 ? `<span>${t.registered} участников</span>` : '<span>Регистрация открыта</span>'}
                        </div>
                        <button class="tournament-details-btn">Подробнее</button>
                    </div>
                </div>
            </div>
        `;
    }

    // ========== РЕНДЕР КАЛЕНДАРЯ ==========
    renderCalendar() {
        const list = document.getElementById('calendarList');
        if (!list) return;

        list.innerHTML = this.calendarEvents.map(e => `
            <div class="calendar-event-item">
                <div class="calendar-event-date">
                    <div class="calendar-event-day">${e.day}</div>
                    <div class="calendar-event-month">${e.month}</div>
                </div>
                <div class="calendar-event-info">
                    <div class="calendar-event-title">${this.escapeHtml(e.title)}</div>
                    <div class="calendar-event-desc">${this.escapeHtml(e.desc)}</div>
                </div>
                <div class="calendar-event-meta">
                    <span>🕐 ${e.time}</span>
                    <span class="calendar-event-type ${e.type}">${e.type === 'tournament' ? 'Турнир' : e.type === 'stream' ? 'Стрим' : 'Встреча'}</span>
                </div>
            </div>
        `).join('');
    }

    // ========== ДЕТАЛЬНАЯ ИНФОРМАЦИЯ ==========
    showTournamentDetail(id) {
        const t = this.tournaments.find(t => t.id === id);
        if (!t) return;

        const modal = document.getElementById('tournamentModal');
        const content = document.getElementById('tournamentModalContent');
        if (!modal || !content) return;

        const statusText = t.status === 'upcoming' ? 'Скоро' : t.status === 'ongoing' ? 'Идёт' : 'Завершён';

        content.innerHTML = `
            <div class="tournament-modal-header">
                <div class="tournament-modal-icon">${t.type === 'stream' ? '🎙️' : '🏆'}</div>
                <div class="tournament-modal-title">
                    <h2>${this.escapeHtml(t.title)}</h2>
                    <p>Организатор: ${this.escapeHtml(t.organizer)} • Статус: ${statusText}</p>
                </div>
            </div>
            <div class="tournament-modal-body">
                <p>${this.escapeHtml(t.description)}</p>

                <div class="tournament-modal-prize">
                    <div class="prize-amount">${t.prize}</div>
                    <div class="prize-label">Призовой фонд</div>
                </div>

                <h3>📋 Информация о турнире</h3>
                <ul>
                    <li><strong>Дата:</strong> ${this.formatDate(t.date)}</li>
                    <li><strong>Формат:</strong> ${t.format}</li>
                    <li><strong>Режим:</strong> ${t.mode}</li>
                    <li><strong>Участников:</strong> ${t.registered}${t.maxPlayers > 0 ? ' / ' + t.maxPlayers : ''}</li>
                </ul>

                <h3>📜 Правила</h3>
                <ul>
                    ${t.rules.map(r => `<li>${this.escapeHtml(r)}</li>`).join('')}
                </ul>
            </div>
            <div class="tournament-modal-footer">
                ${t.status !== 'past' ? '<button class="modal-register-btn" onclick="eventsManager.registerForTournament(' + t.id + ')">Зарегистрироваться</button>' : ''}
                <button class="modal-back-btn" onclick="eventsManager.closeTournamentModal()">Закрыть</button>
            </div>
        `;

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeTournamentModal() {
        const modal = document.getElementById('tournamentModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    registerForTournament(id) {
        const t = this.tournaments.find(t => t.id === id);
        if (!t) return;

        if (!window.authService || !window.authService.isAuthenticated()) {
            if (window.openLoginModal) window.openLoginModal();
            return;
        }

        if (window.showNotification) {
            window.showNotification(`Вы зарегистрированы на "${t.title}"!`, 'success');
        }
        this.closeTournamentModal();
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== ОБРАБОТЧИКИ ==========
    setupEventListeners() {
        // Фильтры
        document.querySelectorAll('.events-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.events-filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderTournaments();
            });
        });

        // Поиск
        const searchInput = document.getElementById('eventsSearch');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchQuery = e.target.value;
                    this.renderTournaments();
                }, 300);
            });
        }

        // Закрытие модального окна
        const modal = document.getElementById('tournamentModal');
        const closeBtn = document.getElementById('closeTournamentModalBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeTournamentModal());
        }
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeTournamentModal();
            });
        }

        // Закрытие по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeTournamentModal();
        });
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('mainHeader');
    if (header) {
        window.addEventListener('scroll', () => {
            header.classList.toggle('scrolled', window.scrollY > 50);
        });
    }

    window.eventsManager = new EventsManager();
});