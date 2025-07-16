const { getK3ExposureAnalysis } = require('./services/gameLogicService');

async function testK3ExposureLogging() {
    try {
        console.log('🎲 [K3_EXPOSURE_TEST] Testing K3 exposure logging...');
        
        // Test with a sample period ID
        const gameType = 'k3';
        const duration = 60; // 60 seconds
        const periodId = '20250708000000121'; // Use the period from your logs
        const timeline = 'default';
        
        console.log(`🔍 [K3_EXPOSURE_TEST] Analyzing exposure for period: ${periodId}`);
        
        const analysis = await getK3ExposureAnalysis(gameType, duration, periodId, timeline);
        
        console.log('✅ [K3_EXPOSURE_TEST] Analysis completed!');
        console.log('📊 [K3_EXPOSURE_TEST] Summary:', {
            periodId: analysis.periodId,
            totalCombinations: analysis.totalCombinations,
            totalExposure: analysis.totalExposure,
            averageExposurePerCombination: analysis.averageExposurePerCombination
        });
        
        if (analysis.topExposedResults && analysis.topExposedResults.length > 0) {
            console.log('🏆 [K3_EXPOSURE_TEST] Top exposed results:');
            analysis.topExposedResults.forEach((result, index) => {
                console.log(`  ${index + 1}. ${result.resultType}: ₹${result.totalExposure} (${result.count} combinations)`);
            });
        }
        
    } catch (error) {
        console.error('❌ [K3_EXPOSURE_TEST] Error:', error.message);
    }
}

// Run the test
testK3ExposureLogging(); 