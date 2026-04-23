import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { apiError, apiServerError, parseIntField } from '@/lib/api-response';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseIntField((await params).id);
    if (id === null) {
      return apiError('Invalid id', 400);
    }

    // 使用事务来确保数据一致性
    await prisma.$transaction(async (tx) => {
      // 1. 获取要删除的交易记录
      const transaction = await tx.transaction.findUnique({
        where: { id },
        include: { asset: true },
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const { accountId, assetId, type, shares, amount, syncCash } = transaction;

      // 2. 获取当前持仓
      const holding = await tx.holding.findUnique({
        where: { accountId_assetId: { accountId, assetId } },
      });

      if (holding) {
        let newShares = holding.shares;
        let newAvgCost = holding.avgCost;

        if (type === 'buy') {
          // 删除买入交易：减少份额，重新计算成本
          const totalCost = holding.shares * holding.avgCost;
          const removedCost = shares * (amount / shares); // 使用实际成交金额
          newShares = Math.max(0, holding.shares - shares);
          
          // 如果还有剩余份额，重新计算平均成本
          if (newShares > 0.0001) {
            newAvgCost = (totalCost - removedCost) / newShares;
          } else {
            newAvgCost = 0;
          }
        } else if (type === 'sell') {
          // 删除卖出交易：增加份额，平均成本保持不变
          newShares = holding.shares + shares;
        }

        // 更新或删除持仓
        if (newShares <= 0.0001) {
          await tx.holding.delete({
            where: { id: holding.id },
          });
        } else {
          await tx.holding.update({
            where: { id: holding.id },
            data: { 
              shares: newShares, 
              avgCost: newAvgCost 
            },
          });
        }
      }

      // 3. 恢复账户现金（仅当原交易同步过余额时才回滚现金）
      if (syncCash) {
        const cashChange = type === 'buy' ? amount : -amount;
        await tx.account.update({
          where: { id: accountId },
          data: { cash: { increment: cashChange } },
        });
      }

      // 4. 删除交易记录
      await tx.transaction.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiServerError('Failed to delete transaction', error);
  }
}
