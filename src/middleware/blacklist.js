const { checkBlacklist, recordFailure, getClientIP } = require('../utils/blacklist');

// 黑名单检查中间件 - 用于表单提交
const checkBlacklistForForms = async (req, res, next) => {
    try {
        const result = await checkBlacklist(req);
        
        if (result.isBlacklisted) {
            // 记录尝试
            recordFailure(getClientIP(req), '黑名单用户尝试提交表单').catch(() => {});
            
            // 假装成功，但实际不保存
            return res.json({
                success: true,
                message: '提交成功，我们会尽快处理！',
                id: Math.floor(Math.random() * 10000)
            });
        }
        
        next();
    } catch (error) {
        // 出错时继续执行，不影响正常用户
        next();
    }
};

// 黑名单检查中间件 - 用于API中转
const checkBlacklistForAPI = async (req, res, next) => {
    try {
        const result = await checkBlacklist(req);
        
        if (result.isBlacklisted) {
            // 记录尝试
            recordFailure(getClientIP(req), '黑名单用户尝试使用API').catch(() => {});
            
            // 根据黑名单类型返回不同响应
            if (result.isTemporary) {
                return res.status(403).json({
                    error: '访问受限',
                    message: '您的IP已被临时限制访问，请稍后再试',
                    expiresAt: result.expiresAt,
                    isTemporary: true
                });
            }
            
            // 永久黑名单 - 模拟超时
            setTimeout(() => {
                res.status(408).json({
                    error: '请求超时',
                    message: '目标服务器响应超时，请稍后重试',
                    timestamp: new Date().toISOString()
                });
            }, 5000 + Math.random() * 5000);
            
            return;
        }
        
        next();
    } catch (error) {
        // 出错时继续执行，不影响正常用户
        next();
    }
};

// 记录可疑行为的中间件
const logSuspiciousActivity = async (req, res, next) => {
    try {
        const ip = getClientIP(req);
        const userAgent = req.get('User-Agent') || '';
        
        // 检查是否有可疑行为模式
        const suspiciousPatterns = [
            /bot|crawler|spider|scraper/i,
            /automation|selenium|puppeteer/i,
            /hack|exploit|attack|sqlmap|nmap/i,
            /\.\./, // 路径遍历尝试
            /\/etc\/passwd/i,
            /\/windows\/system32/i
        ];
        
        const isSuspicious = suspiciousPatterns.some(pattern => 
            pattern.test(userAgent) || pattern.test(req.path) || pattern.test(JSON.stringify(req.query))
        );
        
        if (isSuspicious) {
            // 记录可疑活动
            recordFailure(ip, '检测到可疑活动模式').then(result => {
                if (result.isBlacklisted) {
                    // 已自动加入黑名单
                }
            }).catch(() => {});
        }
        
        next();
    } catch (error) {
        next();
    }
};

module.exports = {
    checkBlacklistForForms,
    checkBlacklistForAPI,
    logSuspiciousActivity
}; 
