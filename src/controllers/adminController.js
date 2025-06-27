const { db } = require('../models/database');
const { validateLogin } = require('../middleware/auth');

// 管理员登录
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: '用户名和密码不能为空'
            });
        }
        
        // 验证登录信息
        const isValid = await validateLogin(username, password);
        
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: '用户名或密码错误'
            });
        }
        
        // 设置session
        req.session.isAdmin = true;
        req.session.adminUsername = username;
        req.session.loginTime = new Date();
        
        res.json({
            success: true,
            message: '登录成功',
            admin: {
                username: username,
                loginTime: req.session.loginTime
            }
        });
        
    } catch (error) {
        console.error('管理员登录时出错:', error);
        res.status(500).json({
            success: false,
            error: '登录失败',
            message: '服务器内部错误'
        });
    }
};

// 管理员退出
const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('退出登录时出错:', err);
            return res.status(500).json({
                success: false,
                error: '退出失败'
            });
        }
        
        res.json({
            success: true,
            message: '退出成功'
        });
    });
};

// 检查登录状态
const checkAuth = (req, res) => {
    if (req.session && req.session.isAdmin) {
        res.json({
            success: true,
            isLoggedIn: true,
            admin: {
                username: req.session.adminUsername,
                loginTime: req.session.loginTime
            }
        });
    } else {
        res.json({
            success: true,
            isLoggedIn: false
        });
    }
};

