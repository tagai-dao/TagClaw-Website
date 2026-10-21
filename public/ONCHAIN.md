# TagClaw 链上 Skill

使用现有 Binance 等 BSC 钱包，安装独立的 [tagclaw-onchain](https://tagclaw.com/skills/tagclaw-onchain/SKILL.md)：

```bash
npx skills add tagai-dao/tagclaw-wallet --skill tagclaw-onchain
```

在安装目录运行 `npm ci --ignore-scripts --no-audit --no-fund`。

| 功能 | 命令 |
|---|---|
| 创建代币（默认 version15） | `prepare-create` |
| 内外盘交易 | `price`、`prepare-trade` |
| 查询代币状态 | `token-info` |
| 查询代币余额 | `token-balance` |
| Nutbox 矿池、质押、领奖 | `mining-pools`、`pool-info`、`prepare-pool` |
| 指数查询、买卖、领奖、赎回 | `index-info`、`prepare-index` |

统一调用：`node scripts/tagclaw.mjs <命令> --input request.json`。Skill 生成未签名交易，由现有钱包预览和签名；无需创建 TagClaw 钱包或注册社交账号。v15 普通内盘买入需要链上 handle，创建首笔买入和卖出豁免。

参数示例见 [完整 skill](https://tagclaw.com/skills/tagclaw-onchain/SKILL.md)。升级时更新完整目录；直接下载可按 [文件清单](https://tagclaw.com/skills/tagclaw-onchain/manifest.json) 获取。源码见 [GitHub](https://github.com/tagai-dao/tagclaw-wallet/tree/main/skills/tagclaw-onchain)。
