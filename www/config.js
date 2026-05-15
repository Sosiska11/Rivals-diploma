// ========== КОНФИГУРАЦИЯ API ==========
const AUTH_API_BASE_URL = (() => {
    if (window.location.hostname === 'marvel-rivals-new.com') {
        return `${window.location.protocol}//${window.location.hostname}:3001/api`;
    }
    return 'http://localhost:3001/api';
})();

// ========== AUTH SERVICE ==========
class SimpleAuthService {
    constructor() {
        this.baseURL = AUTH_API_BASE_URL;
        this.token = localStorage.getItem('marvelToken');
        this.user = null;
        setTimeout(() => this.verifyToken(), 1000);
    }

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        return headers;
    }

    async register(userData) {
        try {
            const response = await fetch(`${this.baseURL}/register`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(userData)
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error('Некорректный ответ от сервера');
            }

            if (data.status === 'success') {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('marvelToken', data.token);
                localStorage.setItem('marvelUser', JSON.stringify(data.user));
                this.updateAuthUI();
                return data;
            } else {
                throw new Error(data.message || 'Ошибка регистрации');
            }
        } catch (error) {
            throw error;
        }
    }

    async login(credentials) {
        try {
            const response = await fetch(`${this.baseURL}/login`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(credentials)
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error('Некорректный ответ от сервера');
            }

            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }

            if (data.status === 'success') {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('marvelToken', data.token);
                localStorage.setItem('marvelUser', JSON.stringify(data.user));
                this.updateAuthUI();
                
                if (window.favoritesManager) {
                    await window.favoritesManager.loadFavoritesFromDB();
                }
                return data;
            } else {
                throw new Error(data.message || 'Ошибка входа');
            }
        } catch (error) {
            throw error;
        }
    }

    async verifyToken() {
        if (!this.token) return false;

        try {
            const response = await fetch(`${this.baseURL}/verify-token`, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                this.logout();
                return false;
            }

            let data;
            try {
                data = await response.json();
            } catch (e) {
                this.logout();
                return false;
            }
            
            if (data.status === 'success') {
                this.user = data.user;
                localStorage.setItem('marvelUser', JSON.stringify(data.user));
                this.updateAuthUI();
                
                if (window.favoritesManager) {
                    await window.favoritesManager.loadFavoritesFromDB();
                }
                return true;
            } else {
                this.logout();
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('marvelToken');
        localStorage.removeItem('marvelUser');
        
        if (window.favoritesManager) {
            window.favoritesManager.clearFavorites();
        }
        
        this.updateAuthUI();
        setTimeout(() => window.location.reload(), 500);
    }

    getUser() {
        if (!this.user) {
            const savedUser = localStorage.getItem('marvelUser');
            if (savedUser) {
                try {
                    this.user = JSON.parse(savedUser);
                } catch(e) {
                    localStorage.removeItem('marvelUser');
                }
            }
        }
        return this.user;
    }

    isAuthenticated() {
        const token = this.token || localStorage.getItem('marvelToken');
        const user = this.getUser();
        return !!token && !!user;
    }

    updateAuthUI() {
        const loginBtn = document.getElementById('openLoginBtn');
        const registerBtn = document.getElementById('openModalBtn');
        
        if (!loginBtn) return;
        
        const user = this.getUser();
        
        if (user) {
            loginBtn.innerHTML = `👤 ${user.username}`;
            loginBtn.onclick = () => {
                if (confirm(`Выйти из аккаунта ${user.username}?`)) {
                    this.logout();
                }
            };
            loginBtn.title = 'Выйти из аккаунта';
            
            if (registerBtn) registerBtn.style.display = 'none';
        } else {
            loginBtn.innerHTML = 'Войти';
            loginBtn.onclick = () => {
                if (typeof window.openLoginModal === 'function') {
                    window.openLoginModal();
                }
            };
            loginBtn.title = 'Войти в аккаунт';
            
            if (registerBtn) registerBtn.style.display = 'block';
        }
    }
}

// ========== FAVORITES MANAGER ==========
class FavoritesManager {
    constructor() {
        this.baseURL = AUTH_API_BASE_URL;
        this.favorites = new Set();
    }

    isUserAuthenticated() {
        return window.authService && window.authService.isAuthenticated();
    }

    getUserToken() {
        return window.authService?.token || localStorage.getItem('marvelToken');
    }

    async loadFavoritesFromDB() {
        if (!this.isUserAuthenticated()) {
            this.favorites.clear();
            this.updateUI();
            return;
        }

        try {
            const token = this.getUserToken();
            if (!token) {
                this.favorites.clear();
                this.updateUI();
                return;
            }
            
            const response = await fetch(`${this.baseURL}/favorites`, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                this.favorites.clear();
                this.updateUI();
                return;
            }

            const data = await response.json();
            
            if (data.status === 'success' && data.data && data.data.favorites) {
                this.favorites = new Set(data.data.favorites.map(f => f.hero_id || f.id));
            } else {
                this.favorites.clear();
            }
            
            this.updateUI();
        } catch (error) {
            this.favorites.clear();
            this.updateUI();
        }
    }

    async toggleFavorite(heroId, button) {
        if (!this.isUserAuthenticated()) {
            this.showNotification('Войдите в аккаунт чтобы добавлять в избранное');
            const loginBtn = document.getElementById('openLoginBtn');
            if (loginBtn) loginBtn.click();
            return;
        }

        const dbHeroId = this.getHeroDbIdFromName(heroId);
        const token = this.getUserToken();
        
        if (!token) {
            this.showNotification('Ошибка авторизации');
            return;
        }

        if (button) {
            button.disabled = true;
            button.style.opacity = '0.5';
        }

        try {
            const response = await fetch(`${this.baseURL}/favorites/${dbHeroId}`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }

            if (data.status === 'success') {
                if (data.data.action === 'added') {
                    this.favorites.add(dbHeroId);
                    if (button) button.classList.add('active');
                    this.showNotification('Добавлено в избранное');
                } else {
                    this.favorites.delete(dbHeroId);
                    if (button) button.classList.remove('active');
                    this.showNotification('Удалено из избранного');
                }
                
                this.updateFavoritesCount();
            } else {
                throw new Error(data.message || 'Ошибка сервера');
            }
        } catch (error) {
            this.showNotification('Ошибка: ' + error.message);
        } finally {
            if (button) {
                button.disabled = false;
                button.style.opacity = '1';
            }
        }
    }

    getHeroDbIdFromName(heroName) {
        const heroMap = {
            'ironman': 1, 'spiderman': 2, 'black': 3, 'magik': 4, 'loki': 5,
            'rocket': 6, 'thor': 7, 'ironfist': 8, 'venom': 9, 'mantis': 10,
            'wolverine': 11, 'baki': 12, 'girl': 13, 'peni': 14, 'groot': 15,
            'luna': 16, 'hulk': 17, 'hela': 18, 'hawkeye': 19, 'jeff': 20,
            'storm': 21, 'magneto': 22, 'starlord': 23, 'thing': 24, 'scarlet': 25,
            'namor': 26, 'psylocke': 27, 'cloakdagger': 28, 'torch': 29, 'fantastic': 30,
            'moonknight': 31, 'adam': 32, 'strange': 33, 'invisible': 34, 'punisher': 35,
            'captainamerica': 36, 'blackwidow': 37
        };
        return heroMap[heroName] || 1;
    }

    showNotification(message) {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message);
            return;
        }
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4a90e2;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-family: "Anonymous Pro", monospace;
            font-size: 14px;
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    updateFavoriteButtons() {
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            const card = btn.closest('.hero-card');
            if (!card) return;
            
            const heroId = card.getAttribute('data-hero');
            const heroDbId = this.getHeroDbIdFromName(heroId);
            
            if (this.favorites.has(heroDbId)) {
                btn.classList.add('active');
                btn.innerHTML = '❤️';
                btn.title = 'Убрать из избранного';
            } else {
                btn.classList.remove('active');
                btn.innerHTML = '🤍';
                btn.title = 'Добавить в избранное';
            }
            
            if (!this.isUserAuthenticated()) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.title = 'Войдите чтобы добавить в избранное';
            } else {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        });
    }

    updateFavoritesCount() {
        const favBtn = document.querySelector('[data-filter="favorites"]');
        if (!favBtn) return;
        
        const oldCounter = favBtn.querySelector('.favorites-count');
        if (oldCounter) oldCounter.remove();
        
        if (this.favorites.size > 0) {
            const counter = document.createElement('span');
            counter.className = 'favorites-count';
            counter.textContent = this.favorites.size;
            favBtn.appendChild(counter);
        }
    }

    updateUI() {
        this.updateFavoriteButtons();
        this.updateFavoritesCount();
    }

    clearFavorites() {
        this.favorites.clear();
        this.updateUI();
    }

    addFavoriteButtons() {
        const heroCards = document.querySelectorAll('.hero-card');
        heroCards.forEach(card => {
            if (card.querySelector('.favorite-btn')) return;

            const favoriteBtn = document.createElement('button');
            favoriteBtn.className = 'favorite-btn';
            favoriteBtn.innerHTML = '🤍';
            favoriteBtn.title = 'Добавить в избранное';
            
            favoriteBtn.onclick = (e) => {
                e.stopPropagation();
                const heroId = card.getAttribute('data-hero');
                this.toggleFavorite(heroId, favoriteBtn);
            };
            
            card.style.position = 'relative';
            card.appendChild(favoriteBtn);
        });
        
        this.updateFavoriteButtons();
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4a90e2;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-family: "Anonymous Pro", monospace;
        font-size: 14px;
        animation: slideIn 0.3s ease-out;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function openLoginModal() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
        
        const loginError = document.getElementById('loginError');
        const registerError = document.getElementById('registerError');
        if (loginError) loginError.textContent = '';
        if (registerError) registerError.textContent = '';
    }
}

