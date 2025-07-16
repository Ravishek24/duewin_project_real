const axios = require('axios');
const moment = require('moment-timezone');

// Same logic as periodService.js
const getCurrentPeriod = (gameType, duration) => {
    try {
        const now = new Date();
        const istMoment = moment(now).tz('Asia/Kolkata');
        let startOfPeriods = istMoment.clone().hour(2).minute(0).second(0).millisecond(0);
        if (istMoment.hour() < 2) {
            startOfPeriods.subtract(1, 'day');
        }
        const totalSeconds = istMoment.diff(startOfPeriods, 'seconds');
        const currentPeriodNumber = Math.floor(totalSeconds / duration);
        const currentPeriodStart = startOfPeriods.clone().add(currentPeriodNumber * duration, 'seconds');
        const currentPeriodEnd = currentPeriodStart.clone().add(duration, 'seconds');
        const timeRemaining = Math.max(0, currentPeriodEnd.diff(istMoment, 'seconds'));
        const dateStr = startOfPeriods.format('YYYYMMDD');
        const periodId = `${dateStr}${currentPeriodNumber.toString().padStart(9, '0')}`;
        return {
            periodId,
            gameType,
            duration,
            startTime: currentPeriodStart.toDate(),
            endTime: currentPeriodEnd.toDate(),
            timeRemaining,
            active: true,
            bettingOpen: timeRemaining > 5
        };
    } catch (error) {
        console.error('Error getting current period:', error);
        return null;
    }
};

// Admin token (replace with your real token)
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozLCJpc19hZG1pbiI6dHJ1ZSwiaWF0IjoxNzUyNDU4MDY4LCJleHAiOjE3NTI1NDQ0Njh9.kxUHGmTKb0Vw_fAFuAsPH5UryCYH5IEJqE6RYk7aLe0';

const BASE_URL = 'http://localhost:8000/admin/exposure';
const DURATIONS = [30, 60, 180, 300];

async function testExposureEndpoints() {
    for (const duration of DURATIONS) {
        const period = getCurrentPeriod('wingo', duration);
        if (!period) {
            console.log(`❌ Could not calculate period for ${duration}s`);
            continue;
        }
        const url = `${BASE_URL}/wingo/${duration}/${period.periodId}`;
        try {
            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
            });
            console.log(`\n[${duration}s] Period ID: ${period.periodId}`);
            console.log('API Response:', res.data);
        } catch (err) {
            if (err.response) {
                console.log(`\n[${duration}s] Period ID: ${period.periodId}`);
                console.log('❌ API Error:', err.response.status, err.response.data);
            } else {
                console.log(`\n[${duration}s] Period ID: ${period.periodId}`);
                console.log('❌ Request Error:', err.message);
            }
        }
    }
}

testExposureEndpoints(); 