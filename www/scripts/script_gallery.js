// ========== script_gallery.js ==========

class GalleryManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        this.checkAuth();
        this.setupEventListeners();
    }

    checkAuth() {
        if (window.authService) {
            this.currentUser = window.authService.getUser();
        } else {
            const savedUser = localStorage.getItem('marvelUser');
            if (savedUser) {
                try {
                    this.currentUser = JSON.parse(savedUser);
                } catch (e) {}
            }
        }
    }

    setupEventListeners() {

        // Пагинация
        document.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.pagination-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                if (window.showNotification) {
                    window.showNotification('📄 Страница ' + this.textContent.trim());
                }
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('mainHeader');
    if (header) {
        window.addEventListener('scroll', () => {
            header.classList.toggle('scrolled', window.scrollY > 50);
        });
    }

    window.galleryManager = new GalleryManager();
});