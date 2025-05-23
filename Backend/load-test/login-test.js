const axios = require('axios');

// Use the production API URL (without port since it's behind a reverse proxy)
const API_URL = 'https://strike.atsproduct.in/api/users';

// Generate test user data with all required fields
const TEST_USER = {
    phone_no: `8368099${Date.now().toString().slice(-4)}`,
    password: 'Test@123',
    email: `test${Date.now()}@example.com`,
    user_name: `testuser${Date.now().toString().slice(-4)}`
};

// Validate response data
function validateResponse(data, type) {
    if (!data.success) {
        throw new Error(`${type} response indicates failure: ${data.message}`);
    }

    if (type === 'registration' && (!data.data || !data.data.user || !data.data.tokens)) {
        throw new Error('Registration response missing user data or token');
    }

    if (type === 'login' && (!data.data || !data.data.tokens)) {
        throw new Error('Login response missing user data or tokens');
    }
}

async function createUser() {
    try {
        console.log('\n=== Creating Test User ===');
        console.log('Using credentials:', {
            phone_no: TEST_USER.phone_no,
            email: TEST_USER.email,
            user_name: TEST_USER.user_name
        });

        // Get the actual IP address being used
        const ipResponse = await axios.get('https://api.ipify.org?format=json');
        const ipAddress = ipResponse.data.ip;
        console.log('Current IP address:', ipAddress);

        const response = await axios.post(`${API_URL}/signup`, TEST_USER, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Forwarded-For': ipAddress // Add the IP address to the request
            },
            timeout: 10000 // 10 second timeout
        });
        
        validateResponse(response.data, 'registration');
        
        console.log('User created successfully:', {
            user_id: response.data.data.user.id,
            username: response.data.data.user.user_name,
            email: response.data.data.user.email,
            phone_no: response.data.data.user.phone_no
        });
        
        return response.data;
    } catch (error) {
        if (error.response) {
            if (error.response.status === 409) {
                console.log('User already exists, proceeding with login...');
                return null;
            }
            console.error('Error creating user:', {
                status: error.response.status,
                message: error.response.data?.message || 'Unknown error',
                data: error.response.data
            });
        } else if (error.code === 'ECONNREFUSED') {
            console.error('Connection refused. Please check if the server is running and accessible.');
        } else if (error.code === 'ETIMEDOUT') {
            console.error('Connection timed out. Please check your network connection.');
        } else {
            console.error('Error creating user:', error.message);
        }
        throw error;
    }
}

async function loginUser() {
    try {
        console.log('\n=== Attempting Login ===');
        
        // Get the actual IP address being used
        const ipResponse = await axios.get('https://api.ipify.org?format=json');
        const ipAddress = ipResponse.data.ip;
        console.log('Current IP address:', ipAddress);

        const response = await axios.post(`${API_URL}/login`, {
            phone_no: TEST_USER.phone_no,
            password: TEST_USER.password
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Forwarded-For': ipAddress // Add the IP address to the request
            },
            timeout: 10000 // 10 second timeout
        });
        
        validateResponse(response.data, 'login');
        
        console.log('Login successful:', {
            user_id: response.data.data.user.id,
            phone_no: response.data.data.user.phone_no,
            wallet_balance: response.data.data.user.wallet_balance
        });
        
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error('Login failed:', {
                status: error.response.status,
                message: error.response.data?.message || 'Unknown error',
                data: error.response.data
            });
        } else if (error.code === 'ECONNREFUSED') {
            console.error('Connection refused. Please check if the server is running and accessible.');
        } else if (error.code === 'ETIMEDOUT') {
            console.error('Connection timed out. Please check your network connection.');
        } else {
            console.error('Login failed:', error.message);
        }
        throw error;
    }
}

async function runTest() {
    try {
        console.log('Starting login test...');
        console.log('API URL:', API_URL);
        
        const registrationResult = await createUser();
        if (registrationResult) {
            console.log('\nRegistration successful, proceeding to login...');
        }
        
        const loginResult = await loginUser();
        console.log('\n=== Test Completed Successfully ===');
        return loginResult;
    } catch (error) {
        console.error('\n=== Test Failed ===');
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Run the test
runTest(); 