// 获取仪表板数据
const getDashboardData = (req, res) => {
    try {
        // 获取今日统计
        const today = new Date().toISOString().split('T')[0];
        
        // 并行执行多个查询
        const queries = [
            // 今日API调用数
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM api_logs WHERE DATE(created_at) = ?`,
                    [today],
                    (err, row) => err ? reject(err) : resolve({ todayApiCalls: row.count })
                );
            }),
            
            // 总API调用数
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM api_logs`,
                    (err, row) => err ? reject(err) : resolve({ totalApiCalls: row.count })
                );
            }),
            
            // 今日新反馈数
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM feedback WHERE DATE(created_at) = ?`,
                    [today],
                    (err, row) => err ? reject(err) : resolve({ todayFeedback: row.count })
                );
            }),
            
            // 总反馈数
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM feedback`,
                    (err, row) => err ? reject(err) : resolve({ totalFeedback: row.count })
                );
            }),
            
            // 今日新举报数
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM reports WHERE DATE(created_at) = ?`,
                    [today],
                    (err, row) => err ? reject(err) : resolve({ todayReports: row.count })
                );
            }),
            
            // 总举报数
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM reports`,
                    (err, row) => err ? reject(err) : resolve({ totalReports: row.count })
                );
            }),
            
            // 最近7天API调用趋势
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT DATE(created_at) as date, COUNT(*) as count 
                     FROM api_logs 
                     WHERE created_at >= datetime('now', '-7 days')
                     GROUP BY DATE(created_at)
                     ORDER BY date`,
                    (err, rows) => err ? reject(err) : resolve({ weeklyTrend: rows })
                );
            }),
            
            // 响应状态统计
            new Promise((resolve, reject) => {
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
                     WHERE created_at >= datetime('now', '-7 days')
                     GROUP BY status_group`,
                    (err, rows) => err ? reject(err) : resolve({ statusStats: rows })
                );
            }),
            
            // 平均响应时间
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT AVG(response_time) as avg_time FROM api_logs WHERE created_at >= datetime('now', '-1 day')`,
                    (err, row) => err ? reject(err) : resolve({ avgResponseTime: Math.round(row.avg_time || 0) })
                );
            })
        ];
        
        Promise.all(queries)
            .then(results => {
                // 合并所有结果
                const dashboardData = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
                
                res.json({
                    success: true,
                    data: dashboardData
                });
            })
            .catch(error => {
                console.error('获取仪表板数据失败:', error);
                res.status(500).json({
                    success: false,
                    error: '查询失败'
                });
            });
            
    } catch (error) {
        console.error('获取仪表板数据时出错:', error);
        res.status(500).json({
            success: false,
            error: '查询失败'
        });
    }
};

// 获取API调用日志
const getApiLogs = (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        
        // 获取总数
        db.get('SELECT COUNT(*) as total FROM api_logs', (err, countResult) => {
            if (err) {
                console.error('查询日志总数失败:', err);
                return res.status(500).json({
                    success: false,
                    error: '查询失败'
                });
            }
            
            // 获取分页数据
            db.all(
                `SELECT id, method, target_url, ip_address, user_agent, response_status, response_time, created_at
                 FROM api_logs 
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`,
                [limit, offset],
                (err, rows) => {
                    if (err) {
                        console.error('查询日志列表失败:', err);
                        return res.status(500).json({
                            success: false,
                            error: '查询失败'
                        });
                    }
                    
                    res.json({
                        success: true,
                        data: rows,
                        pagination: {
                            page,
                            limit,
                            total: countResult.total,
                            pages: Math.ceil(countResult.total / limit)
                        }
                    });
                }
            );
        });
        
    } catch (error) {
        console.error('获取API日志时出错:', error);
        res.status(500).json({
            success: false,
            error: '查询失败'
        });
    }
};

// 获取系统统计信息
const getSystemStats = (req, res) => {
    try {
        const queries = [
            // 最热门的目标域名
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT 
                        CASE 
                            WHEN target_url LIKE 'http://%' THEN SUBSTR(target_url, 8)
                            WHEN target_url LIKE 'https://%' THEN SUBSTR(target_url, 9)
                            ELSE target_url
                        END as domain,
                        COUNT(*) as count
                     FROM api_logs 
                     WHERE created_at >= datetime('now', '-30 days')
                     GROUP BY domain
                     ORDER BY count DESC
                     LIMIT 10`,
                    (err, rows) => err ? reject(err) : resolve({ topDomains: rows })
                );
            }),
            
            // 错误率最高的域名
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT 
                        CASE 
                            WHEN target_url LIKE 'http://%' THEN SUBSTR(target_url, 8)
                            WHEN target_url LIKE 'https://%' THEN SUBSTR(target_url, 9)
                            ELSE target_url
                        END as domain,
                        COUNT(*) as total_requests,
                        SUM(CASE WHEN response_status >= 400 THEN 1 ELSE 0 END) as error_requests,
                        ROUND(
                            (SUM(CASE WHEN response_status >= 400 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
                        ) as error_rate
                     FROM api_logs 
                     WHERE created_at >= datetime('now', '-30 days')
                     GROUP BY domain
                     HAVING COUNT(*) >= 10
                     ORDER BY error_rate DESC
                     LIMIT 10`,
                    (err, rows) => err ? reject(err) : resolve({ errorDomains: rows })
                );
            }),
            
            // 每小时请求量统计
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT 
                        strftime('%H', created_at) as hour,
                        COUNT(*) as count
                     FROM api_logs 
                     WHERE created_at >= datetime('now', '-7 days')
                     GROUP BY hour
                     ORDER BY hour`,
                    (err, rows) => err ? reject(err) : resolve({ hourlyStats: rows })
                );
            })
        ];
        
        Promise.all(queries)
            .then(results => {
                const statsData = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
                res.json({
                    success: true,
                    data: statsData
                });
            })
            .catch(error => {
                console.error('获取系统统计失败:', error);
                res.status(500).json({
                    success: false,
                    error: '查询失败'
                });
            });
            
    } catch (error) {
        console.error('获取系统统计时出错:', error);
        res.status(500).json({
            success: false,
            error: '查询失败'
        });
    }
};

module.exports = {
    login,
    logout,
    checkAuth,
    getDashboardData,
    getApiLogs,
    getSystemStats
}; 