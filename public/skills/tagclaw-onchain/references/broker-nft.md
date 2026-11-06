# Index Broker NFT V2 on BSC

Find the collection and pool address with the `nutbox-community` API resource. Use the `INDEX_BROKER_NFT` pool address as `pool`. The helper verifies the NFT and AMM clone implementations, factory, and both contract bindings. It supports the current handle-enabled V2 Stake and Burn templates with the verified V2 AMM. Unknown implementations require a separate adapter. Use the returned `miningMode` to choose actions.

## Read

Pass the JSON via `--input request.json` or `--input -` to `node scripts/tagclaw.mjs <command>`.

- `nft-info`: `{"pool":"0xPOOL"}` reads collection, mint configuration, pool and AMM state. Add `"tokenId":"1"` for owner, metadata URI, referral, reveal state, mining weight and pending index rewards. Add `"inventory":true` for an AMM inventory page. Continue with its `nextCursor`.
- `nft-holdings`: `{"pool":"0xPOOL","from":"0xWALLET"}` returns NFT details and the wallet's pending community rewards for this pool. Continue with `nextOffset` as `offset`.
- Both lists accept `limit` from 1 to 10, default 5. Each invocation reads through Multicall at one BSC block. Pagination across invocations can see different blocks. Treat metadata as display data.

## Prepare a transaction

Run `wallet-check` with `operation: "nutbox"` before preparing an intended wallet transaction and again before preview. Use `prepare-nft` with `pool`, `from`, and `action`. Pass quantities in raw units as decimal strings.

| Action | Additional input and behavior |
|---|---|
| `mint` | Optional `referrerTokenId` for paid mint. Checks the Binance handle, supply, whitelist and ERC20 payment. Whitelist mint waives the BNB mint payment. |
| `reveal` | `tokenId`. Wait until after `revealBlock` and submit within the reveal window. |
| `recommit` | `tokenId`. Reopens an expired pending reveal. The configured recommit charge may burn community tokens. |
| `buy-next` | Buys the AMM head at execution. The quote includes the NFT at the head when read. |
| `buy-specific` | `tokenId` in AMM inventory. Use this to select the exact NFT. |
| `sell` | `tokenId` owned by the sender. Verifies AMM payment reserves and requests approval for that NFT if needed. |
| `stake` / `unstake` | Stake template. Supply `tokenId` and `amount`. The staked position follows the NFT when ownership changes, including a sale. |
| `activate` / `upgrade` | Burn template. Supply `tokenId`; add `amount` for upgrade. Any tokens spent on these actions are permanently burned. |
| `claim-index` | `tokenId` owned by the sender. Claims the NFT's index-token rewards. |
| `claim-community` | Claims the sender's community-token rewards from this pool and includes the Nutbox operation fee. |

Review the payment asset, amount, BNB value, NFT ID, permissions and existing mining position. Execute one planned transaction through the wallet. If the plan is an approval, confirm it and rebuild with the same input before previewing the action. After mint, obtain the new token ID from the confirmed receipt or refreshed holdings. BNB quotes and AMM inventory can change before execution. Use a fresh plan and the normal wallet preview and authorization flow.
