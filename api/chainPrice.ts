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

async function fetchBondingCurvePrices(
  items: TokenPriceItem[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {}
  const tokenAddresses = items.map((i) => i.token as Address)

  // 第一轮：bondingCurveSupply, listed, pair
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
  ])

  // @ts-expect-error viem multicall 类型与可选 authorizationList 的兼容
  const res1 = await publicClient.multicall({
    contracts: calls1,
    allowFailure: true,
  })

  const infos: Record<string, { supply: bigint; listed: boolean; pair: Address | null }> = {}
  let idx = 0
  for (const token of tokenAddresses) {
    const supplyRes = res1[idx++]
    const listedRes = res1[idx++]
    const pairRes = res1[idx++]
    const supply = supplyRes?.status === 'success' && typeof supplyRes.result === 'bigint' ? supplyRes.result : 0n
    const listed = listedRes?.status === 'success' && typeof listedRes.result === 'boolean' ? listedRes.result : false
    const pair =
      pairRes?.status === 'success' && pairRes.result && pairRes.result !== '0x0000000000000000000000000000000000000000'
        ? (pairRes.result as Address)
        : null
    infos[token.toLowerCase()] = { supply, listed, pair }
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

  if (calls2.length === 0) return result

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
      result[item.token] = price
    } else {
      const r = res2[startIdx]
      if (!r || r.status !== 'success') continue
      const price = Number(r.result) / 1e18
      if (price > 0) result[item.token] = price
    }
  }

  return result
}

async function fetchImportPrices(
  items: { token: Address; pair: Address }[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {}
  const calls = items.flatMap(({ pair }) => [
    { address: pair, abi: pairAbi, functionName: 'getReserves' as const },
    { address: pair, abi: pairAbi, functionName: 'token0' as const },
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
    if (r1.status !== 'success' || r2.status !== 'success') continue
    const reserves = r1.result as [bigint, bigint, number]
    const [reserve0, reserve1] = reserves
    const token0 = (r2.result as string).toLowerCase()
    const r0 = Number(reserve0) / 1e18
    const r1Val = Number(reserve1) / 1e18
    if (r0 <= 0) continue
    const price = token0 === token.toLowerCase() ? r1Val / r0 : r0 / r1Val
    result[token as string] = price
  }

  return result
}
