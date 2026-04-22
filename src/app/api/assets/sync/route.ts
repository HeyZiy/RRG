import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { enrichAssetFromEastMoney } from '@/lib/price-fetcher';

export async function POST() {
  try {
    const assets = await prisma.asset.findMany({
      select: { id: true, symbol: true, name: true, currentPrice: true },
      orderBy: { id: 'asc' },
    });

    if (assets.length === 0) {
      return NextResponse.json({ message: '没有资产需要更新' });
    }

    let updatedNameCount = 0;
    let updatedPriceCount = 0;
    let unchangedCount = 0;
    let failedCount = 0;

    for (const asset of assets) {
      try {
        const enriched = await enrichAssetFromEastMoney(asset.symbol);

        const nextName = enriched.name?.trim();
        const nextPrice = enriched.currentPrice;

        const data: { name?: string; currentPrice?: number; lastPriceUpdated?: Date } = {};

        if (nextName && nextName !== asset.name) {
          data.name = nextName;
        }

        if (typeof nextPrice === 'number' && Number.isFinite(nextPrice) && nextPrice > 0) {
          if (asset.currentPrice == null || Math.abs(asset.currentPrice - nextPrice) > 1e-8) {
            data.currentPrice = nextPrice;
            data.lastPriceUpdated = new Date();
          }
        }

        if (Object.keys(data).length > 0) {
          await prisma.asset.update({
            where: { id: asset.id },
            data,
          });

          if (data.name) updatedNameCount += 1;
          if (data.currentPrice != null) updatedPriceCount += 1;
        } else {
          unchangedCount += 1;
        }
      } catch (error) {
        failedCount += 1;
        console.error(`更新资产 ${asset.symbol} 失败`, error);
      }
    }

    return NextResponse.json({
      total: assets.length,
      updatedNameCount,
      updatedPriceCount,
      unchangedCount,
      failedCount,
      message: `成功更新 ${updatedNameCount} 个资产名称`
    });
  } catch (error) {
    console.error('更新资产名称失败', error);
    return NextResponse.json({ error: '更新资产名称失败' }, { status: 500 });
  }
}
