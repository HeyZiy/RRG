import { summaryService } from '../server/services/summary.service';
import prisma from '../lib/db';

function testId() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

// 测试汇总服务
describe('SummaryService', () => {
  // 测试获取汇总数据
  test('should get summary data', async () => {
    const summary = await summaryService.getSummary();
    expect(summary).toBeDefined();
    expect(typeof summary.totalValue).toBe('number');
    expect(Array.isArray(summary.categories)).toBe(true);
    expect(summary.uncategorized).toBeDefined();
  });

  // 测试包含现金类别的汇总
  test('should include cash category in summary', async () => {
    const id = testId();
    // 创建测试账户并设置现金
    const testAccount = await prisma.account.create({
      data: {
        name: `Test Account ${id}`,
        cash: 5000,
      },
    });

    const summary = await summaryService.getSummary();
    expect(summary).toBeDefined();
    
    // 检查是否包含现金类别
    const cashCategory = summary.categories.find(cat => cat.category === '现金');
    expect(cashCategory).toBeDefined();
    expect(cashCategory?.currentValue).toBeGreaterThan(0);

    // 清理测试数据
    await prisma.account.delete({ where: { id: testAccount.id } });
  });

  // 测试包含资产类别的汇总
  test('should include asset categories in summary', async () => {
    const id = testId();
    const symbol = `AAPL_${id}`;

    // 创建测试账户、资产和持仓
    const testAccount = await prisma.account.create({
      data: {
        name: `Test Account ${id}`,
        cash: 1000,
      },
    });

    const testAsset = await prisma.asset.create({
      data: {
        symbol,
        name: 'Apple Inc.',
        type: 'stock',
        category: '科技',
        currentPrice: 100,
      },
    });

    const testHolding = await prisma.holding.create({
      data: {
        accountId: testAccount.id,
        assetId: testAsset.id,
        shares: 10,
        avgCost: 90,
      },
    });

    const summary = await summaryService.getSummary();
    expect(summary).toBeDefined();
    
    // 检查是否包含科技类别
    const techCategory = summary.categories.find(cat => cat.category === '科技');
    expect(techCategory).toBeDefined();
    expect(techCategory?.currentValue).toBe(1000); // 10 shares * $100

    // 清理测试数据
    await prisma.holding.delete({ where: { id: testHolding.id } });
    await prisma.asset.delete({ where: { id: testAsset.id } });
    await prisma.account.delete({ where: { id: testAccount.id } });
  });
});
