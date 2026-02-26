const crypto = require('crypto');
const { db } = require('../models/database');

// 内存缓存用于临时黑名单（避免频繁查询数据库）
const tempBlacklistCache = new Map();

// 请求失败计数器（用于自动黑名单）
const failureCounter = new Map();

// 配置
const BLACKLIST_DURATION = (parseInt(process.env.BLACKLIST_DURATION) || 3600) * 1000; // 默认1小时（毫秒）
const AUTO_BLACKLIST_THRESHOLD = parseInt(process.env.AUTO_BLACKLIST_THRESHOLD) || 10; // 失败阈值
const AUTO_BLACKLIST_WINDOW = (parseInt(process.env.AUTO_BLACKLIST_WINDOW) || 300) * 1000; // 检查窗口（毫秒）

// 生成设备指纹
function generateDeviceFingerprint(req) {
    const userAgent = req.get('User-Agent') || '';
    const acceptLanguage = req.get('Accept-Language') || '';
    const acceptEncoding = req.get('Accept-Encoding') || '';
    const connection = req.get('Connection') || '';
    
    const fingerprint = `${userAgent}|${acceptLanguage}|${acceptEncoding}|${connection}`;
    return crypto.createHash('sha256').update(fingerprint).digest('hex').substring(0, 32);
}

// 生成User-Agent哈希
function generateUserAgentHash(userAgent) {
    return crypto.createHash('sha256').update(userAgent || '').digest('hex');
}

// 获取客户端真实IP
function getClientIP(req) {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           '127.0.0.1';
}

// 清理过期的临时黑名单条目
function cleanupExpiredTempBlacklist() {
    const now = Date.now();
    for (const [key, entry] of tempBlacklistCache.entries()) {
        if (entry.expiresAt < now) {
            tempBlacklistCache.delete(key);
        }
    }
}

