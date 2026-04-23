import { NextRequest, NextResponse } from 'next/server';
import { allocationService } from '@/server/services/allocation.service';
import { apiError, apiServerError, parseIntField, parseNumberField } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get('accountId');
    const parsedAccountId = accountId != null ? parseIntField(accountId) : null;
    if (accountId && parsedAccountId === null) {
      return apiError('Invalid accountId', 400);
    }

    const allocations = await allocationService.getAllAllocations(parsedAccountId);
    return NextResponse.json(allocations);
  } catch (error) {
    return apiServerError('Failed to fetch allocations', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const accountId = parseIntField(data.accountId);
    const assetId = parseIntField(data.assetId);
    const targetPercent = parseNumberField(data.targetPercent);

    if (accountId === null || assetId === null) {
      return apiError('accountId and assetId are required', 400);
    }

    if (targetPercent === null || targetPercent < 0 || targetPercent > 100) {
      return apiError('targetPercent must be between 0 and 100', 400);
    }

    const allocation = await allocationService.saveAllocation({
      accountId,
      assetId,
      targetPercent,
    });

    return NextResponse.json(allocation, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('配置比例总和不能超过100%')) {
      return apiError(error.message, 400);
    }
    return apiServerError('Failed to save allocation', error);
  }
}