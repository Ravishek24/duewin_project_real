const mysql = require('mysql2/promise');

async function testConnection() {
    try {
        const connection = await mysql.createConnection({
            host: 'database-1.chw2iae8s9ej.eu-north-1.rds.amazonaws.com',
            user: 'admin',
            password: 'Ravishek123-456',
            database: 'duewin',
            port: 3306
        });

        console.log('Successfully connected to the database!');
        
        // Test query
        const [rows] = await connection.execute('SELECT 1');
        console.log('Test query result:', rows);

        await connection.end();
    } catch (error) {
        console.error('Database connection error:', error);
    }
}

testConnection(); 