import prisma from '@/lib/db';

function getSecid(symbol: string): string | null {
  const code = symbol.replace(/\D/g, '');
  if (code.length !== 6) return null;
  const first = code.slice(0, 2);
  // 上海市场代码：51、52、60、68、70、73 等（都用 1. 前缀）
  // 深圳市场代码：00、15、16、30 等（都用 0. 前缀）
  if (['51', '52', '56', '58', '60', '68', '70', '73'].includes(first)) return `1.${code}`;
  if (['00', '15', '16', '30', '20', '39', '37'].includes(first)) return `0.${code}`;
  return null;
}

function getFundCode(symbol: string): string | null {
  const code = symbol.replace(/\D/g, '');
  return code.length === 6 ? code : null;
}

function isReasonablePrice(price: number | undefined): boolean {
  if (price == null || Number.isNaN(price)) return false;
  return price > 0 && price < 10000;
}

async function fetchFundDataFromEastMoney(symbol: string): Promise<{ name?: string; navByDate?: Map<string, number>; latestNav?: number }> {
  const fundCode = getFundCode(symbol);
  if (!fundCode) return {};

  const url = `https://fund.eastmoney.com/pingzhongdata/${fundCode}.js?v=${Date.now()}`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return {};

    const text = await res.text();

    const nameMatch = text.match(/var\s+fS_name\s*=\s*"([^"]+)"/);
    const trendMatch = text.match(/var\s+Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);

    const result: { name?: string; navByDate?: Map<string, number>; latestNav?: number } = {};

    if (nameMatch?.[1]) {
      result.name = nameMatch[1];
    }

    if (trendMatch?.[1]) {
      const trend = JSON.parse(trendMatch[1]) as Array<{ x: number; y: number }>;
      if (Array.isArray(trend) && trend.length > 0) {
        const navMap = new Map<string, number>();

        for (const item of trend) {
          if (!item || typeof item.x !== 'number' || typeof item.y !== 'number') continue;
          const dateKey = new Date(item.x).toISOString().slice(0, 10);
          navMap.set(dateKey, item.y);
        }

        result.navByDate = navMap;

        const latest = trend[trend.length - 1];
        if (latest && typeof latest.y === 'number') {
          result.latestNav = latest.y;
        }
      }
    }

    return result;
  } catch (e) {
    console.error('Fund fetch error:', e);
    return {};
  }
}

async function fetchFromEastMoney(secid: string, dateStr: string): Promise<number | null> {
  const date = new Date(dateStr);
  const beg = new Date(date);
  beg.setDate(beg.getDate() - 10);
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 10);
  const begStr = beg.toISOString().slice(0, 10).replace(/-/g, '');
  const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, '');
  const url = `http://push2his.eastmoney.com/api/qt/stock/kline/get?fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56&klt=101&fqt=1&secid=${secid}&beg=${begStr}&end=${endStr}`;
  
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const json = await res.json();
    const klines: string[] = json?.data?.klines ?? [];
    if (klines.length === 0) return null;
    
    // Find exact date match or closest
    const targetTime = new Date(dateStr).getTime();
    let bestMatch = klines[0];
    let minDiff = Infinity;
    
    for (const k of klines) {
        const kDateStr = k.split(',')[0];
        const kTime = new Date(kDateStr).getTime();
        const diff = Math.abs(kTime - targetTime);
        // Prefer exact match
        if (diff === 0) {
            bestMatch = k;
            minDiff = 0;
            break;
        }
        if (diff < minDiff) {
            minDiff = diff;
            bestMatch = k;
        }
    }
    
    const parts = bestMatch.split(',');
    return parseFloat(parts[2]) || null; // f53 is close price? check fields. usually parts[2] is close in kline
  } catch (e) {
    console.error('Fetch error:', e);
    return null;
  }
}

