/**
 * 前端链上价格计算
 * 使用 API 返回的 token、version、isImport、pair 等参数，直接调用 BSC 链获取代币价格
 * 参考 pump.ts 的 getTokenOnchainInfo 逻辑
 */

import { createPublicClient, http, parseAbi, type Address } from 'viem'
import { bsc } from 'viem/chains'

// BSC 主网配置
const RPC_URL = 'https://bsc-dataseed2.binance.org'

const pumpContracts: Address[] = [
  '0xa77253Ac630502A35A6FcD210A01f613D33ba7cD',
  '0x3DC52C69C3C8be568372E16d50E9F3FEc796610c',
  '0xc9FaA3c05a5178C380d9C28Edffa38d90D606F22',
  '0x0476571a77Cc8Fc28796935Cf173c265F2021448',
  '0x2cAbfDE43f93422fFb070f0Fa03d2951dbBC7749',
  '0x201308B193bC0Aa81Ac540A7D3B3ADb530a39861',
]
const WETH = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address
const UNISWAP_V2_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address

const tokenAbi = parseAbi([
  'function bondingCurveSupply() view returns (uint256)',
  'function listed() view returns (bool)',
])
const erc20Abi = parseAbi([
  'function totalSupply() view returns (uint256)',
])
const pumpAbi = parseAbi([
  'function getPrice(uint256 supply, uint256 amount) view returns (uint256)',
])
const pairAbi = parseAbi([
  'function getReserves() view returns (uint112, uint112, uint32)',
  'function token0() view returns (address)',
])
const factoryAbi = parseAbi([
  'function getPair(address, address) view returns (address)',
])

const publicClient = createPublicClient({
  chain: bsc,
  transport: http(RPC_URL),
})

export interface TokenPriceItem {
  token: string
  version: number
  isImport?: boolean
  pair?: string
}

/** 获取多个 token 的价格（BNB/枚） */
export async function getTokenPricesByAddress(
  items: TokenPriceItem[]
): Promise<Record<string, number>> {
  if (!items || items.length === 0) return {}

  const result: Record<string, number> = {}
  const bondingCurveItems: TokenPriceItem[] = []
  const importItems: { token: Address; pair: Address }[] = []

  for (const item of items) {
    if (!item.token) continue
    try {
      const token = item.token as Address
      if (item.isImport && item.pair) {
        importItems.push({ token, pair: item.pair as Address })
      } else if (!item.isImport && item.version >= 1 && item.version <= 6) {
        bondingCurveItems.push(item)
      }
    } catch {
      continue
    }
  }

  // 1. Bonding curve 代币
  if (bondingCurveItems.length > 0) {
    const bcPrices = await fetchBondingCurvePrices(bondingCurveItems)
    Object.assign(result, bcPrices)
  }

  // 2. Import 代币
  if (importItems.length > 0) {
    const impPrices = await fetchImportPrices(importItems)
    Object.assign(result, impPrices)
  }

  return result
}

/** 一次 RPC 同时获取价格与供应量，避免多一次请求 */
export interface TokenPricesAndSupplies {
  prices: Record<string, number>
  supplies: Record<string, number>
}

/**
 * 一次链上请求同时获取多个 token 的价格（BNB/枚）与供应量（token 数量）
 * - Bonding curve：第一轮 multicall 已有 supply，第二轮算价格，复用不增 RPC
 * - Import：单次 multicall 内同时请求 getReserves、token0、totalSupply
 */
export async function getTokenPricesAndSuppliesByAddress(
  items: TokenPriceItem[]
): Promise<TokenPricesAndSupplies> {
  const prices: Record<string, number> = {}
  const supplies: Record<string, number> = {}

  if (!items || items.length === 0) return { prices, supplies }

  const bondingCurveItems: TokenPriceItem[] = []
  const importItems: { token: Address; pair: Address }[] = []

  for (const item of items) {
    if (!item.token) continue
    try {
      const token = item.token as Address
      if (item.isImport && item.pair) {
        importItems.push({ token, pair: item.pair as Address })
      } else if (!item.isImport && item.version >= 1 && item.version <= 6) {
        bondingCurveItems.push(item)
      }
    } catch {
      continue
    }
  }

  if (bondingCurveItems.length > 0) {
    const bc = await fetchBondingCurvePricesAndSupplies(bondingCurveItems)
    Object.assign(prices, bc.prices)
    Object.assign(supplies, bc.supplies)
  }
  if (importItems.length > 0) {
    const imp = await fetchImportPricesAndSupplies(importItems)
    Object.assign(prices, imp.prices)
    Object.assign(supplies, imp.supplies)
  }

  return { prices, supplies }
}

