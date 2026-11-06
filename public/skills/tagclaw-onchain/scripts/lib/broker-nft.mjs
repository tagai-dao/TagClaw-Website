import { ethers } from 'ethers'
import { HANDLE_REGISTRY } from './deployment.mjs'
import { address, nativeBalance, plan, same, uint } from './prepare.mjs'
import { call } from './snapshot.mjs'

const FACTORY = '0x835E047D4BE6548E95F2Cbb9Ac02d62EFa2508A0'
const AMM_TEMPLATE = '0x2a1b1c08642ad98a691167efec7b4e43d2a1133b'
const TEMPLATES = {
  '0x156c2a877069b0e50dc5a74c7d1612d70144b4c6': 'stake',
  '0x1ccecded84c825e413f1849fdf55423d07dc9ab6': 'burn',
}

const NFT = [
  'function factory() view returns(address)', 'function community() view returns(address)',
  'function ammVault() view returns(address)', 'function communityToken() view returns(address)',
  'function indexToken() view returns(address)', 'function indexMiningToken() view returns(address)',
  'function stakingToken() view returns(address)',
  'function name() view returns(string)', 'function symbol() view returns(string)',
  'function totalSupply() view returns(uint256)', 'function maxSupply() view returns(uint256)',
  'function nextTokenId() view returns(uint256)', 'function remainingPaidMints() view returns(uint256)',
  'function remainingWhitelistMints(address) view returns(uint256)',
  'function communityTokenPrice() view returns(uint256)', 'function nativePrice() view returns(uint256)',
  'function minimumIndexMiningWeight() view returns(uint256)',
  'function indexMiningActivationTokenAmount() view returns(uint256)',
  'function getNFTInfo(uint256) view returns((address owner,uint32 level,uint256 referrerTokenId,uint256 referralCount,uint256 miningWeight,bool miningActive,bool indexMiningActive,uint256 indexMiningWeight,uint256 pendingIndexRewards,uint256 seed,uint256 revealBlock,uint256 revealRound,bool revealPending) info)',
  'function tokenURI(uint256) view returns(string)',
  'function balanceOf(address) view returns(uint256)', 'function tokensOfOwner(address,uint256,uint256) view returns(uint256[])',
  'function getApproved(uint256) view returns(address)', 'function isApprovedForAll(address,address) view returns(bool)',
  'function mint(uint256) payable returns(uint256)', 'function reveal(uint256) returns(uint256)',
  'function REVEAL_WINDOW_BLOCKS() view returns(uint256)', 'function rerollEnabled() view returns(bool)',
  'function recommitPrice() view returns(uint256)', 'function commitReveal(uint256)',
  'function approve(address,uint256)', 'function activateIndexMining(uint256)',
  'function upgradeIndexMining(uint256,uint256)', 'function stakeIndexMining(uint256,uint256)',
  'function unstakeIndexMining(uint256,uint256)', 'function claimIndexRewards(uint256) returns(uint256)',
]
const AMM = [
  'function collection() view returns(address)', 'function communityToken() view returns(address)',
  'function active() view returns(bool)', 'function inventoryCount() view returns(uint256)',
  'function oldestTokenId() view returns(uint256)', 'function inInventory(uint256) view returns(bool)',
  'function nextInventoryToken(uint256) view returns(uint256)', 'function tokensPerNFT() view returns(uint256)',
  'function quoteNormalNativeFee() view returns(uint256)', 'function quoteSpecificNativeFee() view returns(uint256)',
  'function buyNextNFT() payable returns(uint256)', 'function buySpecificNFT(uint256) payable',
  'function sellNFT(uint256) payable',
]
const COMMUNITY = [
  'function poolActived(address) view returns(bool)', 'function committee() view returns(address)',
  'function getPoolPendingRewards(address,address) view returns(uint256)',
  'function withdrawPoolsRewards(address[]) payable',
]
const ERC20 = [
  'function balanceOf(address) view returns(uint256)', 'function allowance(address,address) view returns(uint256)',
  'function approve(address,uint256) returns(bool)',
]
const COMMITTEE = ['function getPoolOperationFee() view returns(uint256)']
const REGISTRY = ['function handleOf(address) view returns(string)']

