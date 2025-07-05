// Fastify version of game routes
const fastify = require('fastify')({ logger: true });

// Import the same services
const gameLogicService = require('./services/gameLogicService');

// Fastify schema definitions for validation
const gameSchemas = {
    // Parameter schemas
    gameTypeParamSchema: {
        type: 'object',
        properties: {
            gameType: {
                type: 'string',
                enum: ['wingo', 'trx_wix', 'k3', '5d', 'fiveD']
            },
            duration: {
                type: 'string',
                pattern: '^[0-9]+$'
            }
        },
        required: ['gameType', 'duration']
    },
    
    // Query schemas
    historyQuerySchema: {
        type: 'object',
        properties: {
            page: {
                type: 'string',
                pattern: '^[0-9]+$',
                default: '1'
            },
            limit: {
                type: 'string',
                pattern: '^[0-9]+$',
                default: '10'
            },
            offset: {
                type: 'string',
                pattern: '^[0-9]+$'
            }
        }
    },
    
    // Bet request schema
    betRequestSchema: {
        type: 'object',
        required: ['betType', 'betValue', 'amount'],
        properties: {
            betType: {
                type: 'string',
                enum: ['number', 'color', 'size', 'parity', 'dice', 'sum', 'pair', 'triple', 'straight', 'sum_size', 'sum_parity']
            },
            betValue: {
                oneOf: [
                    { type: 'string' },
                    { type: 'number' }
                ]
            },
            amount: {
                type: 'number',
                minimum: 1
            }
        }
    },
    
    // Response schemas
    successResponseSchema: {
        type: 'object',
        properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' }
        }
    },
    
    errorResponseSchema: {
        type: 'object',
        properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            error: { type: 'string' }
        }
    },
    
    // Game result schema
    gameResultSchema: {
        type: 'object',
        properties: {
            periodId: { type: 'string' },
            result: { type: 'object' },
            createdAt: { type: 'string' },
            gameType: { type: 'string' },
            duration: { type: 'number' }
        }
    }
};

// Authentication hook (equivalent to Express middleware)
async function authenticate(request, reply) {
    try {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return reply.code(401).send({
                success: false,
                message: 'No token provided'
            });
        }

        // Import JWT and verify token
        const jwt = require('jsonwebtoken');
        const config = require('./config/config');
        
        const decoded = jwt.verify(token, config.jwtSecret);
        request.user = decoded;
        
    } catch (error) {
        return reply.code(401).send({
            success: false,
            message: 'Invalid token'
        });
    }
}

// Phone verification hook
async function requirePhoneVerification(request, reply) {
    if (!request.user.is_phone_verified) {
        return reply.code(403).send({
            success: false,
            message: 'Phone verification required'
        });
    }
}

// Rate limiting hook (simplified version)
async function rateLimit(request, reply) {
    // This is a simplified rate limiter
    // In production, you'd use fastify-rate-limit plugin
    const userId = request.user?.user_id;
    if (!userId) {
        return reply.code(401).send({
            success: false,
            message: 'Authentication required'
        });
    }
    
    // Add your rate limiting logic here
    // For now, we'll just pass through
}

