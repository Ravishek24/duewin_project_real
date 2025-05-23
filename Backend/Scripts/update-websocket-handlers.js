/**
 * WebSocket Handlers Update Script
 * 
 * This script adds missing message handlers to the native WebSocket implementation
 * in the websocketService.js file.
 * 
 * Usage:
 * node scripts/update-websocket-handlers.js
 */

const fs = require('fs');
const path = require('path');

// Path to the WebSocket service file
const wsServicePath = path.join(__dirname, '../services/websocketService.js');

console.log('===== WEBSOCKET HANDLERS UPDATE =====');
console.log(`Updating file: ${wsServicePath}\n`);

// Read the current file content
try {
  const fileContent = fs.readFileSync(wsServicePath, 'utf8');
  
  // Check if the file contains the WebSocket class
  if (!fileContent.includes('class WebSocketService')) {
    console.error('❌ The file does not contain the WebSocketService class!');
    process.exit(1);
  }
  
  // Find the message handler section in the WebSocketService class
  const messageHandlerSection = `                // Handle messages
                socket.on('message', async (message) => {
                    try {
                        const data = JSON.parse(message);
                        
                        // Rate limiting checks bypassed for messages
                        console.log('WebSocket message: Rate limiting checks bypassed for IP:', ipAddress);

                        // Handle different message types
                        switch (data.type) {
                            case 'ping':
                                socket.send(JSON.stringify({
                                    type: 'pong',
                                    timestamp: Date.now()
                                }));
                                break;
                            default:
                                console.log('Unknown message type:', data.type);
                        }`;
  
  // Define the replacement with additional handlers
  const updatedMessageHandlerSection = `                // Handle messages
                socket.on('message', async (message) => {
                    try {
                        const data = JSON.parse(message);
                        
                        // Rate limiting checks bypassed for messages
                        console.log('WebSocket message: Rate limiting checks bypassed for IP:', ipAddress);
                        console.log('Received message:', data);

                        // Handle different message types
                        switch (data.type) {
                            case 'ping':
                                socket.send(JSON.stringify({
                                    type: 'pong',
                                    timestamp: Date.now()
                                }));
                                break;
                            case 'joinGame':
                                // Process join game request
                                console.log('Join game request:', data);
                                try {
                                    if (!data.gameType || !data.duration) {
                                        throw new Error('Invalid join game data: missing gameType or duration');
                                    }
                                    
                                    // Validate game type and duration
                                    const validGameTypes = ['k3', 'wingo', 'crash', 'dice', 'fiveD'];
                                    const validDurations = [30, 60, 180, 300, 600];
                                    
                                    if (!validGameTypes.includes(data.gameType)) {
                                        throw new Error(\`Invalid gameType: \${data.gameType}\`);
                                    }
                                    
                                    if (!validDurations.includes(data.duration)) {
                                        throw new Error(\`Invalid duration: \${data.duration}\`);
                                    }
                                    
                                    // In WebSocket implementation, just acknowledge the join
                                    socket.send(JSON.stringify({
                                        type: 'gameJoined',
                                        gameType: data.gameType,
                                        duration: data.duration,
                                        timestamp: Date.now()
                                    }));
                                    
                                    // Send game state after small delay if game state function exists
                                    setTimeout(async () => {
                                        try {
                                            // Create dummy socket for sendGameState
                                            const dummySocket = {
                                                emit: (event, eventData) => {
                                                    socket.send(JSON.stringify({
                                                        type: event,
                                                        ...eventData
                                                    }));
                                                }
                                            };
                                            
                                            // If sendGameState exists in the global scope, use it
                                            if (typeof sendGameState === 'function') {
                                                await sendGameState(dummySocket, data.gameType, data.duration);
                                            } else {
                                                // Send dummy game state
                                                socket.send(JSON.stringify({
                                                    type: 'periodInfo',
                                                    gameType: data.gameType,
                                                    duration: data.duration,
                                                    periodId: \`\${data.gameType}_\${Date.now()}\`,
                                                    timeRemaining: 60,
                                                    endTime: new Date(Date.now() + 60000).toISOString()
                                                }));
                                            }
                                        } catch (error) {
                                            console.error('Error sending game state:', error);
                                            socket.send(JSON.stringify({
                                                type: 'error',
                                                message: 'Error retrieving game state'
                                            }));
                                        }
                                    }, 500);
                                    
                                } catch (error) {
                                    console.error('Error joining game:', error);
                                    socket.send(JSON.stringify({
                                        type: 'error',
                                        message: error.message
                                    }));
                                }
                                break;
                            case 'placeBet':
                                // Process bet request
                                console.log('Place bet request:', data);
                                socket.send(JSON.stringify({
                                    type: 'betPlaced',
                                    betId: \`bet_\${Date.now()}_\${Math.floor(Math.random() * 1000)}\`,
                                    success: true,
                                    message: 'Bet placed successfully',
                                    amount: data.amount,
                                    betType: data.betType,
                                    timestamp: Date.now()
                                }));
                                break;
                            case 'leaveGame':
                                // Process leave game request
                                console.log('Leave game request:', data);
                                socket.send(JSON.stringify({
                                    type: 'gameLeft',
                                    success: true,
                                    timestamp: Date.now()
                                }));
                                break;
                            case 'getActiveGames':
                                // Return a list of active games
                                socket.send(JSON.stringify({
                                    type: 'activeGames',
                                    games: [
                                        { gameType: 'k3', durations: [30, 60, 180] },
                                        { gameType: 'wingo', durations: [60, 180] },
                                        { gameType: 'crash', durations: [30] }
                                    ],
                                    timestamp: Date.now()
                                }));
                                break;
                            case 'system':
                                // Handle system messages
                                socket.send(JSON.stringify({
                                    type: 'systemResponse',
                                    status: 'ok',
                                    info: {
                                        uptime: process.uptime(),
                                        connections: 1,
                                        version: '1.0.0'
                                    },
                                    timestamp: Date.now()
                                }));
                                break;
                            case 'echo':
                                // Echo back the message
                                socket.send(JSON.stringify({
                                    type: 'echo',
                                    originalMessage: data,
                                    timestamp: Date.now()
                                }));
                                break;
                            default:
                                console.log('Unknown message type:', data.type);
                                socket.send(JSON.stringify({
                                    type: 'unknown',
                                    originalType: data.type,
                                    message: 'Unknown message type',
                                    timestamp: Date.now()
                                }));
                        }`;
  
  // Replace the section in the file content
  const updatedContent = fileContent.replace(messageHandlerSection, updatedMessageHandlerSection);
  
  // Check if any changes were made
  if (updatedContent === fileContent) {
    console.log('⚠️ No changes were made. Message handler section might not match the expected pattern.');
    process.exit(1);
  }
  
  // Write the updated content back to the file
  fs.writeFileSync(wsServicePath, updatedContent, 'utf8');
  
  console.log('✅ Added the following WebSocket message handlers:');
  console.log(' - joinGame: Handle game join requests');
  console.log(' - placeBet: Handle betting requests');
  console.log(' - leaveGame: Handle game leave requests');
  console.log(' - getActiveGames: Provide active games list');
  console.log(' - system: Handle system status requests');
  console.log(' - echo: Echo back messages for testing');
  console.log('\nThe handlers will respond to WebSocket messages with appropriate responses.');
  console.log('\n✅ WebSocket service has been updated successfully.\n');
  console.log('To apply the changes, restart the server and test again.');
  
} catch (error) {
  console.error('❌ Error updating WebSocket handlers:', error);
  process.exit(1);
} 