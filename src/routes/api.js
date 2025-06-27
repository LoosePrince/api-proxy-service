const express = require('express');
const router = express.Router();
const { handleProxy, handleOptions } = require('../controllers/proxyController');
const { apiLimiter } = require('../middleware/rateLimit');
const { logApiCall } = require('../middleware/logger');
const { checkRequestSize } = require('../utils/security');
const { checkBlacklistForAPI, logSuspiciousActivity } = require('../middleware/blacklist');

// 应用中间件
router.use(logSuspiciousActivity);  // 记录可疑活动
router.use(apiLimiter);
router.use(logApiCall);
router.use(checkRequestSize(parseInt(process.env.MAX_REQUEST_SIZE) || 1));

// 处理OPTIONS请求（CORS预检）
router.options('/proxy', handleOptions);

// API中转路由 - 应用黑名单检查
router.get('/proxy', checkBlacklistForAPI, handleProxy);
router.post('/proxy', checkBlacklistForAPI, handleProxy);
router.put('/proxy', checkBlacklistForAPI, handleProxy);
router.delete('/proxy', checkBlacklistForAPI, handleProxy);
router.patch('/proxy', checkBlacklistForAPI, handleProxy);

// API信息路由
router.get('/info', (req, res) => {
    res.json({
        name: 'API中转服务',
        version: '1.0.0',
        description: '一个轻量级的 Node.js API 中转服务',
        endpoints: {
            proxy: '/api/proxy',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            parameters: {
                url: '目标URL (必需)'
            }
        },
        limits: {
            requestSize: `${process.env.MAX_REQUEST_SIZE || 1}MB`,
            rateLimit: `${process.env.RATE_LIMIT_MAX || 100} 请求每 ${process.env.RATE_LIMIT_WINDOW || 15} 分钟`
        },
        support: {
            feedback: '/feedback.html',
            report: '/report.html'
        }
    });
});

// 健康检查
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
    });
});

module.exports = router; 