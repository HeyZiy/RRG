import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const accountIdStr = request.nextUrl.searchParams.get('accountId');
    if (!accountIdStr) {
        return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }
    const accountId = parseInt(accountIdStr);

    const account = await prisma.account.findUnique({
        where: { id: accountId },
        include: { holdings: { include: { asset: true } }, allocations: { include: { asset: true } } }
    });

    if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // 1. Calculate Total Value
    let holdingsValue = 0;
    const positions = new Map();

    // Map holdings（包含成本和盈亏计算）
    account.holdings.forEach(h => {
        const price = h.asset.currentPrice || 0;
        const value = h.shares * price;
        const cost = h.shares * (h.avgCost || 0);
        const profitLoss = value - cost;
        const profitLossPercent = cost > 0 ? (profitLoss / cost) * 100 : 0;
        
        holdingsValue += value;
        positions.set(h.assetId, {
            assetId: h.assetId,
            symbol: h.asset.symbol,
            name: h.asset.name,
            shares: h.shares,
            avgCost: h.avgCost || 0,
            price: price,
            currentValue: value,
            cost: cost,
            profitLoss: parseFloat(profitLoss.toFixed(2)),
            profitLossPercent: parseFloat(profitLossPercent.toFixed(2)),
            targetPercent: 0, // Default
        });
    });

    // Map allocations (targets)
    account.allocations.forEach(a => {
        if (!positions.has(a.assetId)) {
             positions.set(a.assetId, {
                assetId: a.assetId,
                symbol: a.asset.symbol,
                name: a.asset.name,
                shares: 0,
                avgCost: 0,
                price: a.asset.currentPrice || 0,
                currentValue: 0,
                cost: 0,
                profitLoss: 0,
                profitLossPercent: 0,
                targetPercent: 0,
             });
        }
        const p = positions.get(a.assetId);
        p.targetPercent = a.targetPercent;
    });

    const totalValue = account.cash + holdingsValue;

    // Determine the base value for allocation calculation
    // If targetAmount is set (Preset Investment Amount), use it.
    // Otherwise use totalValue (Account Ratio based on current net worth).
    const allocationBaseValue = (account.targetAmount && account.targetAmount > 0) 
        ? account.targetAmount 
        : totalValue;

    // 2. Calculate Drift & Actions
    const isOTC = account.marketType === 'otc'; // 判断是否为场外账户
    
    const items = Array.from(positions.values()).map(p => {
        // currentPercent is always based on actual totalValue (Net Worth) to show reality
        const currentPercent = totalValue > 0 ? (p.currentValue / totalValue) * 100 : 0;
        
        // targetValue is based on allocationBaseValue (Preset Plan or Current Net Worth)
        const targetValue = allocationBaseValue * (p.targetPercent / 100);
        
        const diffValue = targetValue - p.currentValue;
        
        let actionShares = 0;
        let actionAmount = 0;
        
        if (isOTC) {
            // 场外基金：按金额计算建议，没有手数限制
            // 建议买入/卖出金额（保留到分）
            actionAmount = Math.round(diffValue * 100) / 100;
            // 同时计算份额（用于参考）
            actionShares = p.price > 0 ? diffValue / p.price : 0;
        } else {
            // 场内股票/ETF：按手数（100股）取整
            const rawActionShares = p.price > 0 ? diffValue / p.price : 0;
            const roundedToLot = Math.round(rawActionShares / 100) * 100;
            actionShares = Math.abs(roundedToLot) < 100 ? 0 : roundedToLot;
            actionAmount = actionShares * p.price;
        }
        
        return {
            ...p,
            currentPercent: parseFloat(currentPercent.toFixed(2)),
            targetValue: parseFloat(targetValue.toFixed(2)),
            driftValue: parseFloat(diffValue.toFixed(2)), // + means Buy, - means Sell
            actionShares: parseFloat(actionShares.toFixed(2)),
            actionAmount: parseFloat(actionAmount.toFixed(2)),
            isOTC
        };
    });

    return NextResponse.json({
        account: {
            id: account.id,
            name: account.name,
            platform: account.platform,
            marketType: account.marketType,
            cash: account.cash,
            targetAmount: account.targetAmount,
            totalValue: parseFloat(totalValue.toFixed(2)),
            holdingsValue: parseFloat(holdingsValue.toFixed(2)),
        },
        positions: items.sort((a, b) => b.currentValue - a.currentValue) // Sort by value
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to generate portfolio summary' }, { status: 500 });
  }
}
