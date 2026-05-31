// ========== script_community.js ==========

class CommunityManager {
    constructor() {
        this.currentUser = null;
        this.posts = [];
        const apiUrl = window.apiBaseUrl || 'http://marvel-rivals-new.com:3001/api';
        this.apiBase = `${apiUrl}/community`;
        this.currentFilter = 'all';
        this.currentSort = 'newest';
        this.currentPostId = null;
        this.init();
    }

    async init() {
        this.checkAuth();
        await this.loadPosts();
        this.setupEventListeners();
        this.updateUserInterface();
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

    getAuthHeaders() {
        const token = localStorage.getItem('marvelToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    }

    async loadPosts(filter = 'all', sort = 'newest') {
        this.currentFilter = filter;
        this.currentSort = sort;
        
        const sortSelect = document.getElementById('sortPosts');
        if (sortSelect) sortSelect.value = sort;
        
        const postsContainer = document.getElementById('postsContainer');
        if (postsContainer) {
            postsContainer.innerHTML = '<div class="loading-posts">Загрузка постов...</div>';
        }
        
        try {
            const response = await fetch(`${this.apiBase}/posts?filter=${encodeURIComponent(filter)}&sort=${encodeURIComponent(sort)}`, {
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            if (data.status === 'success' && Array.isArray(data.data) && data.data.length > 0) {
                this.posts = data.data.map(post => ({
                    id: post.id,
                    username: post.username || 'Пользователь',
                    title: post.title,
                    content: post.content,
                    topic: post.topic || 'Обсуждение',
                    likes: post.likes || 0,
                    comments: post.comments || 0,
                    views: post.views || 0,
                    created_at: post.created_at
                }));
                
                this.renderPosts();
                if (this.currentUser && this.posts.length > 0) this.loadLikeStatuses();
            } else {
                if (postsContainer) {
                    postsContainer.innerHTML = `
                        <div class="no-posts">
                            <h3>Пока нет постов</h3>
                            <p>Будьте первым, кто поделится своим мнением!</p>
                            ${this.currentUser ? 
                                '<button class="create-first-post" onclick="communityManager.focusPostInput()">Создать пост</button>' : 
                                '<p><a href="#" onclick="window.openLoginModal()">Войдите</a> чтобы создать пост</p>'
                            }
                        </div>
                    `;
                }
            }
        } catch (error) {
            if (postsContainer) {
                postsContainer.innerHTML = `
                    <div class="no-posts">
                        <h3>Ошибка загрузки</h3>
                        <p>Не удалось загрузить посты. Попробуйте позже.</p>
                        <button onclick="location.reload()">Обновить</button>
                    </div>
                `;
            }
        }
    }

    renderPosts() {
        const postsContainer = document.getElementById('postsContainer');
        if (!postsContainer) return;
        
        if (this.posts.length === 0) {
            postsContainer.innerHTML = `
                <div class="no-posts">
                    <h3>Пока нет постов</h3>
                    <p>Будьте первым, кто поделится своим мнением!</p>
                    ${this.currentUser ? 
                        '<button class="create-first-post" onclick="communityManager.focusPostInput()">Создать пост</button>' : 
                        '<p><a href="#" onclick="window.openLoginModal()">Войдите</a> чтобы создать пост</p>'
                    }
                </div>
            `;
            return;
        }
        
        const isAdmin = this.currentUser && this.currentUser.is_admin;
        
        postsContainer.innerHTML = this.posts.map(post => `
            <div class="post-card" data-post-id="${post.id}">
                <div class="post-header">
                    <div class="post-author">
                        <img src="${this.getUserAvatar(post.username)}"
                             alt="${post.username}"
                             class="author-avatar"
                             onerror="this.src='icons/avatar-default.jpg'">
                        <div class="author-info">
                            <h4>${post.username}</h4>
                            <span class="post-time">${this.formatTime(post.created_at)}</span>
                        </div>
                    </div>
                    <div class="post-header-actions">
                        <span class="post-topic ${post.topic.toLowerCase()}">${post.topic}</span>
                        ${isAdmin ? `
                            <button class="post-delete-btn" onclick="event.stopPropagation(); communityManager.deletePost(${post.id})" title="Удалить пост">
                                🗑️
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                <div class="post-content" onclick="communityManager.showPostDetail(${post.id})">
                    <h3>${this.escapeHtml(post.title)}</h3>
                    <p>${post.content.length > 150 ? this.escapeHtml(post.content.substring(0, 150)) + '...' : this.escapeHtml(post.content)}</p>
                    <span class="read-more">Читать далее →</span>
                </div>
                
                <div class="post-stats">
                    <div class="post-stat like-btn" data-post-id="${post.id}" onclick="communityManager.toggleLike(${post.id}, this)">
                        <span class="like-icon">👍</span>
                        <span class="like-count">${post.likes}</span>
                    </div>
                    <div class="post-stat" onclick="communityManager.showPostDetail(${post.id})">
                        <span>💬</span>
                        <span>${post.comments}</span>
                    </div>
                    <div class="post-stat">
                        <span>👁️</span>
                        <span>${post.views}</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        if (this.currentUser) this.loadLikeStatuses();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async loadLikeStatuses() {
        if (!this.currentUser) return;
        
        for (const post of this.posts) {
            try {
                const response = await fetch(`${this.apiBase}/posts/${post.id}/like-status`, {
                    headers: this.getAuthHeaders()
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'success' && data.data.liked) {
                        const likeBtn = document.querySelector(`.like-btn[data-post-id="${post.id}"]`);
                        if (likeBtn) likeBtn.classList.add('liked');
                    }
                }
            } catch (error) {}
        }
    }

    async toggleLike(postId, element) {
        if (!this.currentUser) {
            if (window.openLoginModal) window.openLoginModal();
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/posts/${postId}/like`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) throw new Error();
            
            const data = await response.json();
            
            if (data.status === 'success') {
                element.classList.toggle('liked');
                const likeCount = element.querySelector('.like-count');
                if (likeCount) likeCount.textContent = data.data.likes;
            }
        } catch (error) {}
    }

    async createNewPost() {
        if (!this.currentUser) {
            if (window.openLoginModal) window.openLoginModal();
            return;
        }

        const postContent = document.getElementById('postContent');
        if (!postContent || !postContent.value.trim()) return;

        const activeTag = document.querySelector('.tag-topic.active');
        const topic = activeTag ? activeTag.textContent : 'Обсуждение';
        const title = postContent.value.substring(0, 50) + (postContent.value.length > 50 ? '...' : '');

        try {
            const response = await fetch(`${this.apiBase}/posts`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    title: title,
                    content: postContent.value,
                    topic: topic
                })
            });
            
            if (!response.ok) throw new Error();
            
            const data = await response.json();
            
            if (data.status === 'success') {
                postContent.value = '';
                const submitBtn = document.getElementById('submitPostBtn');
                if (submitBtn) submitBtn.disabled = true;
                
                document.querySelectorAll('.tag-topic.active').forEach(tag => {
                    tag.classList.remove('active');
                });
                
                await this.loadPosts(this.currentFilter, this.currentSort);
            }
        } catch (error) {}
    }

    async showPostDetail(postId) {
        try {
            const postResponse = await fetch(`${this.apiBase}/posts/${postId}`);
            const postData = await postResponse.json();
            
            if (postData.status !== 'success') throw new Error();
            
            const post = postData.data;
            const commentsResponse = await fetch(`${this.apiBase}/posts/${postId}/comments`);
            const commentsData = await commentsResponse.json();
            const comments = commentsData.status === 'success' ? commentsData.data : [];
            
            this.createPostModal(post, comments);
        } catch (error) {}
    }

    createPostModal(post, comments) {
        const existingModal = document.getElementById('postDetailModal');
        if (existingModal) existingModal.remove();
        
        document.body.classList.add('modal-open');
        
        const isAdmin = this.currentUser && this.currentUser.is_admin;
        
        const modal = document.createElement('div');
        modal.id = 'postDetailModal';
        modal.className = 'post-modal-overlay';
        
        modal.innerHTML = `
            <div class="post-detail-modal">
                <button class="close-modal-btn">&times;</button>
                <div class="post-modal-content">
                    <div class="post-modal-header">
                        <div class="post-modal-author">
                            <img src="${this.getUserAvatar(post.username)}"
                                 alt="${post.username}"
                                 class="post-modal-author-avatar"
                                 onerror="this.src='icons/avatar-default.jpg'">
                            <div class="post-modal-author-info">
                                <h3>${this.escapeHtml(post.username)}</h3>
                                <div class="post-modal-meta">
                                    <span>${this.formatTime(post.created_at)}</span>
                                    <span>•</span>
                                    <span class="post-modal-topic">${post.topic}</span>
                                </div>
                            </div>
                        </div>
                        ${isAdmin ? `
                            <button class="post-modal-delete-btn" onclick="communityManager.deletePost(${post.id})" title="Удалить пост">
                                🗑️ Удалить пост
                            </button>
                        ` : ''}
                    </div>
                    
                    <div class="post-modal-body">
                        <h2 class="post-modal-title">${this.escapeHtml(post.title)}</h2>
                        <div class="post-modal-text">${this.escapeHtml(post.content)}</div>
                        
                        <div class="post-modal-stats">
                            <div class="post-modal-stat">
                                <span class="post-modal-stat-icon">👍</span>
                                <span class="post-modal-stat-value">${post.likes}</span>
                                <span class="post-modal-stat-label">Нравится</span>
                            </div>
                            <div class="post-modal-stat">
                                <span class="post-modal-stat-icon">💬</span>
                                <span class="post-modal-stat-value">${post.comments}</span>
                                <span class="post-modal-stat-label">Комментарии</span>
                            </div>
                            <div class="post-modal-stat">
                                <span class="post-modal-stat-icon">👁️</span>
                                <span class="post-modal-stat-value">${post.views}</span>
                                <span class="post-modal-stat-label">Просмотры</span>
                            </div>
                        </div>
                        
                        <div class="post-modal-comments">
                            <h3>Комментарии (${comments.length})</h3>
                            
                            ${this.currentUser ? `
                                <div class="post-modal-comment-form">
                                    <textarea id="commentText" placeholder="Напишите комментарий..." rows="3"></textarea>
                                    <button onclick="communityManager.addComment(${post.id})">Отправить комментарий</button>
                                </div>
                            ` : `
                                <div class="post-modal-login-prompt">
                                    <p>Войдите в аккаунт чтобы оставлять комментарии</p>
                                    <button onclick="window.openLoginModal()">Войти</button>
                                </div>
                            `}
                            
                            <div class="post-modal-comments-list">
                                ${comments.length > 0 ? 
                                    comments.map(comment => `
                                        <div class="post-modal-comment">
                                            <div class="post-modal-comment-header">
                                                <div class="post-modal-comment-author">
                                                    <img src="${this.getUserAvatar(comment.username)}" 
                                                         alt="${comment.username}"
                                                         class="post-modal-comment-author-avatar"
                                                         onerror="this.src='icons/avatar-default.jpg'">
                                                    <span>${this.escapeHtml(comment.username)}</span>
                                                </div>
                                                <div class="post-modal-comment-time">${this.formatTime(comment.created_at)}</div>
                                            </div>
                                            <div class="post-modal-comment-text">${this.escapeHtml(comment.content)}</div>
                                        </div>
                                    `).join('') : 
                                    '<div class="post-modal-no-comments">Пока нет комментариев. Будьте первым!</div>'
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeBtn = modal.querySelector('.close-modal-btn');
        const closeModal = () => {
            modal.remove();
            document.body.classList.remove('modal-open');
            document.removeEventListener('keydown', handleEsc);
        };
        
        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
        
        const handleEsc = (e) => { if (e.key === 'Escape') closeModal(); };
        document.addEventListener('keydown', handleEsc);
        modal._escHandler = handleEsc;
    }

    async addComment(postId) {
        if (!this.currentUser) return;

        const commentText = document.getElementById('commentText');
        if (!commentText || !commentText.value.trim()) return;

        try {
            const response = await fetch(`${this.apiBase}/comments`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    post_id: postId,
                    content: commentText.value
                })
            });
            
            if (!response.ok) throw new Error();
            
            const data = await response.json();
            
            if (data.status === 'success') {
                commentText.value = '';
                await this.showPostDetail(postId);
            }
        } catch (error) {}
    }

    async deletePost(postId) {
        if (!this.currentUser || !this.currentUser.is_admin) {
            if (window.showNotification) {
                window.showNotification('Доступ запрещен', 'error');
            }
            return;
        }
        
        if (!confirm('Вы уверены, что хотите удалить этот пост? Это действие нельзя отменить.')) {
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/posts/${postId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.status === 'success') {
                // Закрываем модальное окно если открыто
                const modal = document.getElementById('postDetailModal');
                if (modal) {
                    modal.remove();
                    document.body.classList.remove('modal-open');
                }
                
                if (window.showNotification) {
                    window.showNotification('Пост успешно удален', 'success');
                }
                
                // Перезагружаем посты
                await this.loadPosts(this.currentFilter, this.currentSort);
            } else {
                throw new Error(data.message || 'Ошибка удаления поста');
            }
        } catch (error) {
            console.error('❌ Ошибка удаления поста:', error);
            if (window.showNotification) {
                window.showNotification('Ошибка при удалении поста: ' + error.message, 'error');
            } else {
                alert('Ошибка при удалении поста: ' + error.message);
            }
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Только что';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    getUserAvatar(username) {
        const avatarMap = {
            'n1s4': 'icons/avatar-default.jpg',
            'n1sp1x': 'icons/avatar-default.jpg',
            'testuser': 'icons/avatar-user3.jpg',
            'admin': 'icons/avatar-user2.jpg',
            'lol': 'icons/avatar-user1.jpg',
        };
        return avatarMap[username] || 'icons/avatar-default.jpg';
    }

    setupEventListeners() {
        const submitBtn = document.getElementById('submitPostBtn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.createNewPost());
            submitBtn.disabled = true;
        }
        
        const postContent = document.getElementById('postContent');
        if (postContent) {
            postContent.addEventListener('input', () => {
                const btn = document.getElementById('submitPostBtn');
                if (btn) btn.disabled = !postContent.value.trim();
            });
            
            postContent.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') this.createNewPost();
            });
        }
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.loadPosts(filter, this.currentSort);
            });
        });
        
        document.querySelectorAll('.tag-topic').forEach(tag => {
            tag.addEventListener('click', (e) => {
                document.querySelectorAll('.tag-topic').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
        
        const sortSelect = document.getElementById('sortPosts');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.loadPosts(this.currentFilter, this.currentSort);
            });
            sortSelect.value = this.currentSort;
        }
    }
    
    updateUserInterface() {
        const currentUserName = document.getElementById('currentUserName');
        if (currentUserName && this.currentUser) {
            currentUserName.textContent = this.currentUser.username;
        }
        
        const userAvatar = document.getElementById('userAvatar');
        if (userAvatar && this.currentUser) {
            userAvatar.src = this.getUserAvatar(this.currentUser.username);
            userAvatar.onerror = function() { this.src = 'icons/avatar-default.jpg'; };
        }
        
        const postForm = document.querySelector('.create-post-form');
        const guestMessage = document.querySelector('.guest-message');
        
        if (postForm && guestMessage) {
            if (this.currentUser) {
                postForm.style.display = 'block';
                guestMessage.style.display = 'none';
            } else {
                postForm.style.display = 'none';
                guestMessage.style.display = 'block';
            }
        }
    }

    focusPostInput() {
        const postContent = document.getElementById('postContent');
        if (postContent) postContent.focus();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('mainHeader');
    if (header) {
        window.addEventListener('scroll', () => {
            header.classList.toggle('scrolled', window.scrollY > 50);
        });
    }
    
    if (!document.querySelector('#community-styles')) {
        const style = document.createElement('style');
        style.id = 'community-styles';
        style.textContent = `
            .post-card { cursor: pointer; transition: transform 0.2s; }
            .post-card:hover { transform: translateY(-2px); }
            .post-stat.like-btn { cursor: pointer; }
            .post-stat.like-btn.liked .like-icon { color: #e62429; }
            .read-more { color: #4a90e2; font-weight: bold; cursor: pointer; }
            .no-posts { text-align: center; padding: 50px; color: #666; }
            .create-first-post { background: #4a90e2; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 15px; }
            .loading-posts { text-align: center; padding: 50px; color: #666; }
            .post-header-actions { display: flex; align-items: center; gap: 0.5rem; }
            .post-delete-btn { background: none; border: none; color: #ff4444; font-size: 1.1rem; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: all 0.2s; opacity: 0.6; }
            .post-delete-btn:hover { opacity: 1; background-color: rgba(255,68,68,0.15); transform: scale(1.1); }
            .post-modal-delete-btn { background-color: #e62429; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 0.9rem; transition: all 0.2s; white-space: nowrap; }
            .post-modal-delete-btn:hover { background-color: #ff4444; transform: scale(1.05); }
        `;
        document.head.appendChild(style);
    }
    
    window.communityManager = new CommunityManager();
});