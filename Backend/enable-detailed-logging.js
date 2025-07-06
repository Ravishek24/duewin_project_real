const fs = require('fs');
const path = require('path');

function enableDetailedLogging() {
    try {
        console.log('🔧 [LOGGING_ENABLE] ==========================================');
        console.log('🔧 [LOGGING_ENABLE] Enabling detailed logging in gameLogicService.js');
        console.log('🔧 [LOGGING_ENABLE] ==========================================');

        const filePath = path.join(__dirname, 'services', 'gameLogicService.js');
        let content = fs.readFileSync(filePath, 'utf8');

        // Add logging to selectProtectedResultWithExposure
        const protectionLogging = `
        console.log('🛡️ [PROTECTION_START] ==========================================');
        console.log('🛡️ [PROTECTION_START] selectProtectedResultWithExposure called');
        console.log('🛡️ [PROTECTION_START] gameType:', gameType, 'duration:', duration, 'periodId:', periodId, 'timeline:', timeline);
        console.log('🛡️ [PROTECTION_START] ==========================================');
        `;

        // Add logging to getUniqueUserCount
        const userCountLogging = `
        console.log('👥 [USER_COUNT_START] ==========================================');
        console.log('👥 [USER_COUNT_START] getUniqueUserCount called');
        console.log('👥 [USER_COUNT_START] gameType:', gameType, 'duration:', duration, 'periodId:', periodId, 'timeline:', timeline);
        console.log('👥 [USER_COUNT_START] ==========================================');
        `;

        // Add logging to calculateResultWithVerification
        const resultLogging = `
        console.log('🎯 [RESULT_START] ==========================================');
        console.log('🎯 [RESULT_START] calculateResultWithVerification called');
        console.log('🎯 [RESULT_START] gameType:', gameType, 'duration:', duration, 'periodId:', periodId, 'timeline:', timeline);
        console.log('🎯 [RESULT_START] ==========================================');
        `;

        // Add logging to processGameResults
        const processLogging = `
        console.log('🎲 [PROCESS_START] ==========================================');
        console.log('🎲 [PROCESS_START] processGameResults called');
        console.log('🎲 [PROCESS_START] gameType:', gameType, 'duration:', duration, 'periodId:', periodId, 'timeline:', timeline);
        console.log('🎲 [PROCESS_START] ==========================================');
        `;

        // Insert logging into key functions
        let changes = 0;

        // Add to selectProtectedResultWithExposure
        if (content.includes('async function selectProtectedResultWithExposure')) {
            const insertPoint = content.indexOf('async function selectProtectedResultWithExposure') + 
                               content.substring(content.indexOf('async function selectProtectedResultWithExposure')).indexOf('{') + 1;
            content = content.substring(0, insertPoint) + protectionLogging + content.substring(insertPoint);
            changes++;
            console.log('✅ Added logging to selectProtectedResultWithExposure');
        }

        // Add to getUniqueUserCount
        if (content.includes('const getUniqueUserCount = async')) {
            const insertPoint = content.indexOf('const getUniqueUserCount = async') + 
                               content.substring(content.indexOf('const getUniqueUserCount = async')).indexOf('{') + 1;
            content = content.substring(0, insertPoint) + userCountLogging + content.substring(insertPoint);
            changes++;
            console.log('✅ Added logging to getUniqueUserCount');
        }

        // Add to calculateResultWithVerification
        if (content.includes('async function calculateResultWithVerification')) {
            const insertPoint = content.indexOf('async function calculateResultWithVerification') + 
                               content.substring(content.indexOf('async function calculateResultWithVerification')).indexOf('{') + 1;
            content = content.substring(0, insertPoint) + resultLogging + content.substring(insertPoint);
            changes++;
            console.log('✅ Added logging to calculateResultWithVerification');
        }

        // Add to processGameResults
        if (content.includes('async function processGameResults')) {
            const insertPoint = content.indexOf('async function processGameResults') + 
                               content.substring(content.indexOf('async function processGameResults')).indexOf('{') + 1;
            content = content.substring(0, insertPoint) + processLogging + content.substring(insertPoint);
            changes++;
            console.log('✅ Added logging to processGameResults');
        }

        // Write the updated content back
        fs.writeFileSync(filePath, content, 'utf8');

        console.log(`\n🔧 [LOGGING_ENABLE] ==========================================`);
        console.log(`🔧 [LOGGING_ENABLE] Added logging to ${changes} functions`);
        console.log(`🔧 [LOGGING_ENABLE] File updated: ${filePath}`);
        console.log(`🔧 [LOGGING_ENABLE] ==========================================`);

        if (changes === 0) {
            console.log('⚠️ No functions found to add logging to.');
        }

    } catch (error) {
        console.error('❌ Error enabling detailed logging:', error);
    }
}

enableDetailedLogging(); 