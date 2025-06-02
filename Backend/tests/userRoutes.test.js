const request = require('supertest');
const app = require('../index');
const { User } = require('../models');

describe('User Routes', () => {
    // Clean up the database before each test
    beforeEach(async () => {
        await User.destroy({ where: {} });
    });

    describe('POST /signup', () => {
        it('should create a new user with valid data', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'Test@123',
                phone: '1234567890'
            };

            const response = await request(app)
                .post('/api/users/signup')
                .send(userData);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message', 'User registered successfully');
            expect(response.body.data).toHaveProperty('user');
            expect(response.body.data.user).toHaveProperty('username', userData.username);
            expect(response.body.data.user).toHaveProperty('email', userData.email);
            expect(response.body.data.user).not.toHaveProperty('password');
        });

        it('should return error for invalid data', async () => {
            const invalidUserData = {
                username: 'te', // too short
                email: 'invalid-email',
                password: '123', // too short
                phone: '123' // too short
            };

            const response = await request(app)
                .post('/api/users/signup')
                .send(invalidUserData);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('errors');
        });
    });

    describe('POST /login', () => {
        beforeEach(async () => {
            // Create a test user before login tests
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'Test@123',
                phone: '1234567890'
            };
            await request(app)
                .post('/api/users/signup')
                .send(userData);
        });

        it('should login successfully with valid credentials', async () => {
            const loginData = {
                email: 'test@example.com',
                password: 'Test@123'
            };

            const response = await request(app)
                .post('/api/users/login')
                .send(loginData);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('token');
            expect(response.body.data).toHaveProperty('user');
            expect(response.body.data.user).toHaveProperty('email', loginData.email);
            expect(response.body.data.user).not.toHaveProperty('password');
        });

        it('should return error for invalid credentials', async () => {
            const invalidLoginData = {
                email: 'test@example.com',
                password: 'wrongpassword'
            };

            const response = await request(app)
                .post('/api/users/login')
                .send(invalidLoginData);

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message', 'Invalid credentials');
        });

        it('should return error for non-existent user', async () => {
            const nonExistentUserData = {
                email: 'nonexistent@example.com',
                password: 'Test@123'
            };

            const response = await request(app)
                .post('/api/users/login')
                .send(nonExistentUserData);

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message', 'Invalid credentials');
        });
    });
}); 