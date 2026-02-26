const express = require('express');
const path = require('path');
const router = express.Router();
const { 
    login, 
    logout, 
    checkAuth, 
    getDashboardData, 
    getApiLogs, 
    getSystemStats 
} = require('../controllers/adminController');
const { 
    getFeedback, 
    getReports, 
    deleteFeedback, 
    deleteReport 
} = require('../controllers/feedbackController');
const { authenticateAdmin } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const { 
    addToBlacklist, 
    addReportToBlacklist, 
    getBlacklistEntries, 
    removeFromBlacklist 
} = require('../utils/blacklist');

// 登录页面（不需要认证）
router.get('/login', (req, res) => {
    // 如果已经登录，重定向到仪表板
    if (req.session && req.session.isAdmin) {
        return res.redirect('/admin/dashboard');
    }
    res.sendFile(path.join(__dirname, '../../public/admin/login.html'));
});

// 登录相关路由（不需要认证）
router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/check-auth', checkAuth);

// 以下路由需要管理员认证
router.use(authenticateAdmin);

// 仪表板页面
router.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin/dashboard.html'));
});

// 反馈管理页面
router.get('/feedback', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin/feedback.html'));
});

// 举报管理页面
router.get('/reports', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin/reports.html'));
});

// API日志页面
router.get('/logs', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin/logs.html'));
});

// 黑名单管理页面
router.get('/blacklist', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin/blacklist.html'));
});

// 系统信息页面
router.get('/system', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin/dashboard.html'));
});

// 仪表板数据API
router.get('/dashboard/data', getDashboardData);

// API日志数据API
router.get('/logs/data', getApiLogs);

// 系统统计API
router.get('/system/stats', getSystemStats);

// 反馈管理API
router.get('/feedback/data', getFeedback);
router.get('/feedback/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { db } = require('../models/database');
        
        db.get(
            'SELECT * FROM feedback WHERE id = ?',
            [id],
            (err, row) => {
                if (err) {
                    console.error('获取反馈详情失败:', err);
                    return res.status(500).json({
                        success: false,
                        error: '查询失败'
                    });
                }
                
                if (!row) {
                    return res.status(404).json({
                        success: false,
                        error: '反馈不存在'
                    });
                }
                
                res.json({
                    success: true,
                    data: row
                });
            }
        );
    } catch (error) {
        console.error('获取反馈详情失败:', error);
        res.status(500).json({
            success: false,
            error: '查询失败'
        });
    }
});
router.delete('/feedback/:id', deleteFeedback);
router.put('/feedback/:id/processed', async (req, res) => {
    try {
        const { id } = req.params;
        const { db } = require('../models/database');
        
        db.run(
            'UPDATE feedback SET status = ? WHERE id = ?',
            ['processed', id],
            function(err) {
                if (err) {
                    console.error('标记反馈已处理失败:', err);
                    return res.status(500).json({
                        success: false,
                        error: '操作失败'
                    });
                }
                
                if (this.changes > 0) {
                    res.json({
                        success: true,
                        message: '已标记为已处理'
                    });
                } else {
                    res.status(404).json({
                        success: false,
                        error: '反馈不存在'
                    });
                }
            }
        );
    } catch (error) {
        console.error('标记反馈已处理失败:', error);
        res.status(500).json({
            success: false,
            error: '操作失败'
        });
    }
});

