require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// ========== НАСТРОЙКА CORS ==========
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// ========== ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ ==========
const createConnection = async () => {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'marvel_rivals',
            port: process.env.DB_PORT || 3306,
            charset: 'utf8mb4',
            supportBigNumbers: true,
            bigNumberStrings: true,
            timezone: '+00:00'
        });
        
        console.log('✅ Подключение к БД установлено');
        return connection;
    } catch (error) {
        console.error('❌ Ошибка подключения к БД:', error.message);
        throw error;
    }
};

// ========== MIDDLEWARE ДЛЯ JWT ==========
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'Требуется авторизация' 
            });
        }
        
        jwt.verify(token, process.env.JWT_SECRET || 'marvel_rivals_secret_key_2025', (err, user) => {
            if (err) {
                console.error('❌ Ошибка проверки токена:', err.message);
                return res.status(403).json({ 
                    status: 'error', 
                    message: 'Неверный токен' 
                });
            }
            req.user = user;
            next();
        });
    } catch (error) {
        console.error('❌ Ошибка middleware токена:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Ошибка проверки токена'
        });
    }
};

// ========== MIDDLEWARE ДЛЯ АДМИНА ==========
const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({
            status: 'error',
            message: 'Доступ запрещен. Требуются права администратора'
        });
    }
    next();
};

// ========== ТЕСТОВЫЕ ENDPOINTS ==========
app.get('/api/test', async (req, res) => {
    try {
        const connection = await createConnection();
        const [rows] = await connection.execute('SELECT 1 + 1 AS result');
        await connection.end();
        
        res.json({ 
            status: 'success', 
            message: '✅ Сервер и БД работают отлично!'
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: 'Ошибка подключения к БД: ' + error.message
        });
    }
});

app.get('/api/db-check', async (req, res) => {
    try {
        const connection = await createConnection();
        const [tables] = await connection.execute('SHOW TABLES');
        await connection.end();
        
        res.json({
            status: 'success',
            message: '✅ База данных в порядке!',
            data: {
                tables: tables.length,
                availableTables: tables.map(t => Object.values(t)[0])
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Ошибка проверки БД: ' + error.message
        });
    }
});

// ========== РЕГИСТРАЦИЯ ==========
app.post('/api/register', async (req, res) => {
    let connection;
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Все поля обязательны'
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({
                status: 'error',
                message: 'Пароль должен быть не менее 6 символов'
            });
        }
        
        connection = await createConnection();
        
        const [existing] = await connection.execute(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Пользователь с таким именем или email уже существует'
            });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [result] = await connection.execute(
            `INSERT INTO users (username, email, password, join_date, role, is_active, newsletter) 
             VALUES (?, ?, ?, NOW(), 'user', 1, 0)`,
            [username, email, hashedPassword]
        );
        
        const token = jwt.sign(
            {
                id: result.insertId,
                username: username,
                email: email,
                role: 'user',
                is_admin: 0
            },
            process.env.JWT_SECRET || 'marvel_rivals_secret_key_2025',
            { expiresIn: '30d' }
        );
        
        res.json({
            status: 'success',
            message: '🎉 Регистрация успешна!',
            token: token,
            user: {
                id: result.insertId,
                username: username,
                email: email,
                role: 'user',
                is_admin: 0
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка регистрации:', error);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка сервера при регистрации: ' + error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});

// ========== АВТОРИЗАЦИЯ ==========
app.post('/api/login', async (req, res) => {
    let connection;
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Email и пароль обязательны'
            });
        }
        
        connection = await createConnection();
        
        const [users] = await connection.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        
        if (users.length === 0) {
            return res.status(401).json({
                status: 'error',
                message: 'Неверный email или пароль'
            });
        }
        
        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({
                status: 'error',
                message: 'Неверный email или пароль'
            });
        }
        
        await connection.execute(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );
        
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                is_admin: user.is_admin || 0
            },
            process.env.JWT_SECRET || 'marvel_rivals_secret_key_2025',
            { expiresIn: '30d' }
        );
        
        res.json({
            status: 'success',
            message: '🎮 Добро пожаловать, ' + user.username + '!',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                is_admin: user.is_admin || 0
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка авторизации:', error);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка сервера при авторизации: ' + error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});

// ========== ПРОВЕРКА ТОКЕНА ==========
app.get('/api/verify-token', authenticateToken, async (req, res) => {
    try {
        res.json({
            status: 'success',
            message: 'Токен валиден',
            user: {
                id: req.user.id,
                username: req.user.username,
                email: req.user.email,
                role: req.user.role,
                is_admin: req.user.is_admin || 0
            }
        });
    } catch (error) {
        console.error('❌ Ошибка проверки токена:', error);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка проверки токена'
        });
    }
});