async function cloneTemplate(snapshot, target) {
  // Inspect immutable EIP-1167 bytecode. Contract state uses Snapshot.read below.
  const code = await snapshot.provider.getCode(target, snapshot.block.number)
  const clone = /^0x363d3d373d3d3d363d73([a-f0-9]{40})5af43d82803e903d91602b57fd5bf3$/i.exec(code)
  if (!clone) throw new Error('UNSUPPORTED_BROKER_CLONE')
  return '0x' + clone[1].toLowerCase()
}

async function context(snapshot, input) {
  const pool = address(input.pool, 'pool')
  const template = await cloneTemplate(snapshot, pool)
  const miningMode = TEMPLATES[template]
  if (!miningMode) throw new Error('UNSUPPORTED_BROKER_NFT_TEMPLATE')
  const [factory, community, amm, paymentToken, indexToken, miningToken, ...modeChecks] = await snapshot.read([
    ...['factory', 'community', 'ammVault', 'communityToken', 'indexToken', 'indexMiningToken'].map(method => call(pool, NFT, method)),
    ...(miningMode === 'stake' ? [call(pool, NFT, 'stakingToken')] : []),
  ])
  if (!same(factory, FACTORY)) throw new Error('UNSUPPORTED_BROKER_FACTORY')
  if (miningMode === 'stake' ? !same(modeChecks[0], miningToken) : !same(miningToken, paymentToken)) {
    throw new Error('BROKER_MINING_TOKEN_MISMATCH')
  }
  if (!same(await cloneTemplate(snapshot, address(amm, 'amm')), AMM_TEMPLATE)) throw new Error('UNSUPPORTED_BROKER_AMM_TEMPLATE')
  const [collection, ammPaymentToken, poolActive, active, inventoryCount, oldestTokenId, tokensPerNFT, revealWindow] = await snapshot.read([
    ...['collection', 'communityToken'].map(method => call(amm, AMM, method)),
    call(community, COMMUNITY, 'poolActived', [pool]),
    ...['active', 'inventoryCount', 'oldestTokenId', 'tokensPerNFT'].map(method => call(amm, AMM, method)),
    call(pool, NFT, 'REVEAL_WINDOW_BLOCKS'),
  ])
  if (!same(collection, pool) || !same(ammPaymentToken, paymentToken)) throw new Error('BROKER_AMM_BINDING_MISMATCH')
  return { pool, factory, template, miningMode, community, amm, paymentToken, indexToken, miningToken, poolActive, active, inventoryCount, oldestTokenId, tokensPerNFT, revealWindow }
}

const fields = ['owner', 'level', 'referrerTokenId', 'referralCount', 'miningWeight', 'miningActive', 'indexMiningActive',
  'indexMiningWeight', 'pendingIndexRewards', 'seed', 'revealBlock', 'revealRound', 'revealPending']
function nftData(ctx, tokenId, info) {
  return { tokenId, ...Object.fromEntries(fields.map((field, i) => [field, info[i]])), lastRevealBlock: info.revealBlock + ctx.revealWindow }
}

async function nftPage(snapshot, ctx, ids) {
  const values = await snapshot.read(ids.flatMap(id => [call(ctx.pool, NFT, 'getNFTInfo', [id]), call(ctx.pool, NFT, 'tokenURI', [id])]))
  return ids.map((id, i) => ({ ...nftData(ctx, id, values[2 * i]), tokenURI: values[2 * i + 1] }))
}

