import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { enrichAssetFromEastMoney } from '@/lib/price-fetcher';
import { apiError, apiServerError, parseIntField, parseNumberField } from '@/lib/api-response';

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
    return apiServerError('Failed to fetch assets', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const symbol = String(data?.symbol || '').trim();
    if (!symbol) {
      return apiError('symbol is required', 400);
    }
    
    // Try to enrich asset data from official source (EastMoney)
    let name = String(data.name || '').trim();
    let currentPrice = data.currentPrice != null ? parseNumberField(data.currentPrice) : null;
    if (data.currentPrice != null && currentPrice === null) {
      return apiError('currentPrice must be a valid number', 400);
    }
    
    if (!name || currentPrice == null) {
      const enriched = await enrichAssetFromEastMoney(symbol);
      if (!name && enriched.name) {
        name = enriched.name;
      }
      if (currentPrice == null && enriched.currentPrice) {
        currentPrice = enriched.currentPrice;
      }
    }
    
    // If still no name, use symbol as fallback
    if (!name) {
      name = symbol;
    }
    
    const asset = await prisma.asset.create({
      data: {
        name,
        symbol,
        type: data.type || 'stock',
        currentPrice: currentPrice || 0,
      },
    });
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    return apiServerError('Failed to create asset', error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { id, name, type, currentPrice, category } = data;

    const assetId = parseIntField(id);
    if (assetId === null) {
      return apiError('Asset ID is required', 400);
    }

    const parsedCurrentPrice = currentPrice !== undefined ? parseNumberField(currentPrice) : null;
    if (currentPrice !== undefined && parsedCurrentPrice === null) {
      return apiError('currentPrice must be a valid number', 400);
    }

    const asset = await prisma.asset.update({
      where: { id: assetId },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(type !== undefined && { type }),
        ...(currentPrice !== undefined && { currentPrice: parsedCurrentPrice }),
        ...(category !== undefined && { category: category === '' ? null : category }),
      },
    });

    return NextResponse.json(asset);
  } catch (error) {
    return apiServerError('Failed to update asset', error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const assetId = parseIntField(id);
    if (assetId === null) {
      return apiError('Asset ID is required', 400);
    }

    // Automatically delete related allocations when deleting asset
    await prisma.assetAllocation.deleteMany({
      where: { assetId },
    });

    // Note: Assets with transactions CAN be deleted. User is responsible for understanding implications.
    await prisma.asset.delete({
      where: { id: assetId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiServerError('Failed to delete asset', error);
  }
}