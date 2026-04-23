import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { apiError, apiServerError, parseIntField, parseNumberField } from '@/lib/api-response';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseIntField((await params).id);
    if (id === null) {
      return apiError('Invalid id', 400);
    }
    await prisma.assetAllocation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiServerError('Failed to delete allocation', error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseIntField((await params).id);
    if (id === null) {
      return apiError('Invalid id', 400);
    }
    const data = await request.json();
    const targetPercent = parseNumberField(data.targetPercent);
    if (targetPercent === null || targetPercent < 0 || targetPercent > 100) {
      return apiError('targetPercent must be between 0 and 100', 400);
    }

    const current = await prisma.assetAllocation.findUnique({ where: { id } });
    if (!current) {
      return apiError('Allocation not found', 404);
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
      return apiError('配置比例总和不能超过100%', 400);
    }

    const allocation = await prisma.assetAllocation.update({
      where: { id },
      data: { targetPercent },
      include: { asset: true, account: true },
    });
    return NextResponse.json(allocation);
  } catch (error) {
    return apiServerError('Failed to update allocation', error);
  }
}