export async function brokerNftInfo(snapshot, input, holdings = false) {
  const ctx = await context(snapshot, input)
  const { pool, community, amm } = ctx
  const base = { ...snapshot.metadata(), ...ctx }
  const pageLimit = uint(input.limit ?? 5, 'limit')
  if (pageLimit > 10n) throw new Error('NFT_PAGE_LIMIT_MAX_10')
  if (holdings) {
    const from = address(input.from, 'from')
    const offset = uint(input.offset ?? 0, 'offset', true)
    const [balance, ids, pendingCommunityRewards] = await snapshot.read([
      call(pool, NFT, 'balanceOf', [from]), call(pool, NFT, 'tokensOfOwner', [from, offset, pageLimit]),
      call(community, COMMUNITY, 'getPoolPendingRewards', [pool, from]),
    ])
    const nfts = await nftPage(snapshot, ctx, ids)
    if (nfts.some(nft => !same(nft.owner, from))) throw new Error('BROKER_HOLDINGS_MISMATCH')
    const end = offset + BigInt(ids.length)
    return { ...base, from, balance, offset, nextOffset: end < balance ? end : null, pendingCommunityRewards, nfts }
  }
  const methods = ['name', 'symbol', 'totalSupply', 'maxSupply', 'remainingPaidMints', 'communityTokenPrice', 'nativePrice',
    'minimumIndexMiningWeight', 'indexMiningActivationTokenAmount']
  const values = await snapshot.read(methods.map(method => call(pool, NFT, method)))
  const result = { ...base, ...Object.fromEntries(methods.map((method, i) => [method, values[i]])) }
  if (input.tokenId != null) [result.nft] = await nftPage(snapshot, ctx, [uint(input.tokenId, 'token_id')])
  if (input.inventory === true) {
    let cursor = input.cursor == null ? ctx.oldestTokenId : uint(input.cursor, 'cursor')
    const ids = []
    while (cursor !== 0n && ids.length < Number(pageLimit)) {
      if (ids.includes(cursor)) throw new Error('BROKER_INVENTORY_CYCLE')
      ids.push(cursor)
      ;[cursor] = await snapshot.read([call(amm, AMM, 'nextInventoryToken', [cursor])])
    }
    const items = await nftPage(snapshot, ctx, ids)
    if (items.some(nft => !same(nft.owner, amm))) throw new Error('BROKER_INVENTORY_OWNER_MISMATCH')
    result.inventory = { items, nextCursor: cursor || null }
  }
  return result
}

const ACTIONS = ['mint', 'reveal', 'recommit', 'buy-next', 'buy-specific', 'sell', 'stake', 'unstake', 'activate', 'upgrade', 'claim-index', 'claim-community']

