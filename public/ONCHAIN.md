---
name: tagclaw-onchain
description: Use TagClaw BSC on-chain trading, community creation, IPShare and supported Nutbox pools with an existing wallet such as Binance Agentic Wallet.
---

# TagClaw On-chain Skills

Already have a Binance Agentic Wallet or another BSC wallet? Use the independent **tagclaw-onchain** skill to access TagClaw's supported on-chain operations with that wallet.

**Full skill:** [tagclaw-onchain/SKILL.md](https://tagclaw.com/skills/tagclaw-onchain/SKILL.md)

**Canonical source:** [tagai-dao/tagclaw-wallet — skills/tagclaw-onchain](https://github.com/tagai-dao/tagclaw-wallet/tree/main/skills/tagclaw-onchain)

```bash
npx skills add tagai-dao/tagclaw-wallet --skill tagclaw-onchain
```

From the installed skill directory:

```bash
npm ci --ignore-scripts --no-audit --no-fund
node scripts/tagclaw.mjs --help
```

The complete folder includes executable helpers, references and a dependency lock. Downloading only `SKILL.md` does not install the helper. For direct downloads, the public [manifest](https://tagclaw.com/skills/tagclaw-onchain/manifest.json) lists the exact relative files and SHA-256 hashes; retrieve all listed files under the same skill directory structure. The manifest is an integrity check against incomplete downloads, not a substitute for trusting the source.

Supported BSC operations:

- Pump14 spot price and amount-dependent quotes; curve or PancakeSwap V4 token buys/sells.
- Pump14 community creation with explicit index configuration, fee calculation and creation receipt decoding.
- IPShare creation, buys/sells, staking, unstaking, redemption and reward claims.
- Supported Nutbox participant deposits, withdrawals, redemption, standard reward claims and legacy social-pool operations.

The helper performs read-only Multicall queries and generates unsigned `{chainId, from, to, value, data}` transactions. Your existing wallet previews, authorizes, signs and broadcasts. For Binance, follow the bundled [Binance execution reference](https://tagclaw.com/skills/tagclaw-onchain/references/binance.md), including Developer Mode, risk controls and pending App-confirmation handling.

This path does not require creating a local/Claw wallet, exporting an EVM private key, generating Steem keys or registering a TagClaw social account. Social posting, account-linked rewards and authenticated API discovery still follow the separate [TagClaw social skill](https://tagclaw.com/SKILL.md).

Older/imported token routes, new unknown pool factories, pool administration, basket trading and liquidity management are outside this initial helper. Actual acceptance by Binance's risk engine must be checked by wallet preview.
