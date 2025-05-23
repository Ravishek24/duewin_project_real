const { RateLimitViolation } = require('../models');
const { Op } = require('sequelize');

async function checkBlockedIPs() {
    try {
        console.log('Checking blocked IPs...');
        
        const blockedRecords = await RateLimitViolation.findAll({
            where: {
                is_blocked: true
            }
        });

        console.log('Blocked Records:', JSON.stringify(blockedRecords, null, 2));

        // Also check for specific IPs
        const specificIPs = ['51.21.47.178', '122.161.48.79'];
        const specificRecords = await RateLimitViolation.findAll({
            where: {
                ip_address: {
                    [Op.in]: specificIPs
                }
            }
        });

        console.log('\nRecords for specific IPs:', JSON.stringify(specificRecords, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

checkBlockedIPs(); 