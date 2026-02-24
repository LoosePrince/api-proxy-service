const axios = require('axios');
const { validateProxyRequest } = require('../utils/validator');
const { isUrlBlacklisted, filterSensitiveHeaders } = require('../utils/security');
const { db } = require('../models/database');

// 缓存白名单
let domainWhitelist = null;
let lastWhitelistUpdate = 0;
const WHITELIST_CACHE_TTL = 60000; // 1分钟缓存

const getWhitelist = () => {
    return new Promise((resolve, reject) => {
        const now = Date.now();
        if (domainWhitelist && (now - lastWhitelistUpdate < WHITELIST_CACHE_TTL)) {
            return resolve(domainWhitelist);
        }

        db.all('SELECT domain FROM whitelist', [], (err, rows) => {
            if (err) return resolve(domainWhitelist || []); // 报错则使用旧缓存或空
            domainWhitelist = rows.map(r => r.domain.toLowerCase());
            lastWhitelistUpdate = now;
            resolve(domainWhitelist);
        });
    });
};

const isDomainAllowed = async (url) => {
    // 如果没有启用白名单限制（环境变量控制），则允许所有
    if (process.env.WHITELIST_ENABLED !== 'true') return true;

    try {
        const urlObj = new URL(url);
        const host = urlObj.hostname.toLowerCase();
        const whitelist = await getWhitelist();

        // 如果白名单为空且启用了白名单，则拒绝所有
        if (whitelist.length === 0) return false;

        // 检查域名或其父域名是否在白名单中
        return whitelist.some(domain => {
            return host === domain || host.endsWith('.' + domain);
        });
    } catch (e) {
        return false;
    }
};

// API中转处理
const handleProxy = async (req, res) => {
    try {
        // 获取目标URL，直接使用HTTP请求的方法
        const targetUrl = req.query.url;
        const method = req.method.toUpperCase();
        
        // 验证请求数据
        const validation = validateProxyRequest({ url: targetUrl });
        if (!validation.isValid) {
            return res.status(400).json({
                error: '请求参数无效',
                details: validation.errors
            });
        }
        
        // 验证HTTP方法
        const { isValidHttpMethod } = require('../utils/validator');
        if (!isValidHttpMethod(method)) {
            return res.status(400).json({
                error: 'HTTP方法无效',
                message: `不支持的HTTP方法: ${method}`
            });
        }
        
        // 检查URL黑名单
        if (isUrlBlacklisted(targetUrl)) {
            return res.status(403).json({
                error: '禁止访问',
                message: '不允许访问该类型的URL'
            });
        }

        // 检查域名白名单
        const isAllowed = await isDomainAllowed(targetUrl);
        if (!isAllowed) {
            return res.status(403).json({
                error: '访问受限',
                message: '该域名未在允许的白名单中'
            });
        }
        
        // 准备请求配置
        const axiosConfig = {
            method: method,
            url: targetUrl,
            timeout: 30000, // 30秒超时
            maxRedirects: 5,
            validateStatus: () => true, // 接受所有状态码
            headers: {}
        };
        
        // 转发请求头（过滤敏感信息）
        const allowedHeaders = [
            'accept',
            'accept-language',
            'content-type',
            'user-agent',
            'referer'
        ];
        
        Object.keys(req.headers).forEach(header => {
            if (allowedHeaders.includes(header.toLowerCase())) {
                axiosConfig.headers[header] = req.headers[header];
            }
        });
        
        // 添加请求体（对于POST、PUT等方法）
        if (['POST', 'PUT', 'PATCH'].includes(method) && req.body) {
            // 直接使用请求体数据，不再需要过滤URL和method字段
            axiosConfig.data = req.body;
        }
        
        // 发送请求
        const startTime = Date.now();
        const response = await axios(axiosConfig);
        const responseTime = Date.now() - startTime;
        
        // 设置响应头
        res.status(response.status);
        
        // 转发安全的响应头
        const safeHeaders = [
            'content-type',
            'content-length',
            'cache-control',
            'expires',
            'last-modified',
            'etag'
        ];
        
        safeHeaders.forEach(header => {
            if (response.headers[header]) {
                res.set(header, response.headers[header]);
            }
        });
        
        // 添加CORS头
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // 添加响应时间头
        res.set('X-Response-Time', `${responseTime}ms`);
        res.set('X-Proxy-Service', 'API-Proxy-Service');
        
        // 返回响应数据
        res.send(response.data);
        
    } catch (error) {
        console.error('代理请求失败:', error.message);
        
        // 处理不同类型的错误
        if (error.code === 'ENOTFOUND') {
            return res.status(404).json({
                error: '目标地址未找到',
                message: '无法解析目标URL的域名'
            });
        }
        
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: '连接被拒绝',
                message: '目标服务器拒绝连接'
            });
        }
        
        if (error.code === 'ETIMEDOUT') {
            return res.status(504).json({
                error: '请求超时',
                message: '目标服务器响应超时'
            });
        }
        
        if (error.response) {
            // 目标服务器返回了错误响应
            return res.status(error.response.status).json({
                error: '目标服务器错误',
                message: `目标服务器返回 ${error.response.status} 错误`,
                details: error.response.statusText
            });
        }
        
        // 其他未知错误
        res.status(500).json({
            error: '代理服务器内部错误',
            message: '处理代理请求时发生错误'
        });
    }
};

// 处理OPTIONS请求（CORS预检）
const handleOptions = (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '86400'); // 24小时
    res.status(200).end();
};

module.exports = {
    handleProxy,
    handleOptions,
    isDomainAllowed
}; 