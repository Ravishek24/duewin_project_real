/**
 * Check Real Periods Script
 * Verifies that we're using real periods, not test data
 */

const axios = require('axios');

class RealPeriodChecker {
    constructor() {
        this.baseURL = 'http://localhost:8000';
        this.adminToken = null;
    }

    async checkRealPeriods() {
        console.log('🔍 Checking Real Periods\n');
        
        try {
            await this.getToken();
            await this.checkCurrentPeriods();
            await this.verifyPeriodLogic();
            
        } catch (error) {
            console.error('❌ Check failed:', error);
        }
    }

    async getToken() {
        console.log('🔐 Getting Admin Token...');
        
        try {
            const response = await axios.post(`${this.baseURL}/admin/direct-login`, {
                email: 'admin@example.com'
            });
            
            if (response.data.success && response.data.data.token) {
                this.adminToken = response.data.data.token;
                console.log('✅ Token obtained');
            } else {
                throw new Error('No token received');
            }
        } catch (error) {
            console.log('❌ Token failed:', error.message);
        }
    }

    async checkCurrentPeriods() {
        console.log('\n📊 Checking Current Periods...');
        
        if (!this.adminToken) {
            console.log('❌ No token available');
            return;
        }

        try {
            const response = await axios.get(`${this.baseURL}/admin/exposure/wingo/current`, {
                headers: { 'Authorization': `Bearer ${this.adminToken}` }
            });
            
            if (response.data.success && response.data.data.rooms) {
                const rooms = response.data.data.rooms;
                console.log(`✅ Found ${Object.keys(rooms).length} active rooms`);
                
                Object.keys(rooms).forEach(room => {
                    const roomData = rooms[room];
                    const periodId = roomData.periodId;
                    const timeRemaining = roomData.periodInfo?.timeRemaining || 0;
                    
                    console.log(`\n🎮 ${room}:`);
                    console.log(`   Period ID: ${periodId}`);
                    console.log(`   Time Remaining: ${timeRemaining}s`);
                    console.log(`   Total Exposure: ₹${roomData.analysis?.totalExposure || '0.00'}`);
                    console.log(`   Optimal Number: ${roomData.analysis?.optimalNumber || 'N/A'}`);
                    
                    // Verify this is a real period (not test data)
                    this.verifyPeriodId(periodId, room);
                });
            } else {
                console.log('❌ No room data received');
            }
        } catch (error) {
            console.log('❌ Period check failed:', error.message);
        }
    }

    verifyPeriodId(periodId, room) {
        console.log(`   🔍 Verifying period ID: ${periodId}`);
        
        // Check if period ID follows the correct format
        if (periodId && periodId.length === 15) {
            const year = periodId.substring(0, 4);
            const month = periodId.substring(4, 6);
            const day = periodId.substring(6, 8);
            const hour = periodId.substring(9, 11);
            const minute = periodId.substring(11, 13);
            const second = periodId.substring(13, 15);
            
            const periodDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
            const now = new Date();
            const timeDiff = Math.abs(now - periodDate) / 1000; // seconds
            
            console.log(`   📅 Period Date: ${periodDate.toISOString()}`);
            console.log(`   ⏰ Current Time: ${now.toISOString()}`);
            console.log(`   ⏱️ Time Difference: ${timeDiff.toFixed(0)}s`);
            
            // Check if this looks like a real period
            if (timeDiff < 3600) { // Within 1 hour
                console.log(`   ✅ This appears to be a REAL period (recent)`);
            } else if (timeDiff < 86400) { // Within 24 hours
                console.log(`   ⚠️ This period is older but still recent`);
            } else {
                console.log(`   ❌ This period seems too old (${(timeDiff/3600).toFixed(1)} hours)`);
            }
            
            // Check if period ID matches current time pattern
            const expectedPattern = this.getExpectedPeriodPattern(room);
            console.log(`   🎯 Expected Pattern: ${expectedPattern}`);
            console.log(`   🔄 Pattern Match: ${periodId === expectedPattern ? '✅ Yes' : '❌ No'}`);
            
        } else {
            console.log(`   ❌ Invalid period ID format`);
        }
    }

    getExpectedPeriodPattern(room) {
        const now = new Date();
        const duration = parseInt(room.replace('wingo-', '').replace('s', ''));
        
        // Calculate the current period start time
        const periodStart = new Date(Math.floor(now.getTime() / (duration * 1000)) * (duration * 1000));
        
        return periodStart.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, '');
    }

    async verifyPeriodLogic() {
        console.log('\n🧮 Verifying Period Logic...');
        
        const durations = [30, 60, 180, 300];
        
        durations.forEach(duration => {
            const now = new Date();
            const periodStart = new Date(Math.floor(now.getTime() / (duration * 1000)) * (duration * 1000));
            const periodEnd = new Date(periodStart.getTime() + (duration * 1000));
            const timeRemaining = Math.max(0, Math.floor((periodEnd - now) / 1000));
            
            const periodId = periodStart.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, '');
            
            console.log(`\n🎮 ${duration}s Room Logic:`);
            console.log(`   Current Time: ${now.toISOString()}`);
            console.log(`   Period Start: ${periodStart.toISOString()}`);
            console.log(`   Period End: ${periodEnd.toISOString()}`);
            console.log(`   Time Remaining: ${timeRemaining}s`);
            console.log(`   Period ID: ${periodId}`);
            console.log(`   Status: ${timeRemaining > 0 ? '🟢 Active' : '🔴 Ended'}`);
        });
    }
}

// Run the check
const checker = new RealPeriodChecker();
checker.checkRealPeriods(); 