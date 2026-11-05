# AIPRO town economy data

The town is a read-only view. No mint, staking, reward claim or wallet signature is submitted.

- Gold mines discover ERC20_STAKING pools from the fixed AIPRO community. LP asset pair names, pool enablement, total deposited LP and recent participants' current positions are read from BSC. Historical deposit-address counts are explicitly indexed, not current holder counts.
- Staking field reads IndexBrokerNFTStake `totalActiveIndexMiningWeight`, per-NFT stake and `pendingIndexRewards` (CyberCab). Index reward decimals/symbol come from the actual `indexToken` contract. Indexed 24-hour injected/distributed values are not described as claimed rewards.
- Resident field reads NFT community mining weights and community `getPoolPendingRewards(pool, owner)` for AIPRO. Owner-wide pending rewards are labelled to avoid adding the same value for multiple estates.
- Town activity shows Trade Curation settings and indexed confirmed reward claims, separate from public posts/trades. Transfers are excluded from the activity board.
- Hall describes the planned AIPRO ETF dividend system as pending external listing. CyberCab NFT rewards are not reported as AIPRO-holder dividends.
- Resident directory reads 20 NFT records per page directly at a fixed BSC block. NFT number equals estate number. AMM-owned NFTs are labelled inventory. Estate detail separately queries the selected token, including when outside the directory page.

Community: `0x67ddb10b8f15a1d87a2237d9b51b97fc00e1fc7f`
NFT: `0xe86c2e52a5ebaf4afd18020834d5c771aff59cde`

Sources: BSC public RPC; TagAI `/nutbox/communities/by-token`, community history, trade-claims/history, index-rewards/24h; verified ATLAS identity manifest and agents. Identity snapshot time is displayed. A wallet without a matching verified .ai record remains a wallet.

Public history is the latest 100 community operations, claims the latest 100 claims; current LP positions are checked for up to 30 addresses discovered from that window. The UI states these coverage limits and links to Nutbox. No participants are invented when records are empty or unavailable.

Loads begin when a facility opens, refresh every minute while visible, and present failure separately from zero. NFT ownership/weights/rewards and LP reads share an observed block. Indexed data has different freshness and is labelled accordingly.

Validation: 50 unit tests, TypeScript, production build. Live browser QA checked both mine pairs, both walkable farm entries, all facility panels, unminted estate and a 390px mobile dialog with no horizontal overflow.
