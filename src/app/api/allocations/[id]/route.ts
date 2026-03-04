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
    const allocation = await prisma.assetAllocation.update({
      where: { id },
      data: {
        targetPercent: data.targetPercent,
      },
      include: { asset: true, account: true },
    });
    return NextResponse.json(allocation);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update allocation' }, { status: 500 });
  }
}
