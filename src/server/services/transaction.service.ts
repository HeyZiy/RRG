import prisma from '@/lib/db';
import { getPriceBySymbolDate } from '@/lib/price-fetcher';

export type TxType = 'buy' | 'sell';

export interface CreateTransactionInput {
  accountId: number;
  type: TxType;
  date: Date;
  shares: number;
  price?: number | null;
  amount?: number | null;
  assetId?: number | null;
  symbol?: string;
  name?: string;
  assetType?: string;
  syncCash?: boolean;
}

export class TransactionService {
  async getAllTransactions(accountId?: number) {
    return await prisma.transaction.findMany({
      where: accountId != null ? { accountId } : undefined,
      include: {
        asset: true,
        account: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async createTransaction(data: CreateTransactionInput) {
    const { accountId, type, date, shares, price, amount, assetId, symbol, name, assetType, syncCash = true } = data;

    return await prisma.$transaction(async (tx) => {
      // 获取账户信息
      const account = await tx.account.findUnique({
        where: { id: accountId },
        select: { id: true, marketType: true },
      });

      if (!account) {
        throw new Error('账户不存在');
      }

      const isOTC = account.marketType === 'otc';

      // 1. 解析或创建资产
      let resolvedAssetId = assetId;
      let resolvedAssetSymbol = '';

      const inputSymbol = String(symbol || '').trim();

      if (!resolvedAssetId && inputSymbol) {
        // 查找现有资产
        const existing = await tx.asset.findUnique({ where: { symbol: inputSymbol } });
        if (existing) {
          resolvedAssetId = existing.id;
          resolvedAssetSymbol = existing.symbol;
        } else {
          // 创建新资产
          const manualName = String(name || inputSymbol).trim();
          const defaultAssetType = isOTC ? 'fund' : 'stock';
          const newAsset = await tx.asset.create({
            data: {
              symbol: inputSymbol,
              name: manualName,
              type: assetType || defaultAssetType,
              currentPrice: price ?? 0,
              lastPriceUpdated: new Date(),
            }
          });
          resolvedAssetId = newAsset.id;
          resolvedAssetSymbol = newAsset.symbol;
        }
      } else if (resolvedAssetId != null) {
        // 获取现有资产信息
        const existing = await tx.asset.findUnique({ where: { id: resolvedAssetId } });
        if (existing) resolvedAssetSymbol = existing.symbol;
      }

      if (resolvedAssetId == null) {
        throw new Error('必须提供 assetId 或 symbol');
      }

      // 2. 获取价格（如果缺失）
      let resolvedPrice = price;
      let resolvedAmount = amount;

      if (resolvedPrice == null && shares > 0 && resolvedAssetSymbol) {
        const fetched = await getPriceBySymbolDate(resolvedAssetSymbol, date);
        if (fetched != null) {
          resolvedPrice = fetched;
          resolvedAmount = Math.round(shares * fetched * 100) / 100;
        }
      }

      // 重新计算金额
      if ((resolvedAmount === null || resolvedAmount === 0) && resolvedPrice && shares) {
        resolvedAmount = Math.round(shares * resolvedPrice * 100) / 100;
      }

      if (resolvedPrice == null || ((resolvedAmount === null || resolvedAmount === 0) && shares > 0)) {
        throw new Error('请填写价格，或确保该资产支持自动获取行情');
      }

      // 3. 更新资产价格
      if (resolvedPrice != null && resolvedPrice > 0) {
        await tx.asset.update({
          where: { id: resolvedAssetId },
          data: { 
            currentPrice: resolvedPrice, 
            lastPriceUpdated: new Date() 
          }
        });
      }

      // 4. 创建交易记录
      const transaction = await tx.transaction.create({
        data: {
          accountId,
          assetId: resolvedAssetId,
          type,
          amount: resolvedAmount as number,
          price: resolvedPrice as number,
          shares,
          date,
          syncCash,
        },
        include: { asset: true, account: true },
      });

      // 5. 更新账户现金
      if (syncCash) {
        const cashChange = type === 'buy' ? -resolvedAmount : resolvedAmount;
        await tx.account.update({
          where: { id: accountId },
          data: { cash: { increment: cashChange } },
        });
      }

      // 6. 更新持仓
      const existingHolding = await tx.holding.findUnique({
        where: { accountId_assetId: { accountId, assetId: resolvedAssetId } },
      });

      if (existingHolding) {
        let newShares = existingHolding.shares;
        let newCost = existingHolding.avgCost;
        
        if (type === 'buy') {
          const totalCost = (existingHolding.shares * existingHolding.avgCost) + resolvedAmount;
          newShares += shares;
          newCost = newShares > 0 ? totalCost / newShares : 0;
        } else {
          newShares -= shares;
          if (newShares <= 0.0001) newShares = 0;
        }

        await tx.holding.update({
          where: { id: existingHolding.id },
          data: { shares: newShares, avgCost: newCost },
        });
      } else if (type === 'buy') {
        // 创建新持仓
        await tx.holding.create({
          data: {
            accountId,
            assetId: resolvedAssetId,
            shares,
            avgCost: resolvedPrice as number,
          },
        });
      }

      return transaction;
    });
  }

  async deleteTransaction(id: number) {
    return await prisma.transaction.delete({
      where: { id },
    });
  }

  async getTransactionById(id: number) {
    return await prisma.transaction.findUnique({
      where: { id },
      include: { asset: true, account: true },
    });
  }
}

export const transactionService = new TransactionService();
