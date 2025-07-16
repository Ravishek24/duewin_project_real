/**
 * Debug Period Calculation
 * Checks why periods are showing as ended when they should be active
 */

const axios = require('axios');

class PeriodDebugger {
    constructor() {
        this.baseURL = 'http://localhost:8000';
        this.adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozLCJpc19hZG1pbiI6dHJ1ZSwiaWF0IjoxNzUyNDU2NjgxLCJleHAiOjE3NTI1NDMwODF9.48Np5DOYhqD_h8Wji6Az_RLZmvm09Ij-33kKnpmjbdU';
    }

    async debugPeriods() {
        console.log('🔍 Debugging Period Calculation\n');
        
        try {
            await this.checkCurrentTime();
            await this.checkPeriodLogic();
            await this.checkAPIResponse();
            await this.compareCalculations();
            
        } catch (error) {
            console.error('❌ Debug failed:', error);
        }
    }

    async checkCurrentTime() {
        console.log('⏰ Step 1: Check Current Time');
        console.log('=============================');
        
        const now = new Date();
        console.log(`Current Time: ${now.toISOString()}`);
        console.log(`Local Time: ${now.toLocaleString()}`);
        console.log(`UTC Offset: ${now.getTimezoneOffset()} minutes`);
        console.log(`Timestamp: ${now.getTime()}`);
    }

    async checkPeriodLogic() {
        console.log('\n🧮 Step 2: Check Period Logic');
        console.log('=============================');
        
        const durations = [30, 60, 180, 300];
        const now = new Date();
        
        durations.forEach(duration => {
            console.log(`\n🎮 ${duration}s Room Calculation:`);
            
            // Method 1: Floor to period start
            const periodStart1 = new Date(Math.floor(now.getTime() / (duration * 1000)) * (duration * 1000));
            const periodEnd1 = new Date(periodStart1.getTime() + (duration * 1000));
            const timeRemaining1 = Math.max(0, Math.floor((periodEnd1 - now) / 1000));
            
            console.log(`   Method 1 (Floor):`);
            console.log(`   Period Start: ${periodStart1.toISOString()}`);
            console.log(`   Period End: ${periodEnd1.toISOString()}`);
            console.log(`   Time Remaining: ${timeRemaining1}s`);
            console.log(`   Status: ${timeRemaining1 > 0 ? '🟢 Active' : '🔴 Ended'}`);
            
            // Method 2: Round to nearest period
            const periodStart2 = new Date(Math.round(now.getTime() / (duration * 1000)) * (duration * 1000));
            const periodEnd2 = new Date(periodStart2.getTime() + (duration * 1000));
            const timeRemaining2 = Math.max(0, Math.floor((periodEnd2 - now) / 1000));
            
            console.log(`   Method 2 (Round):`);
            console.log(`   Period Start: ${periodStart2.toISOString()}`);
            console.log(`   Period End: ${periodEnd2.toISOString()}`);
            console.log(`   Time Remaining: ${timeRemaining2}s`);
            console.log(`   Status: ${timeRemaining2 > 0 ? '🟢 Active' : '🔴 Ended'}`);
            
            // Method 3: Ceil to next period
            const periodStart3 = new Date(Math.ceil(now.getTime() / (duration * 1000)) * (duration * 1000));
            const periodEnd3 = new Date(periodStart3.getTime() + (duration * 1000));
            const timeRemaining3 = Math.max(0, Math.floor((periodEnd3 - now) / 1000));
            
            console.log(`   Method 3 (Ceil):`);
            console.log(`   Period Start: ${periodStart3.toISOString()}`);
            console.log(`   Period End: ${periodEnd3.toISOString()}`);
            console.log(`   Time Remaining: ${timeRemaining3}s`);
            console.log(`   Status: ${timeRemaining3 > 0 ? '🟢 Active' : '🔴 Ended'}`);
        });
    }

    async checkAPIResponse() {
        console.log('\n📡 Step 3: Check API Response');
        console.log('=============================');
        
        try {
            const response = await axios.get(`${this.baseURL}/api/admin/exposure/all`, {
                headers: { 'Authorization': `Bearer ${this.adminToken}` }
            });
            
            if (response.data.success && response.data.rooms) {
                console.log('✅ API Response received');
                
                Object.keys(response.data.rooms).forEach(room => {
                    const roomData = response.data.rooms[room];
                    console.log(`\n🎮 ${room}:`);
                    console.log(`   Period ID: ${roomData.periodId}`);
                    console.log(`   Start Time: ${roomData.periodInfo?.startTime}`);
                    console.log(`   End Time: ${roomData.periodInfo?.endTime}`);
                    console.log(`   Time Remaining: ${roomData.periodInfo?.timeRemaining}s`);
                    console.log(`   Duration: ${roomData.periodInfo?.duration}s`);
                    console.log(`   Status: ${roomData.periodInfo?.timeRemaining > 0 ? '🟢 Active' : '🔴 Ended'}`);
                });
            } else {
                console.log('❌ No room data in API response');
            }
        } catch (error) {
            console.log('❌ API check failed:', error.message);
        }
    }

    async compareCalculations() {
        console.log('\n🔍 Step 4: Compare Calculations');
        console.log('===============================');
        
        const now = new Date();
        const durations = [30, 60, 180, 300];
        
        durations.forEach(duration => {
            console.log(`\n🎮 ${duration}s Room Comparison:`);
            
            // Our calculation
            const periodStart = new Date(Math.floor(now.getTime() / (duration * 1000)) * (duration * 1000));
            const periodEnd = new Date(periodStart.getTime() + (duration * 1000));
            const timeRemaining = Math.max(0, Math.floor((periodEnd - now) / 1000));
            
            console.log(`   Our Calculation:`);
            console.log(`   Period Start: ${periodStart.toISOString()}`);
            console.log(`   Period End: ${periodEnd.toISOString()}`);
            console.log(`   Time Remaining: ${timeRemaining}s`);
            
            // Check if we're in the right period
            const timeSincePeriodStart = Math.floor((now - periodStart) / 1000);
            const timeUntilPeriodEnd = Math.floor((periodEnd - now) / 1000);
            
            console.log(`   Time since period start: ${timeSincePeriodStart}s`);
            console.log(`   Time until period end: ${timeUntilPeriodEnd}s`);
            
            if (timeSincePeriodStart < 0) {
                console.log(`   ⚠️ We're before the period start!`);
            } else if (timeUntilPeriodEnd < 0) {
                console.log(`   ⚠️ We're after the period end!`);
            } else {
                console.log(`   ✅ We're within the period`);
            }
            
            // Check if the period should be active
            const shouldBeActive = timeSincePeriodStart >= 0 && timeUntilPeriodEnd > 0;
            console.log(`   Should be active: ${shouldBeActive ? 'Yes' : 'No'}`);
        });
    }
}

// Run the debug
const periodDebugger = new PeriodDebugger();
periodDebugger.debugPeriods(); 