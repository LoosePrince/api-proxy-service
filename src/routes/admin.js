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