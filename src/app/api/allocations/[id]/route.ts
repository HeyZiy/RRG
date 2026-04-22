import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseInt((await params).id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
    await prisma.assetAllocation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete allocation' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseInt((await params).id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
    const data = await request.json();
    const targetPercent = Number(data.targetPercent);
    if (Number.isNaN(targetPercent) || targetPercent < 0 || targetPercent > 100) {
      return NextResponse.json({ error: 'targetPercent must be between 0 and 100' }, { status: 400 });
    }

    const current = await prisma.assetAllocation.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }

    const otherTotal = await prisma.assetAllocation.aggregate({
      where: {
        accountId: current.accountId,
        NOT: { id: current.id },
      },
      _sum: { targetPercent: true },
    });
    const otherPercent = otherTotal._sum.targetPercent ?? 0;
    if (otherPercent + targetPercent > 100) {
      return NextResponse.json({ error: '配置比例总和不能超过100%' }, { status: 400 });
    }

    const allocation = await prisma.assetAllocation.update({
      where: { id },
      data: { targetPercent },
      include: { asset: true, account: true },
    });
    return NextResponse.json(allocation);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update allocation' }, { status: 500 });
  }
}
