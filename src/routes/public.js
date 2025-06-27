const express = require('express');
const router = express.Router();
const { submitFeedback, submitReport } = require('../controllers/feedbackController');
const { feedbackLimiter } = require('../middleware/rateLimit');
const { checkBlacklistForForms } = require('../middleware/blacklist');

// 提交反馈（应用限流和黑名单检查）
router.post('/feedback', checkBlacklistForForms, feedbackLimiter, submitFeedback);

// 提交举报（应用限流和黑名单检查）
router.post('/report', checkBlacklistForForms, feedbackLimiter, submitReport);

// 获取反馈原因选项
router.get('/report/reasons', (req, res) => {
    res.json({
        success: true,
        data: [
            { value: 'spam', label: '垃圾信息' },
            { value: 'illegal', label: '违法内容' },
            { value: 'abuse', label: '滥用服务' },
            { value: 'copyright', label: '版权侵犯' },
            { value: 'other', label: '其他原因' }
        ]
    });
});

module.exports = router; 