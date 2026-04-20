import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    // 1. 拉取所有账户的持仓（含 asset 信息）
    const holdings = await prisma.holding.findMany({
      include: {
        asset: true,
        account: { select: { id: true, name: true, marketType: true } },
      },
    });

    // 2. 拉取所有大类目标配置
    const targets = await prisma.globalCategoryTarget.findMany();
    const targetMap = new Map(targets.map(t => [t.category, t]));

    // 3. 按 category 分组统计
    const categoryMap = new Map<string, {
      category: string;
      currentValue: number;
      targetAmount: number;
      targetId: number | null;
      note: string | null;
      assets: Array<{
        assetId: number;
        symbol: string;
        name: string;
        accountId: number;
        accountName: string;
        shares: number;
        price: number;
        value: number;
      }>;
    }>();

    let uncategorizedValue = 0;
    const uncategorizedAssets: Array<{
      assetId: number;
      symbol: string;
      name: string;
      accountId: number;
      accountName: string;
      shares: number;
      price: number;
      value: number;
    }> = [];

    let totalValue = 0;

    for (const h of holdings) {
      const price = h.asset.currentPrice ?? 0;
      const value = h.shares * price;
      totalValue += value;

      const assetEntry = {
        assetId: h.asset.id,
        symbol: h.asset.symbol,
        name: h.asset.name,
        accountId: h.account.id,
        accountName: h.account.name,
        shares: h.shares,
        price,
        value: parseFloat(value.toFixed(2)),
      };

      const cat = h.asset.category;
      if (!cat) {
        uncategorizedValue += value;
        uncategorizedAssets.push(assetEntry);
      } else {
        if (!categoryMap.has(cat)) {
          const target = targetMap.get(cat);
          categoryMap.set(cat, {
            category: cat,
            currentValue: 0,
            targetAmount: target?.targetAmount ?? 0,
            targetId: target?.id ?? null,
            note: target?.note ?? null,
            assets: [],
          });
        }
        const group = categoryMap.get(cat)!;
        group.currentValue += value;
        group.assets.push(assetEntry);
      }
    }

    // 4. 把还没有持仓但有目标配置的大类也加进来
    for (const [cat, target] of targetMap) {
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, {
          category: cat,
          currentValue: 0,
          targetAmount: target.targetAmount,
          targetId: target.id,
          note: target.note ?? null,
          assets: [],
        });
      }
    }

    // 5. 整理输出
    const categories = Array.from(categoryMap.values()).map(g => ({
      ...g,
      currentValue: parseFloat(g.currentValue.toFixed(2)),
      diff: parseFloat((g.currentValue - g.targetAmount).toFixed(2)), // + 超配, - 欠配
    }));

    // 按当前持仓金额降序排
    categories.sort((a, b) => b.currentValue - a.currentValue);

    return NextResponse.json({
      totalValue: parseFloat(totalValue.toFixed(2)),
      categories,
      uncategorized: {
        currentValue: parseFloat(uncategorizedValue.toFixed(2)),
        assets: uncategorizedAssets,
      },
    });
  } catch (error) {
    console.error('Summary API error:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
