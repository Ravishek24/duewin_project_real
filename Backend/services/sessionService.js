const crypto = require('crypto');
const { Op } = require('sequelize');

class SessionService {
    constructor(models) {
        this.UserSession = models.UserSession;
        this.SessionInvalidation = models.SessionInvalidation;
        this.User = models.User;
    }
    // Invalidate all previous sessions for a user
    async invalidateAllSessions(user_id, reason, newDeviceInfo = {}, transaction = null) {
        // Optimized: Get sessions and update in single query, batch create invalidations
        const activeSessions = await this.UserSession.findAll({
            where: { user_id, is_active: true },
            attributes: ['session_token', 'device_id'], // Only get what we need
            transaction
        });
        
        if (activeSessions.length === 0) return; // No sessions to invalidate
        
        // Update all sessions in single query
        await this.UserSession.update(
            { is_active: false },
            { where: { user_id, is_active: true }, transaction }
        );
        
        // Batch create invalidation records
        if (activeSessions.length > 0) {
            const invalidationRecords = activeSessions.map(session => ({
                user_id,
                invalidated_session_token: session.session_token,
                invalidated_device_id: session.device_id,
                reason,
                new_device_id: newDeviceInfo.device_id || null,
                new_ip_address: newDeviceInfo.ip_address || null
            }));
            
            await this.SessionInvalidation.bulkCreate(invalidationRecords, { transaction });
        }
    }
    // Create a new session (and invalidate previous) - optimized with transaction support
    async createSession(user_id, deviceInfo, req, transaction = null) {
        const session_token = this.generateSessionToken();
        const device_id = this.generateDeviceId(req);
        const now = new Date();
        const expires_at = new Date(now.getTime() + 5 * 60 * 60 * 1000); // 5h
        
        // If transaction provided, use it; otherwise create internal transaction
        const executeInTransaction = async (t) => {
            // Invalidate previous sessions first
            await this.invalidateAllSessions(user_id, 'new_login', deviceInfo, t);
            
            // Create new session
            await this.UserSession.create({
                user_id,
                session_token,
                device_id,
                device_info: deviceInfo,
                ip_address: req.ip,
                user_agent: req.headers['user-agent'],
                login_time: now,
                last_activity: now,
                expires_at,
                is_active: true,
                created_at: now,
                updated_at: now
            }, { transaction: t });
            
            return { session_token, device_id, expires_at };
        };
        
        if (transaction) {
            // Use provided transaction directly - no nesting
            return await executeInTransaction(transaction);
        } else {
            // Create internal transaction for atomic operation
            return await this.UserSession.sequelize.transaction(executeInTransaction);
        }
    }
    // Validate session token and activity
    async validateSession(session_token, req) {
        const session = await this.UserSession.findOne({
            where: { session_token, is_active: true }
        });
        if (!session) return { valid: false, reason: 'session_not_found' };
        if (new Date() > session.expires_at) {
            await this.invalidateSession(session.id, 'expired');
            return { valid: false, reason: 'session_expired' };
        }
        // Optionally: check device_id matches
        await session.update({ last_activity: new Date() });
        return { valid: true, session };
    }
    // Invalidate a single session
    async invalidateSession(session_id, reason) {
        const session = await this.UserSession.findByPk(session_id);
        if (session && session.is_active) {
            await session.update({ is_active: false });
            await this.SessionInvalidation.create({
                user_id: session.user_id,
                invalidated_session_token: session.session_token,
                invalidated_device_id: session.device_id,
                reason
            });
        }
    }
    // Generate device ID
    generateDeviceId(req) {
        const fingerprint = {
            userAgent: req.headers['user-agent'],
            acceptLanguage: req.headers['accept-language'],
            acceptEncoding: req.headers['accept-encoding'],
            ip: req.ip
        };
        return crypto.createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex');
    }
    // Generate session token
    generateSessionToken() {
        return crypto.randomBytes(32).toString('hex');
    }
}

module.exports = (models) => new SessionService(models);