function openRegisterModal() {
    const registerModal = document.getElementById('registerModal');
    if (registerModal) {
        registerModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'block';
        
        const loginError = document.getElementById('loginError');
        const registerError = document.getElementById('registerError');
        if (loginError) loginError.textContent = '';
        if (registerError) registerError.textContent = '';
    }
}

function closeModal(modal) {
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Добавляем CSS для анимаций
if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        .favorites-count {
            background: #e62429;
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            margin-left: 5px;
            font-weight: bold;
        }
        .favorite-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            border: none;
            color: white;
            padding: 0.5rem;
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.3s;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            z-index: 10;
        }
        .favorite-btn:hover {
            background: #e62429;
            transform: scale(1.1);
        }
        .favorite-btn.active {
            background: #e62429;
            color: gold;
        }
        .favorite-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
    `;
    document.head.appendChild(style);
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
window.authService = new SimpleAuthService();
window.favoritesManager = new FavoritesManager();

window.showNotification = showNotification;
window.openLoginModal = openLoginModal;
window.openRegisterModal = openRegisterModal;
window.closeModal = closeModal;

document.addEventListener('DOMContentLoaded', () => {
    if (window.authService) {
        window.authService.updateAuthUI();
    }
    
    if (window.favoritesManager && document.querySelector('.hero-card')) {
        window.favoritesManager.addFavoriteButtons();
        
        if (window.authService && window.authService.isAuthenticated()) {
            setTimeout(() => {
                window.favoritesManager.loadFavoritesFromDB();
            }, 1500);
        }
    }
    
    setupModalHandlers();
});

function setupModalHandlers() {
    const closeButtons = document.querySelectorAll('.close-modal, .modal-close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal') || 
                         document.getElementById('loginModal') || 
                         document.getElementById('registerModal');
            if (modal) closeModal(modal);
        });
    });
    
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) closeModal(this);
        });
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            modals.forEach(modal => {
                if (modal.style.display === 'flex') closeModal(modal);
            });
        }
    });
}