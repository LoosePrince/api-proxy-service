const crypto = require('crypto');
const { db } = require('../models/database');

// 生成设备指纹
function generateDeviceFingerprint(req) {
    const userAgent = req.get('User-Agent') || '';
    const acceptLanguage = req.get('Accept-Language') || '';
    const acceptEncoding = req.get('Accept-Encoding') || '';
    const connection = req.get('Connection') || '';
    
    // 组合多个请求头生成设备指纹
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

// 检查是否在黑名单中
function checkBlacklist(req) {
    return new Promise((resolve, reject) => {
        const ip = getClientIP(req);
        const userAgent = req.get('User-Agent') || '';
        const userAgentHash = generateUserAgentHash(userAgent);
        const deviceFingerprint = generateDeviceFingerprint(req);
        
        console.log('黑名单检查:', { ip, userAgentHash: userAgentHash.substring(0, 16) + '...', deviceFingerprint });
        
        // 检查IP或设备指纹是否在黑名单中
        db.get(
            `SELECT * FROM blacklist 
             WHERE ip_address = ? 
             OR user_agent_hash = ? 
             OR device_fingerprint = ?
             LIMIT 1`,
            [ip, userAgentHash, deviceFingerprint],
            (err, row) => {
                if (err) {
                    console.error('黑名单检查失败:', err);
                    reject(err);
                } else {
                    resolve({
                        isBlacklisted: !!row,
                        reason: row ? row.reason : null,
                        blacklistEntry: row
                    });
                }
            }
        );
    });
}

// 添加到黑名单
function addToBlacklist(req, reason = '违规行为', addedBy = 'admin') {
    return new Promise((resolve, reject) => {
        const ip = getClientIP(req);
        const userAgent = req.get('User-Agent') || '';
        const userAgentHash = generateUserAgentHash(userAgent);
        const deviceFingerprint = generateDeviceFingerprint(req);
        
        db.run(
            `INSERT OR REPLACE INTO blacklist 
             (ip_address, user_agent_hash, device_fingerprint, reason, added_by) 
             VALUES (?, ?, ?, ?, ?)`,
            [ip, userAgentHash, deviceFingerprint, reason, addedBy],
            function(err) {
                if (err) {
                    console.error('添加黑名单失败:', err);
                    reject(err);
                } else {
                    console.log(`已添加到黑名单: IP=${ip}, 原因=${reason}`);
                    resolve({
                        success: true,
                        id: this.lastID,
                        ip: ip,
                        reason: reason
                    });
                }
            }
        );
    });
}

// 从URL获取举报信息并添加到黑名单
function addReportToBlacklist(reportId, addedBy = 'admin') {
    return new Promise((resolve, reject) => {
        // 先获取举报信息
        db.get('SELECT * FROM reports WHERE id = ?', [reportId], (err, report) => {
            if (err || !report) {
                return reject(new Error('举报不存在'));
            }
            
            // 从target_url提取域名或IP，添加到黑名单
            try {
                const url = new URL(report.target_url);
                const domain = url.hostname;
                
                db.run(
                    `INSERT OR REPLACE INTO blacklist 
                     (ip_address, reason, added_by) 
                     VALUES (?, ?, ?)`,
                    [domain, `举报URL: ${report.reason} - ${report.description}`, addedBy],
                    function(err) {
                        if (err) {
                            console.error('添加URL黑名单失败:', err);
                            reject(err);
                        } else {
                            console.log(`已添加URL到黑名单: ${domain}`);
                            resolve({
                                success: true,
                                id: this.lastID,
                                domain: domain,
                                reason: report.reason
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
function getBlacklistEntries(page = 1, limit = 20) {
    return new Promise((resolve, reject) => {
        const offset = (page - 1) * limit;
        
        // 获取总数
        db.get('SELECT COUNT(*) as total FROM blacklist', (err, countResult) => {
            if (err) {
                return reject(err);
            }
            
            // 获取分页数据
            db.all(
                `SELECT * FROM blacklist 
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
                resolve({
                    success: true,
                    changes: this.changes
                });
            }
        });
    });
}

module.exports = {
    generateDeviceFingerprint,
    generateUserAgentHash,
    getClientIP,
    checkBlacklist,
    addToBlacklist,
    addReportToBlacklist,
    getBlacklistEntries,
    removeFromBlacklist
}; 