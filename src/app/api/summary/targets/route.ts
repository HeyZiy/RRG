import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET: 获取所有大类目标配置
export async function GET() {
  try {
    const targets = await prisma.globalCategoryTarget.findMany({
      orderBy: { category: 'asc' },
    });
    return NextResponse.json(targets);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch targets' }, { status: 500 });
  }
}

// POST: 创建或更新大类目标（upsert by category）
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { category, targetAmount, note } = data;

    if (!category || typeof category !== 'string' || category.trim() === '') {
      return NextResponse.json({ error: '大类名称不能为空' }, { status: 400 });
    }

    const amount = parseFloat(targetAmount ?? '0');
    if (isNaN(amount) || amount < 0) {
      return NextResponse.json({ error: '目标金额必须是非负数' }, { status: 400 });
    }

    const target = await prisma.globalCategoryTarget.upsert({
      where: { category: category.trim() },
      create: {
        category: category.trim(),
        targetAmount: amount,
        note: note ?? null,
      },
      update: {
        targetAmount: amount,
        note: note ?? null,
      },
    });

    return NextResponse.json(target, { status: 200 });
  } catch (error) {
    console.error('Targets POST error:', error);
    return NextResponse.json({ error: 'Failed to save target' }, { status: 500 });
  }
}

// DELETE: 删除大类目标（by category）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    if (!category) {
      return NextResponse.json({ error: 'category is required' }, { status: 400 });
    }

    await prisma.globalCategoryTarget.delete({
      where: { category },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Targets DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete target' }, { status: 500 });
  }
}
