import { NextRequest, NextResponse } from 'next/server';
import { transactionService } from '@/server/services/transaction.service';
import { apiError, apiServerError, parseIntField, parseNumberField } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get('accountId');
    const parsedAccountId = accountId != null ? parseIntField(accountId) : null;
    if (accountId && parsedAccountId === null) {
      return apiError('Invalid accountId', 400);
    }

    const transactions = await transactionService.getAllTransactions(parsedAccountId);
    return NextResponse.json(transactions);
  } catch (error) {
    return apiServerError('Failed to fetch transactions', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const accountId = parseIntField(data.accountId);
    if (accountId === null) {
      return apiError('accountId is required', 400);
    }

    const type = data.type;
    if (type !== 'buy' && type !== 'sell') {
      return apiError('type must be buy or sell', 400);
    }

    const parsedDate = new Date(data.date);
    if (Number.isNaN(parsedDate.getTime())) {
      return apiError('date is invalid', 400);
    }

    const parsedShares = parseNumberField(data.shares ?? 0);
    if (parsedShares === null || parsedShares < 0) {
      return apiError('shares must be a non-negative number', 400);
    }

    const price = data.price != null && data.price !== '' ? parseNumberField(data.price) : null;
    if (data.price != null && data.price !== '' && price === null) {
      return apiError('price must be a valid number', 400);
    }

    const amount = data.amount != null && data.amount !== '' ? parseNumberField(data.amount) : null;
    if (data.amount != null && data.amount !== '' && amount === null) {
      return apiError('amount must be a valid number', 400);
    }

    const assetId = data.assetId != null && data.assetId !== '' ? parseIntField(data.assetId) : null;
    if (data.assetId != null && data.assetId !== '' && assetId === null) {
      return apiError('assetId must be a valid integer', 400);
    }

    const result = await transactionService.createTransaction({
      accountId,
      type,
      date: parsedDate,
      shares: parsedShares,
      price,
      amount,
      assetId,
      symbol: data.symbol,
      name: data.name,
      assetType: data.assetType,
      syncCash: data.syncCash,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      const businessErrors = new Set([
        '账户不存在',
        '必须提供 assetId 或 symbol',
        '请填写价格，或确保该资产支持自动获取行情',
      ]);
      if (businessErrors.has(error.message)) {
        return apiError(error.message, 400);
      }
    }
    return apiServerError('Failed to create transaction', error);
  }
}