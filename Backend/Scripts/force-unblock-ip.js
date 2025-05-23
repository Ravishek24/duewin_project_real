const { RateLimitViolation } = require('../models');
const { Op } = require('sequelize');

async function forceUnblockIPs() {
    try {
        const ipsToUnblock = ['51.21.47.178', '122.161.48.79'];
        
        console.log('Forcefully unblocking IPs:', ipsToUnblock);
        
        // First, delete all records for these IPs
        const deleteResult = await RateLimitViolation.destroy({
            where: {
                ip_address: {
                    [Op.in]: ipsToUnblock
                }
            }
        });
        
        console.log(`Deleted ${deleteResult} records for specified IPs`);
        
        // Then, update any remaining blocked records to unblocked
        const updateResult = await RateLimitViolation.update(
            {
                is_blocked: false,
                unblocked_at: new Date(),
                unblocked_by: 'system'
            },
            {
                where: {
                    ip_address: {
                        [Op.in]: ipsToUnblock
                    },
                    is_blocked: true
                }
            }
        );
        
        console.log(`Updated ${updateResult[0]} records to unblocked state`);
        
        // Verify the IPs are not blocked
        const remainingRecords = await RateLimitViolation.findAll({
            where: {
                ip_address: {
                    [Op.in]: ipsToUnblock
                }
            }
        });
        
        console.log('\nRemaining records for specified IPs:', JSON.stringify(remainingRecords, null, 2));
        
    } catch (error) {
        console.error('Error:', error);
    }
}

forceUnblockIPs(); 