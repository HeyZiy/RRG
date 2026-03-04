import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        allocations: { include: { asset: true } },
        transactions: { include: { asset: true } },
        holdings: { include: { asset: true } }, // Newly added relation
      },
      orderBy: { id: 'asc' },
    });
    return NextResponse.json(accounts);
  } catch (error: any) {
    console.error('API Error:', error); // Log actual error
    return NextResponse.json({ error: 'Failed to fetch accounts', details: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const account = await prisma.account.create({
      data: {
        name: data.name,
        platform: data.platform ?? null,
        targetAmount: data.targetAmount != null ? parseFloat(data.targetAmount) : null,
        cash: data.cash != null ? parseFloat(data.cash) : 0, // Handle cash
      },
    });
    return NextResponse.json(account, { status: 201 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to create account', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { id, name, platform, targetAmount, cash } = data;
    
    if (!id) {
        return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (platform !== undefined) updateData.platform = platform;
    if (targetAmount !== undefined) updateData.targetAmount = targetAmount;
    if (cash !== undefined && cash !== null) updateData.cash = cash;

    const account = await prisma.account.update({
        where: { id: parseInt(id) },
        data: updateData
    });

    return NextResponse.json(account);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }
    
    await prisma.account.delete({
      where: { id: parseInt(id) },
    });
    
    return NextResponse.json({ message: 'Account deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to delete account', details: error.message }, { status: 500 });
  }
}
