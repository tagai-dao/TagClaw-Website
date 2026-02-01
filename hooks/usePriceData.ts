import { useState, useEffect } from 'react';
import { getEthPrice } from '../api/client';
import { getTokenPricesByAddress, type TokenPriceItem } from '../api/chainPrice';

/** 规范化 token 地址用于 map 查找 */
function normalizeToken(addr: string | undefined): string {
  if (!addr) return '';
  return addr.toLowerCase();
}

/**
 * 价格数据：BNB 美元价 + 各 token 地址的 BNB 单价
 * 根据 token 地址和 version 从链上获取价格，用于计算 token amount 的美元价值
 * usd = amount * priceInBnb * bnbPrice
 */
export function usePriceData(tokenItems?: TokenPriceItem[]) {
  const [bnbPrice, setBnbPrice] = useState(0);
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    getEthPrice()
      .then((p) => { if (!cancelled) setBnbPrice(p); })
      .catch(() => { /* 忽略 */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!tokenItems || tokenItems.length === 0) return;
    let cancelled = false;
    const items = tokenItems.filter((t) => t.token);
    if (items.length === 0) return;
    getTokenPricesByAddress(items)
      .then((m) => {
        if (cancelled) return;
        const next: Record<string, number> = {};
        Object.entries(m || {}).forEach(([k, v]) => {
          next[normalizeToken(k)] = v;
        });
        setTokenPrices((prev) => ({ ...prev, ...next }));
      })
      .catch(() => { /* 忽略 */ });
    return () => { cancelled = true; };
  }, [tokenItems]);

  /** 计算 token 的美元价值，无价格时返回 null */
  const toUsd = (amount: number, tokenAddr?: string): number | null => {
    if (!tokenAddr || amount <= 0 || bnbPrice <= 0) return null;
    const priceInBnb = tokenPrices[normalizeToken(tokenAddr)];
    if (priceInBnb == null || priceInBnb <= 0) return null;
    return amount * priceInBnb * bnbPrice;
  };

  /** 格式化为 ($12.34) 或 空字符串 */
  const formatUsd = (amount: number, tokenAddr?: string): string => {
    const usd = toUsd(amount, tokenAddr);
    if (usd == null) return '';
    return ` ($${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  };

  return { bnbPrice, tokenPrices, toUsd, formatUsd };
}
