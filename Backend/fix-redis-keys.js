const fs = require('fs');
const path = require('path');

function fixRedisKeys() {
    try {
        console.log('🔧 [REDIS_KEY_FIX] ==========================================');
        console.log('🔧 [REDIS_KEY_FIX] Fixing Redis key patterns in gameLogicService.js');
        console.log('🔧 [REDIS_KEY_FIX] ==========================================');

        const filePath = path.join(__dirname, 'services', 'gameLogicService.js');
        let content = fs.readFileSync(filePath, 'utf8');

        // Track changes
        let changes = 0;

        // Fix exposure keys
        const exposurePattern = /`exposure:\${gameType}:\${duration}:\${periodId}`/g;
        const newExposurePattern = '`duewin:exposure:${gameType}:${duration}:${periodId}`';
        if (content.match(exposurePattern)) {
            content = content.replace(exposurePattern, newExposurePattern);
            changes++;
            console.log('✅ Fixed exposure key pattern');
        }

        // Fix bet keys
        const betPattern = /`bets:\${gameType}:\${duration}:\${timeline}:\${periodId}`/g;
        const newBetPattern = '`duewin:bets:${gameType}:${duration}:${timeline}:${periodId}`';
        if (content.match(betPattern)) {
            content = content.replace(betPattern, newBetPattern);
            changes++;
            console.log('✅ Fixed bet key pattern');
        }

        // Fix other Redis key patterns that might be missing the prefix
        const otherPatterns = [
            { old: /`exposure:\${gameType}:\${duration}:\${periodId}`/g, new: '`duewin:exposure:${gameType}:${duration}:${periodId}`' },
            { old: /`bets:\${gameType}:\${duration}:\${periodId}`/g, new: '`duewin:bets:${gameType}:${duration}:${periodId}`' },
            { old: /`exposure:\${gameType}:\${durationKey}:\${periodId}`/g, new: '`duewin:exposure:${gameType}:${durationKey}:${periodId}`' },
            { old: /`bets:\${gameType}:\${durationKey}:\${periodId}`/g, new: '`duewin:bets:${gameType}:${durationKey}:${periodId}`' }
        ];

        otherPatterns.forEach((pattern, index) => {
            if (content.match(pattern.old)) {
                content = content.replace(pattern.old, pattern.new);
                changes++;
                console.log(`✅ Fixed additional Redis key pattern ${index + 1}`);
            }
        });

        // Write the fixed content back
        fs.writeFileSync(filePath, content, 'utf8');

        console.log(`\n🔧 [REDIS_KEY_FIX] ==========================================`);
        console.log(`🔧 [REDIS_KEY_FIX] Fixed ${changes} Redis key patterns`);
        console.log(`🔧 [REDIS_KEY_FIX] File updated: ${filePath}`);
        console.log(`🔧 [REDIS_KEY_FIX] ==========================================`);

        if (changes === 0) {
            console.log('⚠️ No Redis key patterns found to fix. They might already be correct.');
        }

    } catch (error) {
        console.error('❌ Error fixing Redis keys:', error);
    }
}

fixRedisKeys(); 