# Chonglangban 主题与加密中间件使用方法

## 安装与构建

```bash
npm install
npm run dev
npm run build
```

将 `dist/` 内容部署到静态 Web 服务器。`frontend/src/config/index.js` 用于站点私有配置，真实后端地址、密钥和图床 Key 不要提交到公开仓库。

## 中间件配置

推荐 v2 AES-256-GCM：

```js
API_MIDDLEWARE_ENABLED: true,
API_MIDDLEWARE_URL: 'https://middleware.example.com',
API_MIDDLEWARE_PATH: '/clb/clb',
API_MIDDLEWARE_PROTOCOL: 'aead',
API_MIDDLEWARE_AEAD_KEY: '与中间件 AEAD_KEY 相同的64位十六进制字符串',
```

服务端使用对应的 `ENCRYPTION_PROTOCOL=aead`、`AEAD_KEY` 和 `PATH_PREFIX=/clb/clb`。`ALLOWED_ORIGINS` 填主题实际 HTTPS 来源，生产环境关闭 `ALLOW_PLAIN_SUBSCRIPTIONS`。

旧 EZ 兼容模式使用 `API_MIDDLEWARE_PROTOCOL: 'legacy'`，服务端使用相同的 16 位 `AES_KEY`；迁移期间可以使用 `ENCRYPTION_PROTOCOL=auto`。

## 订阅与支付

v2 模式会整体加密 V2Board 订阅 URL 的路径和查询参数，已经是 v2 中间件地址的链接不会重复加密。支付平台回调使用中间件的 `PAYMENT_NOTIFY_PATHS` 白名单，普通 API 继续使用加密请求。

## 检查与发布

```bash
npm test -- --run
npm run build
```

确认登录、仪表盘、商店下单、订单支付状态、订阅导入和工单流程后，再发布 `dist/`。不提交 `.env`、真实密钥、后端地址或带 token 的订阅链接。

