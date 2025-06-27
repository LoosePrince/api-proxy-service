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

// 配置EJS模板引擎
router.use((req, res, next) => {
    const app = req.app;
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
    next();
});

// 登录页面（不需要认证）
router.get('/login', (req, res) => {
    // 如果已经登录，重定向到仪表板
    if (req.session && req.session.isAdmin) {
        return res.redirect('/admin/dashboard');
    }
    res.render('login');
});

// 登录相关路由（不需要认证）
router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/check-auth', checkAuth);

// 以下路由需要管理员认证
router.use(authenticateAdmin);

// 仪表板页面
router.get('/dashboard', (req, res) => {
    res.render('admin/dashboard', {
        title: '管理仪表板',
        admin: {
            username: req.session.adminUsername,
            loginTime: req.session.loginTime
        }
    });
});

// 仪表板数据API
router.get('/dashboard/data', getDashboardData);

// 反馈管理页面
router.get('/feedback', (req, res) => {
    res.render('admin/feedback', {
        title: '反馈管理',
        admin: {
            username: req.session.adminUsername,
            loginTime: req.session.loginTime
        }
    });
});

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
                    console.error('查询反馈详情失败:', err);
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
        console.error('获取反馈详情时出错:', error);
        res.status(500).json({
            success: false,
            error: '服务器错误'
        });
    }
});
router.put('/feedback/:id/processed', async (req, res) => {
    try {
        const { id } = req.params;
        const { db } = require('../models/database');
        
        db.run(
            'UPDATE feedback SET status = ? WHERE id = ?',
            ['processed', id],
            function(err) {
                if (err) {
                    console.error('更新反馈状态失败:', err);
                    return res.status(500).json({
                        success: false,
                        error: '更新失败'
                    });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({
                        success: false,
                        error: '反馈不存在'
                    });
                }
                
                res.json({
                    success: true,
                    message: '状态更新成功'
                });
            }
        );
    } catch (error) {
        console.error('更新反馈状态时出错:', error);
        res.status(500).json({
            success: false,
            error: '服务器错误'
        });
    }
});
router.delete('/feedback/:id', deleteFeedback);

// 举报管理页面
router.get('/reports', (req, res) => {
    res.render('admin/reports', {
        title: '举报管理',
        admin: {
            username: req.session.adminUsername,
            loginTime: req.session.loginTime
        }
    });
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
                    console.error('查询举报详情失败:', err);
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
        console.error('获取举报详情时出错:', error);
        res.status(500).json({
            success: false,
            error: '服务器错误'
        });
    }
});
router.put('/reports/:id/processed', async (req, res) => {
    try {
        const { id } = req.params;
        const { db } = require('../models/database');
        
        db.run(
            'UPDATE reports SET status = ? WHERE id = ?',
            ['processed', id],
            function(err) {
                if (err) {
                    console.error('更新举报状态失败:', err);
                    return res.status(500).json({
                        success: false,
                        error: '更新失败'
                    });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({
                        success: false,
                        error: '举报不存在'
                    });
                }
                
                res.json({
                    success: true,
                    message: '状态更新成功'
                });
            }
        );
    } catch (error) {
        console.error('更新举报状态时出错:', error);
        res.status(500).json({
            success: false,
            error: '服务器错误'
        });
    }
});
router.post('/reports/:id/blacklist', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await addReportToBlacklist(id, req.session.adminUsername);
        
        if (result.success) {
            res.json({
                success: true,
                message: `已将 ${result.domain} 加入黑名单，原因：${result.reason}`
            });
        } else {
            res.status(400).json({
                success: false,
                error: '加入黑名单失败'
            });
        }
    } catch (error) {
        console.error('加入黑名单时出错:', error);
        res.status(500).json({
            success: false,
            error: error.message || '服务器错误'
        });
    }
});
router.delete('/reports/:id', deleteReport);

// API日志页面
router.get('/logs', (req, res) => {
    res.render('admin/logs', {
        title: 'API 日志',
        admin: {
            username: req.session.adminUsername,
            loginTime: req.session.loginTime
        }
    });
});

// API日志数据
router.get('/logs/data', getApiLogs);
router.get('/logs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { db } = require('../models/database');
        
        db.get(
            'SELECT * FROM api_logs WHERE id = ?',
            [id],
            (err, row) => {
                if (err) {
                    console.error('查询日志详情失败:', err);
                    return res.status(500).json({
                        success: false,
                        error: '查询失败'
                    });
                }
                
                if (!row) {
                    return res.status(404).json({
                        success: false,
                        error: '日志不存在'
                    });
                }
                
                res.json({
                    success: true,
                    data: row
                });
            }
        );
    } catch (error) {
        console.error('获取日志详情时出错:', error);
        res.status(500).json({
            success: false,
            error: '服务器错误'
        });
    }
});
router.delete('/logs/clear', async (req, res) => {
    try {
        const { db } = require('../models/database');
        
        db.run('DELETE FROM api_logs', function(err) {
            if (err) {
                console.error('清除日志失败:', err);
                return res.status(500).json({
                    success: false,
                    error: '清除失败'
                });
            }
            
            res.json({
                success: true,
                message: `已清除 ${this.changes} 条日志记录`
            });
        });
    } catch (error) {
        console.error('清除日志时出错:', error);
        res.status(500).json({
            success: false,
            error: '服务器错误'
        });
    }
});

// 系统统计
router.get('/stats', getSystemStats);

// 系统信息
router.get('/system', (req, res) => {
    const os = require('os');
    const process = require('process');
    
    res.json({
        success: true,
        data: {
            system: {
                platform: os.platform(),
                arch: os.arch(),
                cpus: os.cpus().length,
                totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
                freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
                uptime: Math.round(os.uptime() / 3600 * 100) / 100 + ' hours'
            },
            node: {
                version: process.version,
                uptime: Math.round(process.uptime() / 3600 * 100) / 100 + ' hours',
                memory: {
                    rss: Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100 + ' MB',
                    heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100 + ' MB',
                    heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100 + ' MB'
                }
            },
            environment: {
                nodeEnv: process.env.NODE_ENV || 'development',
                port: process.env.PORT || 3000
            }
        }
    });
});

// 黑名单管理页面
router.get('/blacklist', (req, res) => {
    res.render('admin/blacklist', {
        title: '黑名单管理',
        admin: {
            username: req.session.adminUsername,
            loginTime: req.session.loginTime
        }
    });
});

// 黑名单管理API
router.get('/blacklist/data', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        
        const result = await getBlacklistEntries(page, limit);
        
        res.json({
            success: true,
            data: result.data,
            pagination: result.pagination
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