export async function prepareBrokerNft(snapshot, input) {
  const { action } = input
  if (!ACTIONS.includes(action)) throw new Error('INVALID_BROKER_NFT_ACTION')
  const from = address(input.from, 'from')
  const ctx = await context(snapshot, input)
  const { pool, community, amm, paymentToken, miningToken, miningMode } = ctx
  if ((['stake', 'unstake'].includes(action) && miningMode !== 'stake') ||
      (['activate', 'upgrade'].includes(action) && miningMode !== 'burn')) throw new Error('ACTION_NOT_AVAILABLE_FOR_NFT_TEMPLATE')

  const [bnb] = await snapshot.read([nativeBalance(from)])
  const tx = (to, abi, method, args, value, details = {}) => {
    if (bnb < value) throw new Error('INSUFFICIENT_BNB_BALANCE')
    return plan(snapshot, from, 'nft-' + action, to, abi, method, args, value, { ...ctx, ...details })
  }
  async function payToken(token, spender, amount, quote, send) {
    if (amount === 0n) return send()
    const [balance, allowance] = await snapshot.read([
      call(token, ERC20, 'balanceOf', [from]), call(token, ERC20, 'allowance', [from, spender]),
    ])
    if (balance < amount) throw new Error('INSUFFICIENT_ERC20_BALANCE')
    if (allowance >= amount) return send()
    return tx(token, ERC20, 'approve', [spender, allowance === 0n ? amount : 0n], 0n, {
      quote, rebuildAfterConfirmation: true,
      authorityChange: { token, spender, allowance: allowance === 0n ? amount : 0n },
    })
  }

  if (action === 'mint') {
    const referrer = uint(input.referrerTokenId ?? 0, 'referrer_token_id', true)
    const [handle, whitelist, paid, supply, maxSupply, nativePrice, amount] = await snapshot.read([
      call(HANDLE_REGISTRY, REGISTRY, 'handleOf', [from]), call(pool, NFT, 'remainingWhitelistMints', [from]),
      ...['remainingPaidMints', 'nextTokenId', 'maxSupply', 'nativePrice', 'communityTokenPrice'].map(method => call(pool, NFT, method)),
    ])
    if (!ctx.poolActive) throw new Error('BROKER_POOL_INACTIVE')
    if (!handle) throw new Error('BINANCE_HANDLE_REQUIRED')
    if (supply >= maxSupply || (whitelist === 0n && (paid === 0n || nativePrice === 0n))) throw new Error('NFT_MINT_UNAVAILABLE')
    if (referrer !== 0n) {
      if (whitelist > 0n) throw new Error('REFERRER_UNAVAILABLE_FOR_WHITELIST_MINT')
      const [info] = await snapshot.read([call(pool, NFT, 'getNFTInfo', [referrer])])
      if (same(info.owner, amm)) throw new Error('REFERRER_IN_AMM')
    }
    const value = whitelist > 0n ? 0n : nativePrice
    const quote = { paymentToken, amount, nativeValue: value, referrerTokenId: referrer, whitelist: whitelist > 0n }
    if (bnb < value) throw new Error('INSUFFICIENT_BNB_BALANCE')
    return payToken(paymentToken, pool, amount, quote, () => tx(pool, NFT, 'mint', [referrer], value, { quote }))
  }

  if (action === 'claim-community') {
    const [committee, amount] = await snapshot.read([
      call(community, COMMUNITY, 'committee'), call(community, COMMUNITY, 'getPoolPendingRewards', [pool, from]),
    ])
    if (amount === 0n) throw new Error('NO_COMMUNITY_REWARDS')
    const [fee] = await snapshot.read([call(committee, COMMITTEE, 'getPoolOperationFee')])
    return tx(community, COMMUNITY, 'withdrawPoolsRewards', [[pool]], fee, { quote: { rewardToken: paymentToken, amount, nativeValue: fee } })
  }

  if (action === 'buy-next' || action === 'buy-specific') {
    if (!ctx.active) throw new Error('BROKER_AMM_INACTIVE')
    const specific = action === 'buy-specific'
    const id = specific ? uint(input.tokenId, 'token_id') : ctx.oldestTokenId
    if (!id) throw new Error('NFT_INVENTORY_EMPTY')
    const [available, value, info] = await snapshot.read([
      call(amm, AMM, 'inInventory', [id]), call(amm, AMM, specific ? 'quoteSpecificNativeFee' : 'quoteNormalNativeFee'),
      call(pool, NFT, 'getNFTInfo', [id]),
    ])
    if (!available || !same(info.owner, amm)) throw new Error('NFT_NOT_IN_INVENTORY')
    if (bnb < value) throw new Error('INSUFFICIENT_BNB_BALANCE')
    const quote = { paymentToken, amount: ctx.tokensPerNFT, nativeValue: value, snapshotNft: nftData(ctx, id, info), fixedTokenId: specific }
    return payToken(paymentToken, amm, ctx.tokensPerNFT, quote, () =>
      tx(amm, AMM, specific ? 'buySpecificNFT' : 'buyNextNFT', specific ? [id] : [], value, { quote }))
  }

  const id = uint(input.tokenId, 'token_id')
  const [info] = await snapshot.read([call(pool, NFT, 'getNFTInfo', [id])])
  if (!same(info.owner, from)) throw new Error('NFT_OWNER_MISMATCH')
  const nft = nftData(ctx, id, info)
  if (action === 'sell') {
    if (!ctx.active) throw new Error('BROKER_AMM_INACTIVE')
    const [approved, operator, reserve, value] = await snapshot.read([
      call(pool, NFT, 'getApproved', [id]), call(pool, NFT, 'isApprovedForAll', [from, amm]),
      call(paymentToken, ERC20, 'balanceOf', [amm]), call(amm, AMM, 'quoteNormalNativeFee'),
    ])
    if (reserve < ctx.tokensPerNFT) throw new Error('INSUFFICIENT_AMM_RESERVE')
    if (bnb < value) throw new Error('INSUFFICIENT_BNB_BALANCE')
    const quote = { nft, paymentToken, receiveAmount: ctx.tokensPerNFT, nativeValue: value, stakeFollowsNft: miningMode === 'stake' }
    if (!operator && !same(approved, amm)) return tx(pool, NFT, 'approve', [amm, id], 0n, {
      quote, rebuildAfterConfirmation: true, authorityChange: { collection: pool, operator: amm, tokenId: id },
    })
    return tx(amm, AMM, 'sellNFT', [id], value, { quote })
  }

  const block = BigInt(snapshot.block.number)
  if (action === 'reveal') {
    if (!info.revealPending || block <= info.revealBlock || block >= nft.lastRevealBlock) throw new Error('NFT_REVEAL_NOT_READY_OR_EXPIRED')
    return tx(pool, NFT, 'reveal', [id], 0n, { quote: { nft } })
  }
  if (action === 'recommit') {
    if (!info.revealPending || block <= nft.lastRevealBlock) throw new Error('NFT_REVEAL_NOT_EXPIRED')
    const [rerollEnabled, recommitPrice] = await snapshot.read([
      call(pool, NFT, 'rerollEnabled'), call(pool, NFT, 'recommitPrice'),
    ])
    const amount = rerollEnabled ? recommitPrice : 0n
    const quote = { nft, paymentToken, amount, burned: amount !== 0n }
    return payToken(paymentToken, pool, amount, quote, () => tx(pool, NFT, 'commitReveal', [id], 0n, { quote }))
  }
  if (action === 'claim-index') {
    if (info.pendingIndexRewards === 0n) throw new Error('NO_INDEX_REWARDS')
    return tx(pool, NFT, 'claimIndexRewards', [id], 0n, { quote: { nft, rewardToken: ctx.indexToken, amount: info.pendingIndexRewards } })
  }

  const [minimum, activation] = await snapshot.read([
    call(pool, NFT, 'minimumIndexMiningWeight'), call(pool, NFT, 'indexMiningActivationTokenAmount'),
  ])
  const amount = action === 'activate' ? activation : uint(input.amount, 'amount')
  if (action === 'unstake') {
    const remaining = info.indexMiningWeight - amount
    if (remaining < 0n || (remaining > 0n && remaining < minimum)) throw new Error('INVALID_NFT_UNSTAKE_AMOUNT')
    return tx(pool, NFT, 'unstakeIndexMining', [id, amount], 0n, { quote: { nft, miningToken, amount, remainingWeight: remaining } })
  }
  if (action !== 'activate' && amount < minimum) throw new Error('NFT_MINIMUM_MINING_AMOUNT')
  if (action === 'activate' && info.indexMiningActive) throw new Error('NFT_MINING_ALREADY_ACTIVE')
  if (action === 'upgrade' && !info.indexMiningActive) throw new Error('NFT_MINING_NOT_ACTIVE')
  const method = { stake: 'stakeIndexMining', activate: 'activateIndexMining', upgrade: 'upgradeIndexMining' }[action]
  const quote = { nft, miningToken, amount, burned: miningMode === 'burn' }
  return payToken(miningToken, pool, amount, quote, () =>
    tx(pool, NFT, method, action === 'activate' ? [id] : [id, amount], 0n, { quote }))
}
