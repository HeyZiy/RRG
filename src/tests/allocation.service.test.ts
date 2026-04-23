import { allocationService } from '../server/services/allocation.service';
import prisma from '../lib/db';

function testId() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

// 测试分配服务
describe('AllocationService', () => {
  // 测试获取分配列表
  test('should get all allocations', async () => {
    const allocations = await allocationService.getAllAllocations();
    expect(Array.isArray(allocations)).toBe(true);
  });

  // 测试获取特定账户的分配列表
  test('should get allocations by accountId', async () => {
    const id = testId();
    // 先创建一个测试账户
    const testAccount = await prisma.account.create({
      data: {
        name: `Test Account ${id}`,
        cash: 10000,
      },
    });

    const allocations = await allocationService.getAllAllocations(testAccount.id);
    expect(Array.isArray(allocations)).toBe(true);

    // 清理测试数据
    await prisma.account.delete({ where: { id: testAccount.id } });
  });

  // 测试保存分配
  test('should save allocation', async () => {
    const id = testId();
    // 创建测试账户和资产
    const testAccount = await prisma.account.create({
      data: {
        name: `Test Account ${id}`,
        cash: 10000,
      },
    });

    const testAsset = await prisma.asset.create({
      data: {
        symbol: `TEST_${id}`,
        name: 'Test Asset',
        type: 'stock',
        currentPrice: 100,
      },
    });

    // 保存分配
    const allocation = await allocationService.saveAllocation({
      accountId: testAccount.id,
      assetId: testAsset.id,
      targetPercent: 50,
    });

    expect(allocation).toBeDefined();
    expect(allocation.targetPercent).toBe(50);

    // 清理测试数据
    await prisma.assetAllocation.delete({ where: { id: allocation.id } });
    await prisma.asset.delete({ where: { id: testAsset.id } });
    await prisma.account.delete({ where: { id: testAccount.id } });
  });

  // 测试分配比例总和验证
  test('should throw error when allocation percentage exceeds 100', async () => {
    const id = testId();
    // 创建测试账户和资产
    const testAccount = await prisma.account.create({
      data: {
        name: `Test Account ${id}`,
        cash: 10000,
      },
    });

    const testAsset1 = await prisma.asset.create({
      data: {
        symbol: `TEST1_${id}`,
        name: 'Test Asset 1',
        type: 'stock',
        currentPrice: 100,
      },
    });

    const testAsset2 = await prisma.asset.create({
      data: {
        symbol: `TEST2_${id}`,
        name: 'Test Asset 2',
        type: 'stock',
        currentPrice: 100,
      },
    });

    // 先保存一个60%的分配
    await allocationService.saveAllocation({
      accountId: testAccount.id,
      assetId: testAsset1.id,
      targetPercent: 60,
    });

    // 尝试保存一个50%的分配，应该失败
    await expect(
      allocationService.saveAllocation({
        accountId: testAccount.id,
        assetId: testAsset2.id,
        targetPercent: 50,
      })
    ).rejects.toThrow('配置比例总和不能超过100%');

    // 清理测试数据
    const allocations = await allocationService.getAllAllocations(testAccount.id);
    for (const allocation of allocations) {
      await prisma.assetAllocation.delete({ where: { id: allocation.id } });
    }
    await prisma.asset.delete({ where: { id: testAsset1.id } });
    await prisma.asset.delete({ where: { id: testAsset2.id } });
    await prisma.account.delete({ where: { id: testAccount.id } });
  });
});
