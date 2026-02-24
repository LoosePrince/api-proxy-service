const express = require('express');
const path = require('path');
const router = express.Router();
const { 
    login, 
    logout, 
    checkAuth, 
    getDashboardData, 
    getApiLogs, 
    getSystemStats,
    getLogDetail,
    clearLogs,
    getWhitelist,
    addToWhitelist,
    removeFromWhitelist
} = require('../controllers/adminController');
const { 
    getFeedback, 
    getReports, 
    deleteFeedback, 
    deleteReport,
    getFeedbackDetail,
    markFeedbackProcessed,
    getReportDetail,
    markReportProcessed
} = require('../controllers/feedbackController');
const { authenticateAdmin } = require('../middleware/auth');
const { convertToCSV } = require('../utils/csvExport');
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

// 白名单管理页面
router.get('/whitelist', (req, res) => {
    res.render('admin/whitelist', {
        title: '白名单管理',
        whitelistEnabled: process.env.WHITELIST_ENABLED === 'true',
        admin: {
            username: req.session.adminUsername,
            loginTime: req.session.loginTime
        }
    });
});

// 白名单管理API
router.get('/whitelist/data', getWhitelist);
router.post('/whitelist', addToWhitelist);
router.delete('/whitelist/:id', removeFromWhitelist);

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
router.get('/feedback/:id', getFeedbackDetail);
router.put('/feedback/:id/processed', markFeedbackProcessed);
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
router.get('/reports/:id', getReportDetail);
router.put('/reports/:id/processed', markReportProcessed);
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
router.get('/logs/:id', getLogDetail);
router.delete('/logs/clear', clearLogs);

// 系统统计
router.get('/stats', getSystemStats);

// 导出 API 日志 CSV
router.get('/logs/export', async (req, res) => {
    try {
        const { db } = require('../models/database');
        db.all('SELECT * FROM api_logs ORDER BY created_at DESC LIMIT 5000', (err, rows) => {
            if (err) throw err;

            const headers = [
                { key: 'id', label: 'ID' },
                { key: 'method', label: 'Method' },
                { key: 'target_url', label: 'Target URL' },
                { key: 'ip_address', label: 'Source IP' },
                { key: 'response_status', label: 'Status' },
                { key: 'response_time', label: 'Duration(ms)' },
                { key: 'created_at', label: 'Time' }
            ];

            const csv = convertToCSV(rows, headers);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=api_logs.csv');
            res.status(200).send('\uFEFF' + csv); // 添加 BOM 以支持 Excel 中文显示
        });
    } catch (error) {
        res.status(500).json({ success: false, error: '导出失败' });
    }
});

// 导出举报 CSV
router.get('/reports/export', async (req, res) => {
    try {
        const { db } = require('../models/database');
        db.all('SELECT * FROM reports ORDER BY created_at DESC', (err, rows) => {
            if (err) throw err;
            const headers = [
                { key: 'id', label: 'ID' },
                { key: 'target_url', label: 'Target URL' },
                { key: 'reason', label: 'Reason' },
                { key: 'description', label: 'Description' },
                { key: 'reporter_email', label: 'Reporter' },
                { key: 'status', label: 'Status' },
                { key: 'created_at', label: 'Time' }
            ];
            const csv = convertToCSV(rows, headers);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=reports.csv');
            res.status(200).send('\uFEFF' + csv);
        });
    } catch (error) {
        res.status(500).json({ success: false, error: '导出失败' });
    }
});

// 导出反馈 CSV
router.get('/feedback/export', async (req, res) => {
    try {
        const { db } = require('../models/database');
        db.all('SELECT * FROM feedback ORDER BY created_at DESC', (err, rows) => {
            if (err) throw err;
            const headers = [
                { key: 'id', label: 'ID' },
                { key: 'name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'message', label: 'Message' },
                { key: 'status', label: 'Status' },
                { key: 'created_at', label: 'Time' }
            ];
            const csv = convertToCSV(rows, headers);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=feedback.csv');
            res.status(200).send('\uFEFF' + csv);
        });
    } catch (error) {
        res.status(500).json({ success: false, error: '导出失败' });
    }
});

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