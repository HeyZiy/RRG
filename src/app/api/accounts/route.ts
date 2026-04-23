import { NextRequest, NextResponse } from 'next/server';
import { accountService } from '@/server/services/account.service';
import { apiError, apiServerError, parseIntField, parseNumberField } from '@/lib/api-response';

export async function GET() {
  try {
    const accounts = await accountService.getAllAccounts();
    return NextResponse.json(accounts);
  } catch (error) {
    return apiServerError('Failed to fetch accounts', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    if (!data?.name || String(data.name).trim() === '') {
      return apiError('Account name is required', 400);
    }

    const cash = data.cash != null ? parseNumberField(data.cash) : 0;
    if (cash === null) {
      return apiError('cash must be a valid number', 400);
    }

    const targetAmount =
      data.targetAmount != null && String(data.targetAmount).trim() !== ''
        ? parseNumberField(data.targetAmount)
        : null;
    if (data.targetAmount != null && String(data.targetAmount).trim() !== '' && targetAmount === null) {
      return apiError('targetAmount must be a valid number', 400);
    }

    const account = await accountService.createAccount({
      name: data.name,
      platform: data.platform,
      targetAmount,
      cash,
      marketType: data.marketType,
    });
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return apiServerError('Failed to create account', error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { id, name, platform, marketType, targetAmount, cash } = data;

    const accountId = parseIntField(id);
    if (accountId === null) {
        return apiError('Account ID is required', 400);
    }

    let parsedTargetAmount: number | null | undefined = targetAmount;
    if (targetAmount !== undefined) {
      if (targetAmount === null || String(targetAmount).trim() === '') {
        parsedTargetAmount = null;
      } else {
        parsedTargetAmount = parseNumberField(targetAmount);
        if (parsedTargetAmount === null) {
          return apiError('targetAmount must be a valid number', 400);
        }
      }
    }

    let parsedCash = cash;
    if (cash !== undefined && cash !== null) {
      parsedCash = parseNumberField(cash);
      if (parsedCash === null) {
        return apiError('cash must be a valid number', 400);
      }
    }

    const account = await accountService.updateAccount({
      id: accountId,
      name,
      platform,
      marketType,
      targetAmount: parsedTargetAmount,
      cash: parsedCash,
    });

    return NextResponse.json(account);
  } catch (error) {
    return apiServerError('Failed to update account', error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const accountId = parseIntField(id);
    if (accountId === null) {
      return apiError('Account ID is required', 400);
    }

    await accountService.deleteAccount(accountId);

    return NextResponse.json({ message: 'Account deleted successfully' }, { status: 200 });
  } catch (error) {
    return apiServerError('Failed to delete account', error);
  }
}