export async function getPriceBySymbolDate(symbol: string, date: Date): Promise<number | null> {
  const dateStr = date.toISOString().slice(0, 10);
  const cached = await prisma.priceCache.findUnique({
    where: { symbol_date: { symbol, date } },
  });
  if (cached) return cached.price;

  const secid = getSecid(symbol);
  let price: number | null = null;

  if (secid) {
    price = await fetchFromEastMoney(secid, dateStr);
  }

  if (price == null) {
    const fundData = await fetchFundDataFromEastMoney(symbol);
    const navByDate = fundData.navByDate;

    if (navByDate && navByDate.size > 0) {
      if (navByDate.has(dateStr)) {
        price = navByDate.get(dateStr) ?? null;
      } else {
        const sortedDates = Array.from(navByDate.keys()).sort();
        const fallbackDate = sortedDates.filter(d => d <= dateStr).pop() ?? sortedDates[sortedDates.length - 1];
        price = fallbackDate ? (navByDate.get(fallbackDate) ?? null) : null;
      }
    }
  }

  if (price == null) return null;
  await prisma.priceCache.upsert({
    where: { symbol_date: { symbol, date } },
    create: { symbol, date, price },
    update: { price, createdAt: new Date() },
  });
  return price;
}

export async function updateAssetCurrentPrice(symbol: string): Promise<number | null> {
    const secid = getSecid(symbol);
  if (!secid) {
    const fundData = await fetchFundDataFromEastMoney(symbol);
    const fundPrice = fundData.latestNav ?? null;

    if (fundPrice !== null) {
      await prisma.asset.update({
        where: { symbol },
        data: {
          currentPrice: fundPrice,
          lastPriceUpdated: new Date()
        }
      });
    }
    return fundPrice;
  }
    
    // Use EastMoney realtime quote or kline ending today
    // kline is safer for consistent history, but for realtime we might want real quote.
    // For now, reuse fetchFromEastMoney with today's date.
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const price = await fetchFromEastMoney(secid, dateStr);
    
    if (price !== null) {
        // Update Asset table
        await prisma.asset.update({
            where: { symbol },
            data: { 
                currentPrice: price, 
                lastPriceUpdated: new Date() 
            }
        });
    }
    return price;
}

/**
 * 从东方财富获取资产的官方名称
 */
export async function getAssetNameFromEastMoney(symbol: string): Promise<string | null> {
    const secid = getSecid(symbol);
    if (!secid) return null;
    
    const url = `http://push2.eastmoney.com/api/qt/stock/get?fields=f58&secid=${secid}`;
    
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) return null;
        const json = await res.json();
        const name = json?.data?.f58;
        return name ? String(name) : null;
    } catch (e) {
        console.error('Failed to fetch asset name:', e);
        return null;
    }
}

/**
 * 创建或更新资产时从官方数据源获取信息
 * 优先尝试基金API，再尝试股票API（基金代码与股票代码可能冲突）
 */
export async function enrichAssetFromEastMoney(symbol: string): Promise<{ name?: string; currentPrice?: number }> {
    // Step 1: 优先尝试基金 API（因为 002236 等代码可能既是基金也是股票代码）
    const fundData = await fetchFundDataFromEastMoney(symbol);
    if (fundData.name || isReasonablePrice(fundData.latestNav)) {
      return {
        name: fundData.name,
        currentPrice: fundData.latestNav,
      };
    }

    // Step 2: 跳过 if 基金 API 成功（有名称或合理价格），否则尝试股票 API
    const secid = getSecid(symbol);
    if (secid) {
      const url = `http://push2.eastmoney.com/api/qt/stock/get?fields=f58,f57&secid=${secid}`;

      try {
          const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (res.ok) {
            const json = await res.json();
            const data = json?.data;
            const stockName = data?.f58 ? String(data.f58) : undefined;
            const stockPrice = data?.f57 ? parseFloat(data.f57) : undefined;

            if (isReasonablePrice(stockPrice)) {
              return {
                  name: stockName,
                  currentPrice: stockPrice,
              };
            }
          }
      } catch (e) {
          console.error('Failed to enrich stock asset:', e);
      }
    }

    // Step 3: 都失败则返回基金名称（即便没有价格）
    return {
      name: fundData.name,
      currentPrice: fundData.latestNav,
    };
}

