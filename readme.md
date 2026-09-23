<img src="https://avatars.githubusercontent.com/u/56885001?s=200&v=4" alt="logo" width="130" height="130" align="right"/>

# **V2Board**

## 云上冲浪板用户中心前端

当前定制版用户中心位于 [`frontend/`](frontend/)，前端单独构建为静态文件，并通过 V2Board API 获取账户、套餐、订单和工单数据。

```bash
cd frontend
npm ci
npm run dev
npm run build
```

构建输出位于 `frontend/dist/`。API 与站点设置在 `frontend/src/config/index.js`；仓库内默认配置使用同域 `/api/v1`，中间件默认关闭。部署时按自己的后端地址调整配置；中间件密钥和图片服务密钥只保存在部署环境，不要提交到 GitHub。

此目录保留 V2Board 后端源码，`frontend/` 保留云上冲浪板定制主题源码，两部分按各自的部署流程运行。

- PHP7.3+
- Composer
- MySQL5.5+
- Redis
- Laravel

## Demo
[Demo](https://demo.v2board.com)

## Document
[Click](https://v2board.com)

## Sponsors
Thanks to the open source project license provided by [Jetbrains](https://www.jetbrains.com/)

## Community
🔔Telegram Channel: [@v2board](https://t.me/v2board)  

## How to Feedback
Follow the template in the issue to submit your question correctly, and we will have someone follow up with you.
