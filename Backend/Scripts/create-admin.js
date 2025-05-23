const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
    try {
        const connection = await mysql.createConnection({
            host: 'database-1.chw2iae8s9ej.eu-north-1.rds.amazonaws.com',
            user: 'admin',
            password: 'Ravishek123-456',
            database: 'duewin',
            port: 3306
        });

        // Check if admin user already exists
        const [existingAdmins] = await connection.execute(
            'SELECT * FROM users WHERE is_admin = true'
        );

        if (existingAdmins.length > 0) {
            console.log('Admin user(s) already exist:');
            existingAdmins.forEach(admin => {
                console.log(`- ${admin.user_name} (${admin.email || admin.phone_no})`);
            });
            return;
        }

        // Create admin user
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        const [result] = await connection.execute(
            `INSERT INTO users (user_name, email, password, is_admin, created_at, updated_at) 
             VALUES (?, ?, ?, true, NOW(), NOW())`,
            ['Admin User', 'admin@duewin.com', hashedPassword]
        );

        console.log('Admin user created successfully!');
        console.log('Email: admin@duewin.com');
        console.log('Password: admin123');
        console.log('Please change these credentials after first login.');

        await connection.end();
    } catch (error) {
        console.error('Error creating admin user:', error);
    }
}

createAdminUser(); 