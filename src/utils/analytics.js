const { db } = require('../models/database');

// 记录访问统计
const recordAccessStats = (req, responseStatus, responseTime) => {
    return new Promise((resolve, reject) => {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const hour = now.getHours();
        const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
        const endpoint = req.path || req.url;
        const method = req.method;
        const isError = responseStatus >= 400;

        // 使用 INSERT OR REPLACE 来更新统计
        db.run(
            `INSERT INTO access_stats (date, hour, ip_address, endpoint, method, request_count, avg_response_time, error_count)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?)
             ON CONFLICT(date, hour, ip_address, endpoint) 
             DO UPDATE SET 
                request_count = request_count + 1,
                avg_response_time = ((avg_response_time * (request_count - 1)) + ?) / request_count,
                error_count = error_count + ?`,
            [date, hour, ip, endpoint, method, responseTime, isError ? 1 : 0, responseTime, isError ? 1 : 0],
            (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
};

// 获取访问统计概览
const getAccessStatsOverview = (days = 7) => {
    return new Promise((resolve, reject) => {
        const queries = [
            // 总请求数
            new Promise((res, rej) => {
                db.get(
                    `SELECT SUM(request_count) as total FROM access_stats WHERE date >= date('now', '-${days} days')`,
                    (err, row) => err ? rej(err) : res({ totalRequests: row.total || 0 })
                );
            }),
            // 错误数
            new Promise((res, rej) => {
                db.get(
                    `SELECT SUM(error_count) as total FROM access_stats WHERE date >= date('now', '-${days} days')`,
                    (err, row) => err ? rej(err) : res({ totalErrors: row.total || 0 })
                );
            }),
            // 独立IP数
            new Promise((res, rej) => {
                db.get(
                    `SELECT COUNT(DISTINCT ip_address) as count FROM access_stats WHERE date >= date('now', '-${days} days')`,
                    (err, row) => err ? rej(err) : res({ uniqueIPs: row.count || 0 })
                );
            }),
            // 平均响应时间
            new Promise((res, rej) => {
                db.get(
                    `SELECT AVG(avg_response_time) as avg_time FROM access_stats WHERE date >= date('now', '-${days} days')`,
                    (err, row) => err ? rej(err) : res({ avgResponseTime: Math.round(row.avg_time || 0) })
                );
            }),
            // 每日趋势
            new Promise((res, rej) => {
                db.all(
                    `SELECT date, SUM(request_count) as count, SUM(error_count) as errors
                     FROM access_stats 
                     WHERE date >= date('now', '-${days} days')
                     GROUP BY date
                     ORDER BY date`,
                    (err, rows) => err ? rej(err) : res({ dailyTrend: rows })
                );
            }),
            // 热门端点
            new Promise((res, rej) => {
                db.all(
                    `SELECT endpoint, SUM(request_count) as count
                     FROM access_stats 
                     WHERE date >= date('now', '-${days} days')
                     GROUP BY endpoint
                     ORDER BY count DESC
                     LIMIT 10`,
                    (err, rows) => err ? rej(err) : res({ topEndpoints: rows })
                );
            }),
            // 状态码分布
            new Promise((res, rej) => {
                db.all(
                    `SELECT 
                        CASE 
                            WHEN response_status >= 200 AND response_status < 300 THEN 'success'
                            WHEN response_status >= 400 AND response_status < 500 THEN 'client_error'
                            WHEN response_status >= 500 THEN 'server_error'
                            ELSE 'other'
                        END as status_group,
                        COUNT(*) as count
                     FROM api_logs 
                     WHERE created_at >= datetime('now', '-${days} days')
                     GROUP BY status_group`,
                    (err, rows) => err ? rej(err) : res({ statusDistribution: rows })
                );
            })
        ];

        Promise.all(queries)
            .then(results => {
                const stats = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
                resolve(stats);
            })
            .catch(reject);
    });
};

// 获取详细统计（按小时）
const getHourlyStats = (date) => {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT hour, 
                    SUM(request_count) as total_requests,
                    SUM(error_count) as total_errors,
                    AVG(avg_response_time) as avg_response_time
             FROM access_stats 
             WHERE date = ?
             GROUP BY hour
             ORDER BY hour`,
            [date],
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            }
        );
    });
};

// 获取IP统计
const getIPStats = (limit = 20) => {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT ip_address, 
                    SUM(request_count) as total_requests,
                    SUM(error_count) as total_errors,
                    AVG(avg_response_time) as avg_response_time,
                    COUNT(DISTINCT endpoint) as unique_endpoints
             FROM access_stats 
             WHERE date >= date('now', '-7 days')
             GROUP BY ip_address
             ORDER BY total_requests DESC
             LIMIT ?`,
            [limit],
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            }
        );
    });
};

// 清理旧统计数据
const cleanupOldStats = (retentionDays = 30) => {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM access_stats WHERE date < date('now', '-${retentionDays} days')`,
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ deleted: this.changes });
                }
            }
        );
    });
};

module.exports = {
    recordAccessStats,
    getAccessStatsOverview,
    getHourlyStats,
    getIPStats,
    cleanupOldStats
};
