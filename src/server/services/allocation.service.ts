import prisma from '@/lib/db';

export interface SaveAllocationInput {
  accountId: number;
  assetId: number;
  targetPercent: number;
}

export class AllocationService {
  async getAllAllocations(accountId?: number) {
    const allocations = await prisma.assetAllocation.findMany({
      where: accountId ? { accountId } : undefined,
      include: {
        asset: true,
        account: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });

    // 去重处理
    const deduped = new Map<string, (typeof allocations)[number]>();
    allocations.forEach((item) => {
      const key = `${item.accountId}:${item.assetId}`;
      if (!deduped.has(key)) {
        deduped.set(key, item);
      }
    });

    return Array.from(deduped.values());
  }

  async saveAllocation(data: SaveAllocationInput) {
    const { accountId, assetId, targetPercent } = data;

    return await prisma.$transaction(async (tx) => {
      // 检查是否存在相同的分配记录
      const samePairRows = await tx.assetAllocation.findMany({
        where: { accountId, assetId },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      });

      // 计算其他分配的总比例
      const otherTotal = await tx.assetAllocation.aggregate({
        where: { accountId, NOT: { assetId } },
        _sum: { targetPercent: true },
      });
      const otherPercent = otherTotal._sum.targetPercent ?? 0;

      if (otherPercent + targetPercent > 100) {
        throw new Error('配置比例总和不能超过100%');
      }

      let currentId: number;
      if (samePairRows.length > 0) {
        // 更新现有记录
        currentId = samePairRows[0].id;
        await tx.assetAllocation.update({
          where: { id: currentId },
          data: { targetPercent },
        });

        // 删除重复记录
        if (samePairRows.length > 1) {
          await tx.assetAllocation.deleteMany({
            where: {
              id: {
                in: samePairRows.slice(1).map((row) => row.id),
              },
            },
          });
        }
      } else {
        // 创建新记录
        const created = await tx.assetAllocation.create({
          data: { accountId, assetId, targetPercent },
        });
        currentId = created.id;
      }

      // 返回更新后的分配记录
      return tx.assetAllocation.findUnique({
        where: { id: currentId },
        include: { asset: true, account: true },
      });
    });
  }

  async deleteAllocation(id: number) {
    return await prisma.assetAllocation.delete({
      where: { id },
    });
  }

  async getAllocationById(id: number) {
    return await prisma.assetAllocation.findUnique({
      where: { id },
      include: { asset: true, account: true },
    });
  }
}

export const allocationService = new AllocationService();
