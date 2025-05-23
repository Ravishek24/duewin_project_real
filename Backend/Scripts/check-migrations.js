const mysql = require('mysql2/promise');

async function checkMigrations() {
    try {
        const connection = await mysql.createConnection({
            host: 'database-1.chw2iae8s9ej.eu-north-1.rds.amazonaws.com',
            user: 'admin',
            password: 'Ravishek123-456',
            database: 'duewin',
            port: 3306
        });

        // Check if SequelizeMeta table exists
        const [tables] = await connection.execute(`
            SELECT TABLE_NAME 
            FROM information_schema.tables 
            WHERE table_schema = 'duewin' 
            AND table_name = 'SequelizeMeta'
        `);

        if (tables.length === 0) {
            console.log('SequelizeMeta table does not exist. No migrations have been run.');
            return;
        }

        // Get all executed migrations
        const [migrations] = await connection.execute('SELECT * FROM SequelizeMeta ORDER BY name');
        console.log('Executed migrations:');
        migrations.forEach(migration => console.log(migration.name));

        await connection.end();
    } catch (error) {
        console.error('Error checking migrations:', error);
    }
}

checkMigrations(); 