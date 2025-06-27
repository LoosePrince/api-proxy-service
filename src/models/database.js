const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 确保数据目录存在
const dataDir = path.dirname(process.env.DB_PATH || './data/app.db');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
const dbPath = process.env.DB_PATH || './data/app.db';
const db = new sqlite3.Database(dbPath);

// 初始化数据库表
const initializeDatabase = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // 创建用户反馈表
            db.run(`
                CREATE TABLE IF NOT EXISTS feedback (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(100),
                    email VARCHAR(255),
                    message TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // 创建举报信息表
            db.run(`
                CREATE TABLE IF NOT EXISTS reports (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    target_url TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    description TEXT,
                    reporter_email VARCHAR(255),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // 创建API调用日志表
            db.run(`
                CREATE TABLE IF NOT EXISTS api_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    method VARCHAR(10) NOT NULL,
                    target_url TEXT NOT NULL,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    response_status INTEGER,
                    response_time INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // 创建黑名单表
            db.run(`
                CREATE TABLE IF NOT EXISTS blacklist (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ip_address VARCHAR(45),
                    user_agent_hash VARCHAR(64),
                    device_fingerprint VARCHAR(128),
                    reason TEXT,
                    added_by VARCHAR(50) DEFAULT 'system',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(ip_address, user_agent_hash)
                )
            `);

            // 添加status字段到现有表（如果不存在）
            db.run(`
                ALTER TABLE feedback ADD COLUMN status VARCHAR(20) DEFAULT 'pending'
            `, (err) => {
                // 忽略"列已存在"的错误
                if (err && !err.message.includes('duplicate column name')) {
                    console.error('添加feedback.status字段失败:', err);
                }
            });

            db.run(`
                ALTER TABLE reports ADD COLUMN status VARCHAR(20) DEFAULT 'pending'
            `, (err) => {
                // 忽略"列已存在"的错误
                if (err && !err.message.includes('duplicate column name')) {
                    console.error('添加reports.status字段失败:', err);
                } else {
                    console.log('数据库表初始化完成');
                    resolve();
                }
            });
        });
    });
};

// 关闭数据库连接
const closeDatabase = () => {
    return new Promise((resolve) => {
        db.close((err) => {
            if (err) {
                console.error('关闭数据库连接时出错:', err);
            } else {
                console.log('数据库连接已关闭');
            }
            resolve();
        });
    });
};

// 如果直接运行此文件，则初始化数据库
if (require.main === module) {
    require('dotenv').config();
    initializeDatabase()
        .then(() => {
            console.log('数据库初始化成功');
            process.exit(0);
        })
        .catch(err => {
            console.error('数据库初始化失败:', err);
            process.exit(1);
        });
}

module.exports = {
    db,
    initializeDatabase,
    closeDatabase
}; 