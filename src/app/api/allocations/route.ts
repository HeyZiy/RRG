import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get('accountId');
    const parsedAccountId = accountId ? Number.parseInt(accountId, 10) : null;
    if (accountId && Number.isNaN(parsedAccountId)) {
      return NextResponse.json({ error: 'Invalid accountId' }, { status: 400 });
    }

    const allocations = await prisma.assetAllocation.findMany({
      where: parsedAccountId ? { accountId: parsedAccountId } : undefined,
      include: {
        asset: true,
        account: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });

    // Defensively deduplicate legacy rows by accountId+assetId.
    const deduped = new Map<string, (typeof allocations)[number]>();
    allocations.forEach((item) => {
      const key = `${item.accountId}:${item.assetId}`;
      if (!deduped.has(key)) {
        deduped.set(key, item);
      }
    });

    return NextResponse.json(Array.from(deduped.values()));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch allocations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const accountId = Number.parseInt(String(data.accountId), 10);
    const assetId = Number.parseInt(String(data.assetId), 10);
    const targetPercent = Number(data.targetPercent);

    if (Number.isNaN(accountId) || Number.isNaN(assetId)) {
      return NextResponse.json({ error: 'accountId and assetId are required' }, { status: 400 });
    }

    if (Number.isNaN(targetPercent) || targetPercent < 0 || targetPercent > 100) {
      return NextResponse.json({ error: 'targetPercent must be between 0 and 100' }, { status: 400 });
    }

    const allocation = await prisma.$transaction(async (tx) => {
      const samePairRows = await tx.assetAllocation.findMany({
        where: { accountId, assetId },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      });

      const otherTotal = await tx.assetAllocation.aggregate({
        where: { accountId, NOT: { assetId } },
        _sum: { targetPercent: true },
      });
      const otherPercent = otherTotal._sum.targetPercent ?? 0;

      if (otherPercent + targetPercent > 100) {
        throw new Error('配置比例总和不能超过100%');
      }

      let currentId: number;
      if (samePairRows.length > 0) {
        currentId = samePairRows[0].id;
        await tx.assetAllocation.update({
          where: { id: currentId },
          data: { targetPercent },
        });

        if (samePairRows.length > 1) {
          await tx.assetAllocation.deleteMany({
            where: {
              id: {
                in: samePairRows.slice(1).map((row) => row.id),
              },
            },
          });
        }
      } else {
        const created = await tx.assetAllocation.create({
          data: { accountId, assetId, targetPercent },
        });
        currentId = created.id;
      }

      return tx.assetAllocation.findUnique({
        where: { id: currentId },
        include: { asset: true, account: true },
      });
    });

    return NextResponse.json(allocation, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('配置比例总和不能超过100%')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to save allocation' }, { status: 500 });
  }
}