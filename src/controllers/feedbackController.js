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
        
        // 并行查询统计数据和分页数据
        const statsQueries = [
            // 总反馈数
            new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM feedback', (err, row) => {
                    if (err) reject(err);
                    else resolve({ total: row.count });
                });
            }),
            // 今日反馈数
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM feedback WHERE DATE(created_at) = DATE('now')`,
                    (err, row) => {
                        if (err) reject(err);
                        else resolve({ today: row.count });
                    }
                );
            }),
            // 已处理反馈数
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM feedback WHERE status = 'processed'`,
                    (err, row) => {
                        if (err) reject(err);
                        else resolve({ processed: row.count });
                    }
                );
            }),
            // 待处理反馈数
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM feedback WHERE status = 'pending'`,
                    (err, row) => {
                        if (err) reject(err);
                        else resolve({ pending: row.count });
                    }
                );
            }),
            // 分页数据
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, name, email, message, status, created_at 
                     FROM feedback 
                     ORDER BY created_at DESC 
                     LIMIT ? OFFSET ?`,
                    [limit, offset],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve({ rows });
                    }
                );
            }),
            // 总数（用于分页）
            new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM feedback', (err, row) => {
                    if (err) reject(err);
                    else resolve({ totalCount: row.count });
                });
            })
        ];
        
        Promise.all(statsQueries)
            .then(results => {
                const stats = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
                
                res.json({
                    success: true,
                    data: stats.rows,
                    stats: {
                        total: stats.total,
                        today: stats.today,
                        processed: stats.processed,
                        pending: stats.pending
                    },
                    pagination: {
                        page,
                        limit,
                        total: stats.totalCount,
                        pages: Math.ceil(stats.totalCount / limit)
                    }
                });
            })
            .catch(err => {
                console.error('查询反馈失败:', err);
                res.status(500).json({
                    success: false,
                    error: '查询失败'
                });
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
        
        // 并行查询统计数据和分页数据
        const statsQueries = [
            // 总举报数
            new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM reports', (err, row) => {
                    if (err) reject(err);
                    else resolve({ total: row.count });
                });
            }),
            // 今日举报数
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM reports WHERE DATE(created_at) = DATE('now')`,
                    (err, row) => {
                        if (err) reject(err);
                        else resolve({ today: row.count });
                    }
                );
            }),
            // 已处理举报数
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM reports WHERE status = 'processed'`,
                    (err, row) => {
                        if (err) reject(err);
                        else resolve({ processed: row.count });
                    }
                );
            }),
            // 待处理举报数
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM reports WHERE status = 'pending'`,
                    (err, row) => {
                        if (err) reject(err);
                        else resolve({ pending: row.count });
                    }
                );
            }),
            // 分页数据
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, target_url, reason, description, reporter_email, status, created_at 
                     FROM reports 
                     ORDER BY created_at DESC 
                     LIMIT ? OFFSET ?`,
                    [limit, offset],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve({ rows });
                    }
                );
            }),
            // 总数（用于分页）
            new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM reports', (err, row) => {
                    if (err) reject(err);
                    else resolve({ totalCount: row.count });
                });
            })
        ];
        
        Promise.all(statsQueries)
            .then(results => {
                const stats = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
                
                res.json({
                    success: true,
                    data: stats.rows,
                    stats: {
                        total: stats.total,
                        today: stats.today,
                        processed: stats.processed,
                        pending: stats.pending
                    },
                    pagination: {
                        page,
                        limit,
                        total: stats.totalCount,
                        pages: Math.ceil(stats.totalCount / limit)
                    }
                });
            })
            .catch(err => {
                console.error('查询举报失败:', err);
                res.status(500).json({
                    success: false,
                    error: '查询失败'
                });
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

module.exports = {
    submitFeedback,
    submitReport,
    getFeedback,
    getReports,
    deleteFeedback,
    deleteReport
}; 