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

    // Map holdings
    account.holdings.forEach(h => {
        const price = h.asset.currentPrice || 0;
        const value = h.shares * price;
        holdingsValue += value;
        positions.set(h.assetId, {
            assetId: h.assetId,
            symbol: h.asset.symbol,
            name: h.asset.name,
            shares: h.shares,
            price: price,
            currentValue: value,
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
                price: a.asset.currentPrice || 0,
                currentValue: 0,
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
    const items = Array.from(positions.values()).map(p => {
        // currentPercent is always based on actual totalValue (Net Worth) to show reality
        const currentPercent = totalValue > 0 ? (p.currentValue / totalValue) * 100 : 0;
        
        // targetValue is based on allocationBaseValue (Preset Plan or Current Net Worth)
        const targetValue = allocationBaseValue * (p.targetPercent / 100);
        
        const diffValue = targetValue - p.currentValue;
        
        return {
            ...p,
            currentPercent: parseFloat(currentPercent.toFixed(2)),
            targetValue: parseFloat(targetValue.toFixed(2)),
            driftValue: parseFloat(diffValue.toFixed(2)), // + means Buy, - means Sell
            actionShares: p.price > 0 ? Math.round(diffValue / p.price) : 0
        };
    });

    return NextResponse.json({
        account: {
            id: account.id,
            name: account.name,
            platform: account.platform,
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