// Register game routes
async function gameRoutes(fastify, options) {
    
    /**
     * ======================
     * PUBLIC ROUTES (No Auth)
     * ======================
     */
    
    // Get last result for a specific game and duration
    fastify.get('/:gameType/:duration/last-result', {
        schema: {
            params: gameSchemas.gameTypeParamSchema,
            response: {
                200: gameSchemas.successResponseSchema,
                400: gameSchemas.errorResponseSchema,
                500: gameSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            const { gameType, duration } = request.params;
            
            // Validate game type
            const validGameTypes = ['wingo', 'trx_wix', 'k3', '5d', 'fiveD'];
            if (!validGameTypes.includes(gameType.toLowerCase())) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid game type. Valid types: wingo, trx_wix, k3, 5d'
                });
            }

            // Validate duration
            const validDurations = {
                'wingo': [30, 60, 180, 300],
                'trx_wix': [30, 60, 180, 300],
                'k3': [60, 180, 300, 600],
                '5d': [60, 180, 300, 600],
                'fiveD': [60, 180, 300, 600]
            };

            const durationNum = parseInt(duration);
            const gameTypeLower = gameType.toLowerCase();
            const mappedGameType = gameTypeLower === '5d' ? 'fiveD' : gameTypeLower;
            
            if (!validDurations[mappedGameType]?.includes(durationNum)) {
                return reply.code(400).send({
                    success: false,
                    message: `Invalid duration for ${gameType}. Valid durations: ${validDurations[mappedGameType]?.join(', ')}`
                });
            }

            const result = await gameLogicService.getLastResult(mappedGameType, durationNum);
            return reply.send(result);
        } catch (error) {
            fastify.log.error('Error getting last result:', error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to get last result'
            });
        }
    });

    // Get game history with pagination
    fastify.get('/:gameType/:duration/history', {
        schema: {
            params: gameSchemas.gameTypeParamSchema,
            querystring: gameSchemas.historyQuerySchema,
            response: {
                200: gameSchemas.successResponseSchema,
                400: gameSchemas.errorResponseSchema,
                500: gameSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            const { gameType, duration } = request.params;
            const { page = 1, limit = 10, offset } = request.query;
            
            // Validate parameters
            const validGameTypes = ['wingo', 'trx_wix', 'k3', '5d', 'fiveD'];
            if (!validGameTypes.includes(gameType.toLowerCase())) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid game type'
                });
            }

            const durationNum = parseInt(duration);
            const pageNum = parseInt(page);
            const limitNum = Math.min(parseInt(limit), 50); // Max 50 results per page
            const offsetNum = offset ? parseInt(offset) : (pageNum - 1) * limitNum;

            // Map game type
            const gameTypeLower = gameType.toLowerCase();
            const mappedGameType = gameTypeLower === '5d' ? 'fiveD' : gameTypeLower;

            fastify.log.info(`Getting history for ${mappedGameType}, duration ${durationNum}, limit ${limitNum}, offset ${offsetNum}`);

            const result = await gameLogicService.getGameHistory(
                mappedGameType,
                durationNum,
                limitNum,
                offsetNum
            );

            if (!result.success) {
                return reply.code(500).send(result);
            }

            // Format response consistently with enhanced data
            const formattedResults = result.data.results.map(item => {
                if (mappedGameType === 'trx_wix') {
                    return {
                        periodId: item.period || item.periodId,
                        result: {
                            number: item.result?.number,
                            color: item.result?.color,
                            size: item.result?.size,
                            parity: item.result?.parity || (item.result?.number % 2 === 0 ? 'even' : 'odd')
                        },
                        verification: {
                            hash: item.verification?.hash || item.verification_hash,
                            link: item.verification?.link || item.verification_link
                        },
                        createdAt: item.created_at || item.timestamp,
                        gameType: mappedGameType,
                        duration: durationNum
                    };
                } else if (mappedGameType === 'wingo') {
                    return {
                        periodId: item.bet_number || item.periodId,
                        result: {
                            number: item.result_of_number || item.result?.number,
                            color: item.result_of_color || item.result?.color,
                            size: item.result_of_size || item.result?.size,
                            parity: item.result?.parity || ((item.result_of_number || item.result?.number) % 2 === 0 ? 'even' : 'odd')
                        },
                        createdAt: item.created_at || item.timestamp,
                        gameType: mappedGameType,
                        duration: durationNum
                    };
                } else if (mappedGameType === 'k3') {
                    return {
                        periodId: item.bet_number || item.periodId,
                        result: {
                            dice_1: item.dice_1 || item.result?.dice_1,
                            dice_2: item.dice_2 || item.result?.dice_2,
                            dice_3: item.dice_3 || item.result?.dice_3,
                            sum: item.sum || item.result?.sum,
                            has_pair: item.has_pair || item.result?.has_pair,
                            has_triple: item.has_triple || item.result?.has_triple,
                            is_straight: item.is_straight || item.result?.is_straight,
                            sum_size: item.sum_size || item.result?.sum_size,
                            sum_parity: item.sum_parity || item.result?.sum_parity
                        },
                        createdAt: item.created_at || item.timestamp,
                        gameType: mappedGameType,
                        duration: durationNum
                    };
                } else if (mappedGameType === 'fiveD') {
                    return {
                        periodId: item.bet_number || item.periodId,
                        result: {
                            A: item.result_a || item.result?.A,
                            B: item.result_b || item.result?.B,
                            C: item.result_c || item.result?.C,
                            D: item.result_d || item.result?.D,
                            E: item.result_e || item.result?.E,
                            sum: item.total_sum || item.result?.sum
                        },
                        createdAt: item.created_at || item.timestamp,
                        gameType: mappedGameType,
                        duration: durationNum
                    };
                }
                return item;
            });

            return reply.send({
                success: true,
                data: {
                    results: formattedResults,
                    pagination: {
                        total: result.data.pagination.total,
                        page: pageNum,
                        limit: limitNum,
                        offset: offsetNum,
                        hasMore: result.data.pagination.hasMore,
                        totalPages: Math.ceil(result.data.pagination.total / limitNum)
                    }
                },
                gameType: mappedGameType,
                duration: durationNum
            });

        } catch (error) {
            fastify.log.error('Error getting game history:', error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to get game history',
                error: error.message
            });
        }
    });

    /**
     * ======================
     * AUTHENTICATED ROUTES
     * ======================
     */
    
    // Place bet
    fastify.post('/:gameType/:duration/bet', {
        preHandler: [authenticate, requirePhoneVerification, rateLimit],
        schema: {
            params: gameSchemas.gameTypeParamSchema,
            body: gameSchemas.betRequestSchema,
            response: {
                200: gameSchemas.successResponseSchema,
                400: gameSchemas.errorResponseSchema,
                401: gameSchemas.errorResponseSchema,
                403: gameSchemas.errorResponseSchema,
                500: gameSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            const { gameType, duration } = request.params;
            const { betType, betValue, amount } = request.body;
            const userId = request.user.user_id;

            fastify.log.info(`Bet request: User ${userId}, Game: ${gameType}, Duration: ${duration}, Type: ${betType}, Value: ${betValue}, Amount: ${amount}`);

            // Validate game type and duration
            const validGameTypes = ['wingo', 'trx_wix', 'k3', '5d', 'fiveD'];
            if (!validGameTypes.includes(gameType.toLowerCase())) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid game type'
                });
            }

            const durationNum = parseInt(duration);
            const gameTypeLower = gameType.toLowerCase();
            const mappedGameType = gameTypeLower === '5d' ? 'fiveD' : gameTypeLower;

            // Validate bet type and value based on game type
            const validationResult = validateBetTypeAndValue(mappedGameType, betType, betValue);
            if (!validationResult.valid) {
                return reply.code(400).send({
                    success: false,
                    message: validationResult.message
                });
            }

            // Store bet in database
            const betData = {
                userId,
                gameType: mappedGameType,
                duration: durationNum,
                betType,
                betValue,
                amount,
                timestamp: new Date()
            };

            const result = await storeBetInDatabase(betData);
            
            if (result.success) {
                return reply.send(result);
            } else {
                return reply.code(400).send(result);
            }

        } catch (error) {
            fastify.log.error('Error placing bet:', error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to place bet',
                error: error.message
            });
        }
    });

    // Get user bets
    fastify.get('/:gameType/:duration/my-bets', {
        preHandler: [authenticate, requirePhoneVerification],
        schema: {
            params: gameSchemas.gameTypeParamSchema,
            querystring: gameSchemas.historyQuerySchema,
            response: {
                200: gameSchemas.successResponseSchema,
                400: gameSchemas.errorResponseSchema,
                401: gameSchemas.errorResponseSchema,
                403: gameSchemas.errorResponseSchema,
                500: gameSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            const { gameType, duration } = request.params;
            const { page = 1, limit = 10 } = request.query;
            const userId = request.user.user_id;

            // Validate game type
            const validGameTypes = ['wingo', 'trx_wix', 'k3', '5d', 'fiveD'];
            if (!validGameTypes.includes(gameType.toLowerCase())) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid game type'
                });
            }

            const durationNum = parseInt(duration);
            const pageNum = parseInt(page);
            const limitNum = Math.min(parseInt(limit), 50);
            const gameTypeLower = gameType.toLowerCase();
            const mappedGameType = gameTypeLower === '5d' ? 'fiveD' : gameTypeLower;

            const result = await getUserBets(userId, mappedGameType, durationNum, {
                page: pageNum,
                limit: limitNum
            });

            if (result.success) {
                return reply.send(result);
            } else {
                return reply.code(400).send(result);
            }

        } catch (error) {
            fastify.log.error('Error getting user bets:', error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to get user bets',
                error: error.message
            });
        }
    });
}

