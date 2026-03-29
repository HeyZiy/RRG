import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getPriceBySymbolDate } from '@/lib/price-fetcher';

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get('accountId');
    const transactions = await prisma.transaction.findMany({
      where: accountId ? { accountId: parseInt(accountId) } : undefined,
      include: {
        asset: true,
        account: true,
      },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(transactions);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    let price = data.price;
    let amount = data.amount;
    const date = new Date(data.date);
    const shares = data.shares ?? 0;
    const type = data.type; // 'buy' or 'sell'

    // 获取账户信息，判断是场内还是场外
    const account = await prisma.account.findUnique({
      where: { id: data.accountId },
    }) as any;

    if (!account) {
      return NextResponse.json({ error: '账户不存在' }, { status: 400 });
    }

    const isOTC = account.marketType === 'otc';

    // 1. Resolve Asset ID (Create if not exists)
    let assetId = data.assetId;
    let assetSymbol = '';

    if (!assetId && data.symbol) {
      const existing = await prisma.asset.findUnique({ where: { symbol: data.symbol } });
      if (existing) {
        assetId = existing.id;
        assetSymbol = existing.symbol;
      } else {
        const manualName = data.name || data.symbol;
        // 根据账户类型确定默认资产类型：场外账户默认为基金，场内账户默认为股票
        const defaultAssetType = isOTC ? 'fund' : 'stock';
        const newAsset = await prisma.asset.create({
          data: {
            symbol: data.symbol,
            name: manualName,
            type: data.assetType || defaultAssetType,
            currentPrice: price, // 设置当前价格
            lastPriceUpdated: new Date(),
          }
        });
        assetId = newAsset.id;
        assetSymbol = newAsset.symbol;
      }
    } else if (assetId) {
      const existing = await prisma.asset.findUnique({ where: { id: assetId } });
      if (existing) assetSymbol = existing.symbol;
    }

    if (!assetId) {
       return NextResponse.json({ error: '必须提供 assetId 或 symbol' }, { status: 400 });
    }

    // 2. Fetch Price if missing (only if user didn't provide price)
    // 场内走行情接口；场外基金会在 price-fetcher 中尝试净值接口兜底。
    if (price == null && shares > 0 && assetSymbol) {
       const fetched = await getPriceBySymbolDate(assetSymbol, date);
       if (fetched != null) {
         price = fetched;
         amount = Math.round(shares * price * 100) / 100;
       }
    }

    // Recalculate amount if undefined but price & shares exist
    if (!amount && price && shares) {
        amount = Math.round(shares * price * 100) / 100;
    }

    if (price == null || (amount == null || amount === 0) && shares > 0) {
       // If still no price, try current price from asset if date is today?
       // For now return error
       return NextResponse.json({ error: '请填写价格，或确保该资产支持自动获取行情' }, { status: 400 });
    }

    // 3. Execute Transaction & Update State (Account Cash + Holding)
    const result = await prisma.$transaction(async (tx) => {
      // A. Update Asset Price (每次交易时更新资产的当前价格)
      if (price != null && price > 0) {
        await tx.asset.update({
          where: { id: assetId },
          data: { 
            currentPrice: price, 
            lastPriceUpdated: new Date() 
          }
        });
      }

      // B. Create Transaction Record
      const transaction = await tx.transaction.create({
        data: {
          accountId: data.accountId,
          assetId: assetId,
          type,
          amount,
          price,
          shares,
          date,
        },
        include: { asset: true, account: true },
      });

      // C. Update Account Cash
      const cashChange = type === 'buy' ? -amount : amount;
      await tx.account.update({
        where: { id: data.accountId },
        data: { cash: { increment: cashChange } },
      });

      // D. Update Holding
      const existingHolding = await tx.holding.findUnique({
        where: { accountId_assetId: { accountId: data.accountId, assetId: assetId } },
      });

      if (existingHolding) {
        let newShares = existingHolding.shares;
        let newCost = existingHolding.avgCost;
        
        if (type === 'buy') {
           const totalCost = (existingHolding.shares * existingHolding.avgCost) + amount;
           newShares += shares;
           newCost = newShares > 0 ? totalCost / newShares : 0;
        } else {
           // Sell: shares decrease, avgCost stays same (FIFO/Weighted assumption)
           newShares -= shares;
           // If fully sold, cost is 0? Or keep last known cost? Usually cost basis is historical.
           if (newShares <= 0.0001) newShares = 0; // Floating point safety
        }

        await tx.holding.update({
          where: { id: existingHolding.id },
          data: { shares: newShares, avgCost: newCost },
        });
      } else if (type === 'buy') {
        // Create new holding
        await tx.holding.create({
          data: {
            accountId: data.accountId,
            assetId: assetId,
            shares: shares,
            avgCost: price, // Initial cost is price
          },
        });
      }

      return transaction;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}