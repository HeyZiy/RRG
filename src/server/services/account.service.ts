import prisma from '@/lib/db';
import type { Prisma } from '@/generated/prisma';

export interface CreateAccountInput {
  name: string;
  platform?: string | null;
  targetAmount?: number | null;
  cash?: number;
  marketType?: string;
}

export interface UpdateAccountInput {
  id: number;
  name?: string;
  platform?: string | null;
  marketType?: string;
  targetAmount?: number | null;
  cash?: number | null;
}

export class AccountService {
  async getAllAccounts() {
    return await prisma.account.findMany({
      include: {
        allocations: { include: { asset: true } },
        transactions: { include: { asset: true } },
        holdings: { include: { asset: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  async createAccount(data: CreateAccountInput) {
    const createData: Prisma.AccountCreateInput = {
      name: String(data.name).trim(),
      platform: data.platform ?? null,
      targetAmount: data.targetAmount,
      cash: data.cash ?? 0,
    };
    if (data.marketType) {
      createData.marketType = data.marketType;
    }
    return await prisma.account.create({ data: createData });
  }

  async updateAccount(data: UpdateAccountInput) {
    const updateData: Prisma.AccountUpdateInput = {};
    if (data.name !== undefined) {
      updateData.name = String(data.name).trim();
    }
    if (data.platform !== undefined) updateData.platform = data.platform;
    if (data.marketType !== undefined) updateData.marketType = data.marketType;
    if (data.targetAmount !== undefined) {
      updateData.targetAmount = data.targetAmount;
    }
    if (data.cash !== undefined && data.cash !== null) {
      updateData.cash = data.cash;
    }

    return await prisma.account.update({
      where: { id: data.id },
      data: updateData
    });
  }

  async deleteAccount(id: number) {
    return await prisma.account.delete({
      where: { id },
    });
  }

  async getAccountById(id: number) {
    return await prisma.account.findUnique({
      where: { id },
      include: {
        allocations: { include: { asset: true } },
        transactions: { include: { asset: true } },
        holdings: { include: { asset: true } },
      },
    });
  }
}

export const accountService = new AccountService();
