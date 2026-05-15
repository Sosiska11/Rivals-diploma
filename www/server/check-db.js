const mysql = require('mysql2/promise');

async function checkDatabase() {
    let connection;
    try {
        console.log('🔍 Проверка подключения к MySQL...');
        
        // Подключаемся к MySQL с указанием базы
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '', // Пустой пароль
            database: 'marvel_rivals', // Сразу подключаемся к базе
            port: 3306
        });
        
        console.log('✅ Подключение к MySQL успешно');
        
        // Проверяем таблицы
        const [tables] = await connection.execute('SHOW TABLES');
        console.log('📋 Таблицы в базе marvel_rivals:');
        tables.forEach(table => {
            console.log(`  - ${Object.values(table)[0]}`);
        });
        
        // Проверяем количество героев
        const [heroesCount] = await connection.execute('SELECT COUNT(*) as count FROM heroes');
        console.log(`👥 Героев в базе: ${heroesCount[0].count}`);
        
        // Проверяем пользователей
        const [usersCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
        console.log(`👤 Пользователей в базе: ${usersCount[0].count}`);
        
        // Выводим несколько героев для примера
        const [heroes] = await connection.execute('SELECT id, name, role FROM heroes LIMIT 5');
        console.log('🎭 Примеры героев:');
        heroes.forEach(hero => {
            console.log(`  - ${hero.id}: ${hero.name} (${hero.role})`);
        });
        
        // Проверяем пользователей
        const [users] = await connection.execute('SELECT id, username, email FROM users LIMIT 5');
        console.log('👤 Примеры пользователей:');
        users.forEach(user => {
            console.log(`  - ${user.id}: ${user.username} (${user.email})`);
        });
        
        console.log('✅ Проверка завершена успешно!');
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        console.error('🔍 Детали ошибки:', error.code);
        
        if (error.code === 'ER_BAD_DB_ERROR') {
            console.log('\n📁 База данных не существует. Создайте ее:');
            console.log('1. Откройте phpMyAdmin (http://localhost/openserver/phpmyadmin)');
            console.log('2. Создайте базу "marvel_rivals"');
            console.log('3. Импортируйте файл marvel_rivals.sql');
        }
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Соединение закрыто');
        }
    }
}

checkDatabase();