// 添加到临时黑名单
function addToTempBlacklist(ip, reason = '自动拦截', duration = BLACKLIST_DURATION) {
    const expiresAt = Date.now() + duration;
    tempBlacklistCache.set(ip, {
        ip,
        reason,
        createdAt: Date.now(),
        expiresAt,
        isTemporary: true
    });
    
    // 同时添加到数据库持久化
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT OR REPLACE INTO blacklist 
             (ip_address, reason, added_by, expires_at) 
             VALUES (?, ?, 'system', datetime('now', '+${Math.floor(duration / 1000)} seconds'))`,
            [ip, reason],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        success: true,
                        id: this.lastID,
                        ip,
                        reason,
                        expiresAt: new Date(expiresAt)
                    });
                }
            }
        );
    });
}

// 检查临时黑名单
function checkTempBlacklist(ip) {
    cleanupExpiredTempBlacklist();
    const entry = tempBlacklistCache.get(ip);
    if (entry && entry.expiresAt > Date.now()) {
        return {
            isBlacklisted: true,
            reason: entry.reason,
            expiresAt: entry.expiresAt,
            isTemporary: true
        };
    }
    return { isBlacklisted: false };
}

// 记录请求失败（用于自动黑名单）
function recordFailure(ip, reason = '请求失败') {
    const now = Date.now();
    const windowStart = now - AUTO_BLACKLIST_WINDOW;
    
    if (!failureCounter.has(ip)) {
        failureCounter.set(ip, []);
    }
    
    const failures = failureCounter.get(ip);
    failures.push({ timestamp: now, reason });
    
    // 清理窗口期外的记录
    const recentFailures = failures.filter(f => f.timestamp > windowStart);
    failureCounter.set(ip, recentFailures);
    
    // 检查是否达到黑名单阈值
    if (recentFailures.length >= AUTO_BLACKLIST_THRESHOLD) {
        return addToTempBlacklist(ip, `自动黑名单: ${recentFailures.length}次失败请求`);
    }
    
    return Promise.resolve({ isBlacklisted: false, failureCount: recentFailures.length });
}

// 检查是否在黑名单中（包括临时黑名单和数据库黑名单）
function checkBlacklist(req) {
    return new Promise((resolve, reject) => {
        const ip = getClientIP(req);
        const userAgent = req.get('User-Agent') || '';
        const userAgentHash = generateUserAgentHash(userAgent);
        const deviceFingerprint = generateDeviceFingerprint(req);
        
        // 首先检查内存中的临时黑名单
        const tempCheck = checkTempBlacklist(ip);
        if (tempCheck.isBlacklisted) {
            return resolve(tempCheck);
        }
        
        // 检查数据库中的黑名单（包括已过期的）
        db.get(
            `SELECT * FROM blacklist 
             WHERE (ip_address = ? OR user_agent_hash = ? OR device_fingerprint = ?)
             AND (expires_at IS NULL OR expires_at > datetime('now'))
             LIMIT 1`,
            [ip, userAgentHash, deviceFingerprint],
            (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        isBlacklisted: !!row,
                        reason: row ? row.reason : null,
                        blacklistEntry: row,
                        isTemporary: row ? row.added_by === 'system' : false
                    });
                }
            }
        );
    });
}

// 添加到黑名单
function addToBlacklist(req, reason = '违规行为', addedBy = 'admin', duration = null) {
    return new Promise((resolve, reject) => {
        const ip = getClientIP(req);
        const userAgent = req.get('User-Agent') || '';
        const userAgentHash = generateUserAgentHash(userAgent);
        const deviceFingerprint = generateDeviceFingerprint(req);
        
        // 如果有duration，添加到临时黑名单
        if (duration) {
            return addToTempBlacklist(ip, reason, duration).then(resolve).catch(reject);
        }
        
        // 永久黑名单
        db.run(
            `INSERT OR REPLACE INTO blacklist 
             (ip_address, user_agent_hash, device_fingerprint, reason, added_by) 
             VALUES (?, ?, ?, ?, ?)`,
            [ip, userAgentHash, deviceFingerprint, reason, addedBy],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        success: true,
                        id: this.lastID,
                        ip,
                        reason,
                        isPermanent: true
                    });
                }
            }
        );
    });
}

// 从URL获取举报信息并添加到黑名单
function addReportToBlacklist(reportId, addedBy = 'admin', duration = null) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM reports WHERE id = ?', [reportId], (err, report) => {
            if (err || !report) {
                return reject(new Error('举报不存在'));
            }
            
            try {
                const url = new URL(report.target_url);
                const domain = url.hostname;
                
                const expiresClause = duration 
                    ? `, expires_at = datetime('now', '+${Math.floor(duration / 1000)} seconds')` 
                    : '';
                
                db.run(
                    `INSERT OR REPLACE INTO blacklist 
                     (ip_address, reason, added_by${expiresClause ? ', expires_at' : ''}) 
                     VALUES (?, ?, ?${expiresClause ? ', ' + expiresClause.replace(', expires_at = ', '') : ''})`,
                    [domain, `举报URL: ${report.reason} - ${report.description}`, addedBy],
                    function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({
                                success: true,
                                id: this.lastID,
                                domain,
                                reason: report.reason,
                                isTemporary: !!duration
                            });
                        }
                    }
                );
            } catch (urlError) {
                reject(new Error('无效的URL格式'));
            }
        });
    });
}

// 获取黑名单列表
function getBlacklistEntries(page = 1, limit = 20, includeExpired = false) {
    return new Promise((resolve, reject) => {
        const offset = (page - 1) * limit;
        
        let whereClause = includeExpired ? '' : "WHERE expires_at IS NULL OR expires_at > datetime('now')";
        
        // 获取总数
        db.get(`SELECT COUNT(*) as total FROM blacklist ${whereClause}`, (err, countResult) => {
            if (err) {
                return reject(err);
            }
            
            // 获取分页数据
            db.all(
                `SELECT *, 
                    CASE 
                        WHEN expires_at IS NULL THEN 'permanent'
                        WHEN expires_at > datetime('now') THEN 'temporary'
                        ELSE 'expired'
                    END as status
                 FROM blacklist 
                 ${whereClause}
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`,
                [limit, offset],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            data: rows,
                            pagination: {
                                page,
                                limit,
                                total: countResult.total,
                                totalPages: Math.ceil(countResult.total / limit)
                            }
                        });
                    }
                }
            );
        });
    });
}

// 从黑名单移除
function removeFromBlacklist(id) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM blacklist WHERE id = ?', [id], function(err) {
            if (err) {
                reject(err);
            } else {
                // 同时从内存缓存中移除
                for (const [key, entry] of tempBlacklistCache.entries()) {
                    if (entry.id === id) {
                        tempBlacklistCache.delete(key);
                        break;
                    }
                }
                resolve({
                    success: true,
                    changes: this.changes
                });
            }
        });
    });
}

// 定期清理任务（每5分钟执行一次）
setInterval(() => {
    cleanupExpiredTempBlacklist();
    
    // 清理过期的数据库黑名单记录
    db.run("DELETE FROM blacklist WHERE expires_at IS NOT NULL AND expires_at < datetime('now')", (err) => {
        if (err) {
            console.error('清理过期黑名单记录失败:', err);
        }
    });
}, 5 * 60 * 1000);

module.exports = {
    generateDeviceFingerprint,
    generateUserAgentHash,
    getClientIP,
    checkBlacklist,
    addToBlacklist,
    addToTempBlacklist,
    addReportToBlacklist,
    getBlacklistEntries,
    removeFromBlacklist,
    recordFailure,
    checkTempBlacklist,
    tempBlacklistCache,
    failureCounter
}; 
