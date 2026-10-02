# 主题源码审计记录

审计日期：2026-10-02

本次同步检查了请求链路、v1/v2 中间件加密、V2Board 订阅、支付状态和移动端使用的公共 API 层。

- 站外绝对地址请求不经过中间件，也不携带面板 Authorization。
- localStorage 不可用时，v1 IV 使用内存回退。
- v2 订阅链接不会重复加密。
- Axios 取消请求不会被重试。
- 清理未使用依赖，升级 Axios、DOMPurify、Markdown、ECharts，并锁定 nanoid 安全版本。

验证结果：`npm test -- --run` 通过 5 个测试，`npm run build` 通过，`npm audit --omit=dev` 为 0 vulnerabilities。

真实 API、密钥、图床 Key 和带 token 的订阅地址只填写在本地 `src/config/index.js`，不要提交到公开仓库。