// 举报管理API
router.get('/reports/data', getReports);
router.get('/reports/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { db } = require('../models/database');
        
        db.get(
            'SELECT * FROM reports WHERE id = ?',
            [id],
            (err, row) => {
                if (err) {
                    console.error('获取举报详情失败:', err);
                    return res.status(500).json({
                        success: false,
                        error: '查询失败'
                    });
                }
                
                if (!row) {
                    return res.status(404).json({
                        success: false,
                        error: '举报不存在'
                    });
                }
                
                res.json({
                    success: true,
                    data: row
                });
            }
        );
    } catch (error) {
        console.error('获取举报详情失败:', error);
        res.status(500).json({
            success: false,
            error: '查询失败'
        });
    }
});
router.delete('/reports/:id', deleteReport);
router.put('/reports/:id/processed', async (req, res) => {
    try {
        const { id } = req.params;
        const { db } = require('../models/database');
        
        db.run(
            'UPDATE reports SET status = ? WHERE id = ?',
            ['processed', id],
            function(err) {
                if (err) {
                    console.error('标记举报已处理失败:', err);
                    return res.status(500).json({
                        success: false,
                        error: '操作失败'
                    });
                }
                
                if (this.changes > 0) {
                    res.json({
                        success: true,
                        message: '已标记为已处理'
                    });
                } else {
                    res.status(404).json({
                        success: false,
                        error: '举报不存在'
                    });
                }
            }
        );
    } catch (error) {
        console.error('标记举报已处理失败:', error);
        res.status(500).json({
            success: false,
            error: '操作失败'
        });
    }
});

// 举报加入黑名单
router.post('/reports/:id/blacklist', addReportToBlacklist);

// 黑名单管理API
router.get('/blacklist/data', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const { db } = require('../models/database');
        
        // 并行查询统计数据和分页数据
        const statsQueries = [
            // 总黑名单数
            new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM blacklist WHERE expires_at IS NULL OR expires_at > datetime("now")', (err, row) => {
                    if (err) reject(err);
                    else resolve({ total: row.count });
                });
            }),
            // 今日添加数
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM blacklist WHERE DATE(created_at) = DATE('now')`,
                    (err, row) => {
                        if (err) reject(err);
                        else resolve({ today: row.count });
                    }
                );
            }),
            // 自动添加数
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM blacklist WHERE added_by = 'system' AND (expires_at IS NULL OR expires_at > datetime('now'))`,
                    (err, row) => {
                        if (err) reject(err);
                        else resolve({ auto: row.count });
                    }
                );
            }),
            // 手动添加数
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM blacklist WHERE added_by != 'system' AND (expires_at IS NULL OR expires_at > datetime('now'))`,
                    (err, row) => {
                        if (err) reject(err);
                        else resolve({ manual: row.count });
                    }
                );
            }),
            // 分页数据
            getBlacklistEntries(page, limit)
        ];
        
        const results = await Promise.all(statsQueries);
        const blacklistResult = results[4];
        
        res.json({
            success: true,
            data: blacklistResult.data,
            stats: {
                total: results[0].total,
                today: results[1].today,
                auto: results[2].auto,
                manual: results[3].manual
            },
            pagination: blacklistResult.pagination
        });
    } catch (error) {
        console.error('获取黑名单失败:', error);
        res.status(500).json({
            success: false,
            error: '获取黑名单失败'
        });
    }
});

// 手动添加到黑名单
router.post('/blacklist', async (req, res) => {
    try {
        const { ip_address, reason } = req.body;
        
        if (!ip_address || !reason) {
            return res.status(400).json({
                success: false,
                error: 'IP地址和原因不能为空'
            });
        }
        
        // 创建一个假的request对象来模拟
        const fakeReq = {
            ip: ip_address,
            get: () => 'Manual Add',
            connection: { remoteAddress: ip_address }
        };
        
        const result = await addToBlacklist(fakeReq, reason, req.session.adminUsername);
        
        res.json({
            success: true,
            message: '已成功添加到黑名单',
            data: result
        });
    } catch (error) {
        console.error('添加黑名单失败:', error);
        res.status(500).json({
            success: false,
            error: '添加失败'
        });
    }
});

// 从黑名单移除
router.delete('/blacklist/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await removeFromBlacklist(id);
        
        if (result.success && result.changes > 0) {
            res.json({
                success: true,
                message: '已从黑名单移除'
            });
        } else {
            res.status(404).json({
                success: false,
                error: '记录不存在'
            });
        }
    } catch (error) {
        console.error('移除黑名单失败:', error);
        res.status(500).json({
            success: false,
            error: '移除失败'
        });
    }
});

module.exports = router; 