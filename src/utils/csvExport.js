/**
 * 将数据转换为 CSV 格式
 * @param {Array} data - 对象数组
 * @param {Array} headers - 表头配置 [{key: 'id', label: 'ID'}, ...]
 * @returns {string} - CSV 字符串
 */
function convertToCSV(data, headers) {
    if (!data || !data.length) return '';

    const headerRow = headers.map(h => h.label).join(',');
    const bodyRows = data.map(row => {
        return headers.map(h => {
            let val = row[h.key] === null || row[h.key] === undefined ? '' : row[h.key];
            // 简单处理包含逗号或引号的情况
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        }).join(',');
    });

    return [headerRow, ...bodyRows].join('\n');
}

module.exports = {
    convertToCSV
};