// ========== ГЕРОИ ==========
app.get('/api/heroes', async (req, res) => {
    let connection;
    try {
        connection = await createConnection();
        const [rows] = await connection.execute(
            'SELECT * FROM heroes WHERE is_active = 1 ORDER BY name'
        );
        
        res.json({
            status: 'success',
            data: {
                heroes: rows
            }
        });
    } catch (error) {
        console.error('❌ Ошибка загрузки героев:', error);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка загрузки героев: ' + error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});

// ========== ИЗБРАННОЕ ==========
app.get('/api/favorites', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await createConnection();
        const [rows] = await connection.execute(
            `SELECT h.* FROM heroes h
             INNER JOIN user_favorites uf ON h.id = uf.hero_id
             WHERE uf.user_id = ? AND h.is_active = 1
             ORDER BY h.name`,
            [req.user.id]
        );
        
        res.json({
            status: 'success',
            data: {
                favorites: rows,
                count: rows.length
            }
        });
    } catch (error) {
        console.error('❌ Ошибка загрузки избранного:', error);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка загрузки избранного: ' + error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});

app.post('/api/favorites/:heroId', authenticateToken, async (req, res) => {
    let connection;
    try {
        const heroId = parseInt(req.params.heroId);
        const userId = req.user.id;
        
        if (isNaN(heroId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Неверный ID героя'
            });
        }
        
        connection = await createConnection();
        
        const [heroExists] = await connection.execute(
            'SELECT id FROM heroes WHERE id = ? AND is_active = 1',
            [heroId]
        );
        
        if (heroExists.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Герой не найден'
            });
        }
        
        const [existing] = await connection.execute(
            'SELECT id FROM user_favorites WHERE user_id = ? AND hero_id = ?',
            [userId, heroId]
        );
        
        let action = '';
        
        if (existing.length > 0) {
            await connection.execute(
                'DELETE FROM user_favorites WHERE id = ?',
                [existing[0].id]
            );
            action = 'removed';
        } else {
            await connection.execute(
                'INSERT INTO user_favorites (user_id, hero_id) VALUES (?, ?)',
                [userId, heroId]
            );
            action = 'added';
        }
        
        const [countResult] = await connection.execute(
            'SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?',
            [userId]
        );
        
        res.json({
            status: 'success',
            message: action === 'added' ? 'Добавлено в избранное' : 'Удалено из избранного',
            data: {
                action: action,
                heroId: heroId,
                favoritesCount: countResult[0].count
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка обновления избранного:', error);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка обновления избранного: ' + error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});

// ========== СООБЩЕСТВО: ПОСТЫ ==========
app.get('/api/community/posts', async (req, res) => {
    let connection;
    try {
        const { filter = 'all', sort = 'newest' } = req.query;
        
        console.log('📝 Запрос постов:', { filter, sort });
        
        connection = await createConnection();
        
        // Базовый запрос
        let sql = `
            SELECT 
                cp.id,
                cp.user_id,
                u.username,
                cp.title,
                cp.content,
                cp.topic,
                cp.likes,
                cp.comments,
                cp.views,
                cp.created_at,
                cp.updated_at
            FROM community_posts cp
            JOIN users u ON cp.user_id = u.id
            WHERE 1=1
        `;
        
        const params = [];
        
        // Фильтр по теме
        if (filter !== 'all') {
            sql += ` AND cp.topic = ?`;
            params.push(filter);
        }
        
        // Сортировка - ИСПРАВЛЕННЫЙ КОД
        switch(sort) {
            case 'newest':
                sql += ` ORDER BY cp.created_at DESC`;
                break;
            case 'popular':
                sql += ` ORDER BY cp.likes DESC, cp.views DESC, cp.comments DESC`;
                break;
            case 'comments':
                sql += ` ORDER BY cp.comments DESC, cp.likes DESC`;
                break;
            default:
                sql += ` ORDER BY cp.created_at DESC`;
        }
        
        // Лимит
        sql += ` LIMIT 100`;
        
        console.log('📊 SQL запрос:', sql);
        console.log('📊 Параметры:', params);
        
        const [rows] = await connection.execute(sql, params);
        
        console.log(`✅ Найдено постов: ${rows.length}`);
        
        // Форматируем даты
        const formattedPosts = rows.map(post => ({
            ...post,
            created_at: new Date(post.created_at).toISOString(),
            updated_at: new Date(post.updated_at).toISOString()
        }));
        
        res.json({
            status: 'success',
            message: 'Посты загружены',
            data: formattedPosts
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки постов:', error);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка загрузки постов: ' + error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});

// СОЗДАТЬ НОВЫЙ ПОСТ
app.post('/api/community/posts', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { title, content, topic = 'Обсуждение' } = req.body;
        const userId = req.user.id;
        
        console.log('✍️ Создание поста:', { userId, title: title?.substring(0, 50) });
        
        if (!title || !content) {
            return res.status(400).json({
                status: 'error',
                message: 'Заголовок и содержание обязательны'
            });
        }
        
        connection = await createConnection();
        
        const [result] = await connection.execute(
            `INSERT INTO community_posts 
             (user_id, title, content, topic, likes, comments, views, created_at, updated_at)
             VALUES (?, ?, ?, ?, 0, 0, 0, NOW(), NOW())`,
            [userId, title, content, topic]
        );
        
        // Получаем созданный пост
        const [postResult] = await connection.execute(
            `SELECT cp.*, u.username, u.email as user_email
             FROM community_posts cp
             JOIN users u ON cp.user_id = u.id
             WHERE cp.id = ?`,
            [result.insertId]
        );
        
        console.log('✅ Пост создан, ID:', result.insertId);
        
        res.json({
            status: 'success',
            message: 'Пост успешно создан!',
            data: postResult[0]
        });
        
    } catch (error) {
        console.error('❌ Ошибка создания поста:', error);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка создания поста: ' + error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});

// ПОЛУЧИТЬ ОДИН ПОСТ
app.get('/api/community/posts/:id', async (req, res) => {
    let connection;
    try {
        const postId = parseInt(req.params.id);
        connection = await createConnection();
        
        // Увеличиваем просмотры
        await connection.execute(
            'UPDATE community_posts SET views = views + 1 WHERE id = ?',
            [postId]
        );
        
        // Получаем пост
        const [postResult] = await connection.execute(
            `SELECT cp.*, u.username, u.email as user_email
             FROM community_posts cp
             JOIN users u ON cp.user_id = u.id
             WHERE cp.id = ?`,
            [postId]
        );
        
        if (postResult.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Пост не найден'
            });
        }
        
        res.json({
            status: 'success',
            message: 'Пост загружен',
            data: postResult[0]
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки поста:', error);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка загрузки поста: ' + error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});

// КОММЕНТАРИИ ПОСТА
app.get('/api/community/posts/:id/comments', async (req, res) => {
    let connection;
    try {
        const postId = parseInt(req.params.id);
        connection = await createConnection();
        
        const [comments] = await connection.execute(
            `SELECT pc.*, u.username, u.email as user_email
             FROM post_comments pc
             JOIN users u ON pc.user_id = u.id
             WHERE pc.post_id = ?
             ORDER BY pc.created_at ASC`,
            [postId]
        );
        
        res.json({
            status: 'success',
            message: 'Комментарии загружены',
            data: comments
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки комментариев:', error);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка загрузки комментариев: ' + error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});

// ДОБАВИТЬ КОММЕНТАРИЙ
app.post('/api/community/comments', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { post_id, content } = req.body;
        const userId = req.user.id;
        
        console.log('💬 Добавление комментария:', { userId, post_id });
        
        if (!post_id || !content) {
            return res.status(400).json({
                status: 'error',
                message: 'ID поста и содержание комментария обязательны'
            });
        }
        
        connection = await createConnection();
        
        // Добавляем комментарий
        const [commentResult] = await connection.execute(
            `INSERT INTO post_comments (post_id, user_id, content, created_at)
             VALUES (?, ?, ?, NOW())`,
            [post_id, userId, content]
        );
        
        // Увеличиваем счетчик комментариев
        await connection.execute(
            'UPDATE community_posts SET comments = comments + 1 WHERE id = ?',
            [post_id]
        );
        
        // Получаем созданный комментарий
        const [comment] = await connection.execute(
            `SELECT pc.*, u.username, u.email as user_email
             FROM post_comments pc
             JOIN users u ON pc.user_id = u.id
             WHERE pc.id = ?`,
            [commentResult.insertId]
        );
        
        console.log('✅ Комментарий добавлен, ID:', commentResult.insertId);
        
        res.json({
            status: 'success',
            message: 'Комментарий добавлен!',
            data: comment[0]
        });
        
    } catch (error) {
        console.error('❌ Ошибка добавления комментария:', error);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка добавления комментария: ' + error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});

// ЛАЙК/ДИЗЛАЙК ПОСТА
app.post('/api/community/posts/:id/like', authenticateToken, async (req, res) => {
    let connection;
    try {
        const postId = parseInt(req.params.id);
        const userId = req.user.id;
        
        console.log('❤️ Лайк поста:', { userId, postId });
        
        connection = await createConnection();
        
        // Проверяем существующий лайк
        const [existingLike] = await connection.execute(
            'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?',
            [postId, userId]
        );
        
        let action = '';
        
        if (existingLike.length > 0) {
            // Удаляем лайк
            await connection.execute(
                'DELETE FROM post_likes WHERE id = ?',
                [existingLike[0].id]
            );
            
            await connection.execute(
                'UPDATE community_posts SET likes = GREATEST(likes - 1, 0) WHERE id = ?',
                [postId]
            );
            
            action = 'unliked';
        } else {
            // Добавляем лайк
            await connection.execute(
                'INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, NOW())',
                [postId, userId]
            );
            
            await connection.execute(
                'UPDATE community_posts SET likes = likes + 1 WHERE id = ?',
                [postId]
            );
            
            action = 'liked';
        }
        
        // Получаем обновленное количество лайков
        const [postResult] = await connection.execute(
            'SELECT likes FROM community_posts WHERE id = ?',
            [postId]
        );
        
        res.json({
            status: 'success',
            message: action === 'liked' ? 'Посту понравилось!' : 'Лайк убран',
            data: {
                action: action,
                likes: postResult[0].likes,
                postId: postId
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка лайка:', error);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка лайка: ' + error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});

// ========== УДАЛЕНИЕ ПОСТА (ТОЛЬКО АДМИН) ==========
app.delete('/api/community/posts/:id', authenticateToken, requireAdmin, async (req, res) => {
    let connection;
    try {
        const postId = parseInt(req.params.id);
        
        if (isNaN(postId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Неверный ID поста'
            });
        }
        
        connection = await createConnection();
        
        // Проверяем существование поста
        const [post] = await connection.execute(
            'SELECT id, title FROM community_posts WHERE id = ?',
            [postId]
        );
        
        if (post.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Пост не найден'
            });
        }
        
        // Удаляем связанные данные
        await connection.execute('DELETE FROM post_likes WHERE post_id = ?', [postId]);
        await connection.execute('DELETE FROM post_comments WHERE post_id = ?', [postId]);
        await connection.execute('DELETE FROM community_posts WHERE id = ?', [postId]);
        
        console.log(`🗑️ Админ ${req.user.username} удалил пост #${postId}: "${post[0].title}"`);
        
        res.json({
            status: 'success',
            message: 'Пост успешно удален',
            data: {
                deletedPostId: postId,
                deletedBy: req.user.username
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка удаления поста:', error);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка удаления поста: ' + error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});

// ПРОВЕРИТЬ СТАТУС ЛАЙКА
app.get('/api/community/posts/:id/like-status', authenticateToken, async (req, res) => {
    let connection;
    try {
        const postId = parseInt(req.params.id);
        const userId = req.user.id;
        
        connection = await createConnection();
        
        const [existingLike] = await connection.execute(
            'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?',
            [postId, userId]
        );
        
        res.json({
            status: 'success',
            data: {
                liked: existingLike.length > 0
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка проверки лайка:', error);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка проверки лайка: ' + error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});

// ========== СТАТИСТИКА ==========
app.get('/api/community/stats', async (req, res) => {
    let connection;
    try {
        connection = await createConnection();
        
        const [usersCount] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
        const [postsCount] = await connection.execute('SELECT COUNT(*) as count FROM community_posts');
        const [commentsCount] = await connection.execute('SELECT COUNT(*) as count FROM post_comments');
        const [heroesCount] = await connection.execute('SELECT COUNT(*) as count FROM heroes WHERE is_active = 1');
        
        res.json({
            status: 'success',
            data: {
                users: usersCount[0].count,
                posts: postsCount[0].count,
                comments: commentsCount[0].count,
                heroes: heroesCount[0].count,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ Ошибка загрузки статистики:', error);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка загрузки статистики: ' + error.message
        });
    } finally {
        if (connection) await connection.end();
    }
});

// ========== SPA ОБРАБОТКА ==========
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ========== ЗАПУСК СЕРВЕРА ==========
app.listen(PORT, () => {
    console.log('🚀 =================================');
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log('🚀 =================================');
    console.log('\n📋 Доступные API:');
    console.log('  GET  /api/test              - Проверка сервера');
    console.log('  POST /api/register          - Регистрация');
    console.log('  POST /api/login             - Авторизация');
    console.log('  GET  /api/heroes            - Все герои');
    console.log('  GET  /api/favorites         - Избранные');
    console.log('  POST /api/favorites/:id     - Добавить/удалить избранное');
    console.log('  GET  /api/community/posts   - Посты сообщества');
    console.log('  POST /api/community/posts   - Создать пост');
    console.log('  DELETE /api/community/posts/:id - Удалить пост (админ)');
    console.log('  GET  /api/community/stats   - Статистика');
    console.log('🚀 =================================');
});