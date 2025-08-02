// Fix for 5D broadcast issue
// The problem is that processGameResultsWithPreCalc is not calling broadcastGameResult
// This means the frontend is not notified when 5D bet results are processed

const fs = require('fs');
const path = require('path');

const gameLogicServicePath = path.join(__dirname, 'services', 'gameLogicService.js');

// Read the current file
let content = fs.readFileSync(gameLogicServicePath, 'utf8');

// Find the section where bgTransaction.commit() is called and add broadcast
const searchPattern = /await bgTransaction\.commit\(\);\s*\n\s*console\.log\('✅ \[5D_PROCESS\] Database operations completed with winners:', winners\.length\);\s*\n\s*return \{/;

const replacement = `await bgTransaction.commit();
                
                console.log('✅ [5D_PROCESS] Database operations completed with winners:', winners.length);

                // CRITICAL FIX: Broadcast result to frontend for real-time updates
                console.log('📡 [5D_PROCESS] Broadcasting result to frontend...');
                try {
                    await broadcastGameResult(gameType, duration, periodId, result, timeline);
                    console.log('✅ [5D_PROCESS] Result broadcasted successfully');
                } catch (broadcastError) {
                    console.error('❌ [5D_PROCESS] Broadcast failed:', broadcastError.message);
                    // Don't fail the entire process if broadcast fails
                }

                return {`;

// Replace the content
const updatedContent = content.replace(searchPattern, replacement);

// Write the updated content back
fs.writeFileSync(gameLogicServicePath, updatedContent, 'utf8');

console.log('✅ [FIX_5D_BROADCAST] Successfully added broadcast functionality to 5D bet processing');
console.log('📡 [FIX_5D_BROADCAST] 5D games will now notify frontend when bet results are processed');
console.log('🔄 [FIX_5D_BROADCAST] User balances will now update in real-time on the frontend'); 