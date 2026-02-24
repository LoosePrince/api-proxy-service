const { db } = require('../models/database');
const { validateFeedback, validateReport } = require('../utils/validator');
const { sanitizeInput } = require('../utils/validator');

// 提交反馈
const submitFeedback = (req, res) => {
    try {
        const { name, email, message } = req.body;
        
        // 验证数据
        const validation = validateFeedback({ name, email, message });
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: '数据验证失败',
                details: validation.errors
            });
        }
        
        // 清理输入数据
        const cleanData = {
            name: name ? sanitizeInput(name) : null,
            email: email ? sanitizeInput(email) : null,
            message: sanitizeInput(message)
        };
        
        // 插入数据库
        db.run(
            `INSERT INTO feedback (name, email, message) VALUES (?, ?, ?)`,
            [cleanData.name, cleanData.email, cleanData.message],
            function(err) {
                if (err) {
                    console.error('保存反馈失败:', err);
                    return res.status(500).json({
                        success: false,
                        error: '保存反馈失败',
                        message: '服务器内部错误'
                    });
                }
                
                res.json({
                    success: true,
                    message: '反馈提交成功，感谢您的意见！',
                    id: this.lastID
                });
            }
        );
        
    } catch (error) {
        console.error('处理反馈提交时出错:', error);
        res.status(500).json({
            success: false,
            error: '处理失败',
            message: '服务器内部错误'
        });
    }
};

// 提交举报
const submitReport = (req, res) => {
    try {
        const { target_url, reason, description, reporter_email } = req.body;
        
        // 验证数据
        const validation = validateReport({ target_url, reason, description, reporter_email });
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: '数据验证失败',
                details: validation.errors
            });
        }
        
        // 清理输入数据
        const cleanData = {
            target_url: sanitizeInput(target_url),
            reason: sanitizeInput(reason),
            description: description ? sanitizeInput(description) : null,
            reporter_email: reporter_email ? sanitizeInput(reporter_email) : null
        };
        
        // 插入数据库
        db.run(
            `INSERT INTO reports (target_url, reason, description, reporter_email) VALUES (?, ?, ?, ?)`,
            [cleanData.target_url, cleanData.reason, cleanData.description, cleanData.reporter_email],
            function(err) {
                if (err) {
                    console.error('保存举报失败:', err);
                    return res.status(500).json({
                        success: false,
                        error: '保存举报失败',
                        message: '服务器内部错误'
                    });
                }
                
                res.json({
                    success: true,
                    message: '举报提交成功，我们会尽快处理！',
                    id: this.lastID
                });
            }
        );
        
    } catch (error) {
        console.error('处理举报提交时出错:', error);
        res.status(500).json({
            success: false,
            error: '处理失败',
            message: '服务器内部错误'
        });
    }
};

// 获取反馈列表（管理员）
const getFeedback = (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        // 获取总数
        db.get('SELECT COUNT(*) as total FROM feedback', (err, countResult) => {
            if (err) {
                console.error('查询反馈总数失败:', err);
                return res.status(500).json({
                    success: false,
                    error: '查询失败'
                });
            }
            
            // 获取分页数据
            db.all(
                `SELECT id, name, email, message, status, created_at 
                 FROM feedback 
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`,
                [limit, offset],
                (err, rows) => {
                    if (err) {
                        console.error('查询反馈列表失败:', err);
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
        console.error('获取反馈列表时出错:', error);
        res.status(500).json({
            success: false,
            error: '查询失败'
        });
    }
};

// 获取举报列表（管理员）
const getReports = (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        // 获取总数
        db.get('SELECT COUNT(*) as total FROM reports', (err, countResult) => {
            if (err) {
                console.error('查询举报总数失败:', err);
                return res.status(500).json({
                    success: false,
                    error: '查询失败'
                });
            }
            
            // 获取分页数据
            db.all(
                `SELECT id, target_url, reason, description, reporter_email, status, created_at 
                 FROM reports 
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`,
                [limit, offset],
                (err, rows) => {
                    if (err) {
                        console.error('查询举报列表失败:', err);
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
        console.error('获取举报列表时出错:', error);
        res.status(500).json({
            success: false,
            error: '查询失败'
        });
    }
};

// 删除反馈（管理员）
const deleteFeedback = (req, res) => {
    try {
        const { id } = req.params;
        
        db.run('DELETE FROM feedback WHERE id = ?', [id], function(err) {
            if (err) {
                console.error('删除反馈失败:', err);
                return res.status(500).json({
                    success: false,
                    error: '删除失败'
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
                message: '反馈删除成功'
            });
        });
        
    } catch (error) {
        console.error('删除反馈时出错:', error);
        res.status(500).json({
            success: false,
            error: '删除失败'
        });
    }
};

// 删除举报（管理员）
const deleteReport = (req, res) => {
    try {
        const { id } = req.params;
        
        db.run('DELETE FROM reports WHERE id = ?', [id], function(err) {
            if (err) {
                console.error('删除举报失败:', err);
                return res.status(500).json({
                    success: false,
                    error: '删除失败'
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
                message: '举报删除成功'
            });
        });
        
    } catch (error) {
        console.error('删除举报时出错:', error);
        res.status(500).json({
            success: false,
            error: '删除失败'
        });
    }
};

// 获取单个反馈详情
const getFeedbackDetail = (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM feedback WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ success: false, error: '查询失败' });
        if (!row) return res.status(404).json({ success: false, error: '未找到' });
        res.json({ success: true, data: row });
    });
};

// 更新反馈状态为已处理
const markFeedbackProcessed = (req, res) => {
    const { id } = req.params;
    db.run('UPDATE feedback SET status = ? WHERE id = ?', ['processed', id], function(err) {
        if (err) return res.status(500).json({ success: false, error: '更新失败' });
        res.json({ success: true, message: '已标记为已处理' });
    });
};

// 获取单个举报详情
const getReportDetail = (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM reports WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ success: false, error: '查询失败' });
        if (!row) return res.status(404).json({ success: false, error: '未找到' });
        res.json({ success: true, data: row });
    });
};

// 更新举报状态为已处理
const markReportProcessed = (req, res) => {
    const { id } = req.params;
    db.run('UPDATE reports SET status = ? WHERE id = ?', ['processed', id], function(err) {
        if (err) return res.status(500).json({ success: false, error: '更新失败' });
        res.json({ success: true, message: '已标记为已处理' });
    });
};

module.exports = {
    submitFeedback,
    submitReport,
    getFeedback,
    getReports,
    deleteFeedback,
    deleteReport,
    getFeedbackDetail,
    markFeedbackProcessed,
    getReportDetail,
    markReportProcessed
}; 