# 使用官方的Node.js 16镜像作为基础
FROM node:16-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json文件
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制项目代码
COPY . .

# 复制.env.example为.env（如果.env不存在）
RUN if [ ! -f .env ]; then cp .env.example .env; fi

# 暴露端口（根据项目实际端口设置）
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]