// Helper functions (these would be imported from your existing services)
function validateBetTypeAndValue(gameType, betType, betValue) {
    // This is a simplified validation - you'd implement your full validation logic here
    const validBetTypes = {
        'wingo': ['number', 'color', 'size', 'parity'],
        'trx_wix': ['number', 'color', 'size', 'parity'],
        'k3': ['dice', 'sum', 'pair', 'triple', 'straight', 'sum_size', 'sum_parity'],
        'fiveD': ['number', 'sum']
    };

    if (!validBetTypes[gameType]?.includes(betType)) {
        return {
            valid: false,
            message: `Invalid bet type for ${gameType}`
        };
    }

    return { valid: true };
}

async function storeBetInDatabase(betData) {
    // This would be your existing bet storage logic
    try {
        // Your database storage logic here
        return {
            success: true,
            message: 'Bet placed successfully',
            data: {
                betId: 'generated-bet-id',
                ...betData
            }
        };
    } catch (error) {
        return {
            success: false,
            message: 'Failed to store bet',
            error: error.message
        };
    }
}

async function getUserBets(userId, gameType, duration, options) {
    // This would be your existing user bets retrieval logic
    try {
        // Your database query logic here
        return {
            success: true,
            data: {
                bets: [],
                pagination: {
                    total: 0,
                    page: options.page,
                    limit: options.limit,
                    hasMore: false
                }
            }
        };
    } catch (error) {
        return {
            success: false,
            message: 'Failed to get user bets',
            error: error.message
        };
    }
}

module.exports = gameRoutes; 