const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

function getDbPath() {
    return process.env.DB_PATH || './data/app.db';
}

function ensureDataDirectory() {
    const dataDir = path.dirname(getDbPath());
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

ensureDataDirectory();

// 创建数据库连接
const db = new sqlite3.Database(getDbPath());

const runSql = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
                return;
            }
            resolve(this);
        });
    });
};

const addColumnIfMissing = async (table, columnDef) => {
    try {
        await runSql(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
    } catch (err) {
        if (!/duplicate column name/i.test(err.message)) {
            throw err;
        }
    }
};

// 初始化数据库表
const initializeDatabase = async () => {
    await runSql(`
                CREATE TABLE IF NOT EXISTS feedback (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(100),
                    email VARCHAR(255),
                    message TEXT NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    client_info TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

    await addColumnIfMissing('feedback', 'ip_address VARCHAR(45)');
    await addColumnIfMissing('feedback', 'user_agent TEXT');
    await addColumnIfMissing('feedback', 'client_info TEXT');

    await runSql(`
                CREATE TABLE IF NOT EXISTS reports (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    target_url TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    description TEXT,
                    reporter_email VARCHAR(255),
                    status VARCHAR(20) DEFAULT 'pending',
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    client_info TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

    await addColumnIfMissing('reports', 'ip_address VARCHAR(45)');
    await addColumnIfMissing('reports', 'user_agent TEXT');
    await addColumnIfMissing('reports', 'client_info TEXT');

    await runSql(`
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

    await runSql(`
                CREATE TABLE IF NOT EXISTS blacklist (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ip_address VARCHAR(255),
                    user_agent_hash VARCHAR(64),
                    device_fingerprint VARCHAR(128),
                    reason TEXT,
                    added_by VARCHAR(50) DEFAULT 'system',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME,
                    UNIQUE(ip_address, user_agent_hash)
                )
            `);

    await runSql(`
                CREATE TABLE IF NOT EXISTS access_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date DATE NOT NULL,
                    hour INTEGER,
                    ip_address VARCHAR(45),
                    endpoint VARCHAR(255),
                    method VARCHAR(10),
                    request_count INTEGER DEFAULT 0,
                    avg_response_time INTEGER,
                    error_count INTEGER DEFAULT 0,
                    UNIQUE(date, hour, ip_address, endpoint)
                )
            `);

    console.log('数据库表初始化完成');
};

// 关闭数据库连接
const closeDatabase = () => {
    return new Promise((resolve) => {
        db.close((err) => {
            if (err) {
                console.error('关闭数据库连接时出错:', err);
            }
            resolve();
        });
    });
};

// 作为独立脚本执行时，自动初始化数据库（用于 npm run init-db）
if (require.main === module) {
    console.log('开始初始化数据库...');
    initializeDatabase()
        .then(() => {
            console.log('数据库初始化完成');
            return closeDatabase();
        })
        .then(() => {
            process.exit(0);
        })
        .catch((err) => {
            console.error('数据库初始化失败:', err);
            process.exit(1);
        });
}

module.exports = {
    db,
    initializeDatabase,
    closeDatabase
}; 