/**
 * 从链上读取代币供应量（totalSupply）
 * - Bonding curve 代币：bondingCurveSupply()
 * - Import 代币：ERC20 totalSupply()
 * 返回：token 地址 -> 供应量（按 1e18 为 1 个 token 换算后的数量）
 */
export async function getTokenSuppliesByAddress(
  items: TokenPriceItem[]
): Promise<Record<string, number>> {
  if (!items || items.length === 0) return {}

  const result: Record<string, number> = {}
  const bcTokens: TokenPriceItem[] = []
  const importTokens: { token: Address }[] = []

  for (const item of items) {
    if (!item.token) continue
    try {
      const token = item.token as Address
      if (item.isImport) {
        importTokens.push({ token })
      } else if (!item.isImport && item.version >= 1 && item.version <= 6) {
        bcTokens.push(item)
      }
    } catch {
      continue
    }
  }

  if (bcTokens.length > 0) {
    const supplies = await fetchBondingCurveSupplies(bcTokens.map((i) => i.token as Address))
    Object.assign(result, supplies)
  }
  if (importTokens.length > 0) {
    const supplies = await fetchErc20TotalSupplies(importTokens.map((i) => i.token))
    Object.assign(result, supplies)
  }

  return result
}

/** Bonding curve 代币供应量也用 totalSupply（与市值计算一致） */
async function fetchBondingCurveSupplies(
  tokenAddresses: Address[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {}
  const calls = tokenAddresses.map((token) => ({
    address: token,
    abi: erc20Abi,
    functionName: 'totalSupply' as const,
  }))
  // @ts-expect-error viem multicall 类型兼容
  const res = await publicClient.multicall({
    contracts: calls,
    allowFailure: true,
  })
  res.forEach((r, i) => {
    if (r?.status === 'success' && typeof r.result === 'bigint') {
      const token = (tokenAddresses[i] as string).toLowerCase()
      result[token] = Number(r.result) / 1e18
    }
  })
  return result
}

async function fetchErc20TotalSupplies(tokenAddresses: Address[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {}
  const calls = tokenAddresses.map((token) => ({
    address: token,
    abi: erc20Abi,
    functionName: 'totalSupply' as const,
  }))
  // @ts-expect-error viem multicall 类型兼容
  const res = await publicClient.multicall({
    contracts: calls,
    allowFailure: true,
  })
  res.forEach((r, i) => {
    if (r?.status === 'success' && typeof r.result === 'bigint') {
      const token = (tokenAddresses[i] as string).toLowerCase()
      result[token] = Number(r.result) / 1e18
    }
  })
  return result
}

/** Bonding curve：两轮 multicall，同时产出 price 与 supply（第一轮已有 supply） */
async function fetchBondingCurvePricesAndSupplies(
  items: TokenPriceItem[]
): Promise<{ prices: Record<string, number>; supplies: Record<string, number> }> {
  const prices: Record<string, number> = {}
  const supplies: Record<string, number> = {}
  const tokenAddresses = items.map((i) => i.token as Address)

  // 第一轮：bondingCurveSupply（用于 getPrice）、listed、pair、totalSupply（用于市值）
  const calls1 = tokenAddresses.flatMap((token) => [
    {
      address: token,
      abi: tokenAbi,
      functionName: 'bondingCurveSupply' as const,
    },
    {
      address: token,
      abi: tokenAbi,
      functionName: 'listed' as const,
    },
    {
      address: UNISWAP_V2_FACTORY,
      abi: factoryAbi,
      functionName: 'getPair' as const,
      args: [token, WETH],
    },
    {
      address: token,
      abi: erc20Abi,
      functionName: 'totalSupply' as const,
    },
  ])

  // @ts-expect-error viem multicall 类型与可选 authorizationList 的兼容
  const res1 = await publicClient.multicall({
    contracts: calls1,
    allowFailure: true,
  })

  const infos: Record<string, { supply: bigint; totalSupply: bigint; listed: boolean; pair: Address | null }> = {}
  let idx = 0
  for (const token of tokenAddresses) {
    const supplyRes = res1[idx++]
    const listedRes = res1[idx++]
    const pairRes = res1[idx++]
    const totalSupplyRes = res1[idx++]
    const supply = supplyRes?.status === 'success' && typeof supplyRes.result === 'bigint' ? supplyRes.result : 0n
    const totalSupply =
      totalSupplyRes?.status === 'success' && typeof totalSupplyRes.result === 'bigint' ? totalSupplyRes.result : 0n
    const listed = listedRes?.status === 'success' && typeof listedRes.result === 'boolean' ? listedRes.result : false
    const pair =
      pairRes?.status === 'success' && pairRes.result && pairRes.result !== '0x0000000000000000000000000000000000000000'
        ? (pairRes.result as Address)
        : null
    infos[token.toLowerCase()] = { supply, totalSupply, listed, pair }
  }
  // 市值用 totalSupply（与 import 代币一致），getPrice 仍用 bondingCurveSupply
  for (const item of items) {
    const t = (item.token as string).toLowerCase()
    if (infos[t]) supplies[t] = Number(infos[t].totalSupply) / 1e18
  }

  // 第二轮：getPrice（bonding curve）或 getReserves+token0（listed）
  const calls2: {
    address: Address
    abi: typeof pumpAbi | typeof pairAbi
    functionName: string
    args?: readonly unknown[]
  }[] = []
  const itemIndex: { item: TokenPriceItem; startIdx: number; type: 'bc' | 'pair' }[] = []

  for (const item of items) {
    const token = (item.token as string).toLowerCase()
    const info = infos[token]
    if (!info) continue

    const version = Math.min(6, Math.max(1, Math.floor(Number(item.version)) || 2))
    const pumpAddr = pumpContracts[version - 1]
    const startIdx = calls2.length

    if (info.listed && info.pair) {
      calls2.push(
        { address: info.pair, abi: pairAbi, functionName: 'getReserves' },
        { address: info.pair, abi: pairAbi, functionName: 'token0' }
      )
      itemIndex.push({ item, startIdx, type: 'pair' })
    } else {
      calls2.push({
        address: pumpAddr,
        abi: pumpAbi,
        functionName: 'getPrice',
        args: [info.supply, 1000000000000000000n],
      })
      itemIndex.push({ item, startIdx, type: 'bc' })
    }
  }

  if (calls2.length === 0) return { prices, supplies }

  // @ts-expect-error viem multicall 类型兼容
  const res2 = await publicClient.multicall({
    contracts: calls2,
    allowFailure: true,
  })

  for (const { item, startIdx, type } of itemIndex) {
    const token = (item.token as string).toLowerCase()

    if (type === 'pair') {
      const r1 = res2[startIdx]
      const r2 = res2[startIdx + 1]
      if (!r1 || !r2 || r1.status !== 'success' || r2.status !== 'success') continue
      const reserves = r1.result as [bigint, bigint, number]
      const [reserve0, reserve1] = reserves
      const token0 = (r2.result as string).toLowerCase()
      const r0 = Number(reserve0) / 1e18
      const r1Val = Number(reserve1) / 1e18
      if (r0 <= 0) continue
      const price = token0 === token ? r1Val / r0 : r0 / r1Val
      prices[item.token] = price
    } else {
      const r = res2[startIdx]
      if (!r || r.status !== 'success') continue
      const price = Number(r.result) / 1e18
      if (price > 0) prices[item.token] = price
    }
  }

  return { prices, supplies }
}

async function fetchBondingCurvePrices(
  items: TokenPriceItem[]
): Promise<Record<string, number>> {
  const { prices } = await fetchBondingCurvePricesAndSupplies(items)
  return prices
}

/** Import：单次 multicall 内 getReserves、token0、totalSupply 一起取，一次 RPC 拿价格+供应量 */
async function fetchImportPricesAndSupplies(
  items: { token: Address; pair: Address }[]
): Promise<{ prices: Record<string, number>; supplies: Record<string, number> }> {
  const prices: Record<string, number> = {}
  const supplies: Record<string, number> = {}
  const calls = items.flatMap(({ token, pair }) => [
    { address: pair, abi: pairAbi, functionName: 'getReserves' as const },
    { address: pair, abi: pairAbi, functionName: 'token0' as const },
    { address: token, abi: erc20Abi, functionName: 'totalSupply' as const },
  ])

  // @ts-expect-error viem multicall 类型兼容
  const res = await publicClient.multicall({
    contracts: calls,
    allowFailure: true,
  })

  let idx = 0
  for (const { token } of items) {
    const r1 = res[idx++]
    const r2 = res[idx++]
    const r3 = res[idx++]
    if (r1.status !== 'success' || r2.status !== 'success') continue
    const reserves = r1.result as [bigint, bigint, number]
    const [reserve0, reserve1] = reserves
    const token0 = (r2.result as string).toLowerCase()
    const r0 = Number(reserve0) / 1e18
    const r1Val = Number(reserve1) / 1e18
    if (r0 <= 0) continue
    const price = token0 === token.toLowerCase() ? r1Val / r0 : r0 / r1Val
    const key = (token as string).toLowerCase()
    prices[token as string] = price
    if (r3?.status === 'success' && typeof r3.result === 'bigint') {
      supplies[key] = Number(r3.result) / 1e18
    }
  }

  return { prices, supplies }
}

async function fetchImportPrices(
  items: { token: Address; pair: Address }[]
): Promise<Record<string, number>> {
  const { prices } = await fetchImportPricesAndSupplies(items)
  return prices
}
