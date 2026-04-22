import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { enrichAssetFromEastMoney } from '@/lib/price-fetcher';

export async function GET() {
  try {
    const assets = await prisma.asset.findMany({
      include: {
        allocations: { include: { account: true } },
        transactions: { include: { account: true } },
      },
    });
    return NextResponse.json(assets);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Try to enrich asset data from official source (EastMoney)
    let name = data.name || '';
    let currentPrice = data.currentPrice || null;
    
    if (!name || currentPrice == null) {
      const enriched = await enrichAssetFromEastMoney(data.symbol);
      if (!name && enriched.name) {
        name = enriched.name;
      }
      if (currentPrice == null && enriched.currentPrice) {
        currentPrice = enriched.currentPrice;
      }
    }
    
    // If still no name, use symbol as fallback
    if (!name) {
      name = data.symbol;
    }
    
    const asset = await prisma.asset.create({
      data: {
        name,
        symbol: data.symbol,
        type: data.type || 'stock',
        currentPrice: currentPrice || 0,
      },
    });
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { id, name, type, currentPrice, category } = data;
    
    if (!id) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    const asset = await prisma.asset.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(currentPrice !== undefined && { currentPrice }),
        ...(category !== undefined && { category: category === '' ? null : category }),
      },
    });

    return NextResponse.json(asset);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    // Automatically delete related allocations when deleting asset
    await prisma.assetAllocation.deleteMany({
      where: { assetId: parseInt(id) },
    });

    // Note: Assets with transactions CAN be deleted. User is responsible for understanding implications.
    await prisma.asset.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 });
  }
}