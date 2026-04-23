import { transactionService } from '../server/services/transaction.service';
import prisma from '../lib/db';

function testId() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

// 测试交易服务
describe('TransactionService', () => {
  // 测试获取交易列表
  test('should get all transactions', async () => {
    const transactions = await transactionService.getAllTransactions();
    expect(Array.isArray(transactions)).toBe(true);
  });

  // 测试获取特定账户的交易列表
  test('should get transactions by accountId', async () => {
    // 先创建一个测试账户
    const testAccount = await prisma.account.create({
      data: {
        name: 'Test Account',
        cash: 10000,
      },
    });

    const transactions = await transactionService.getAllTransactions(testAccount.id);
    expect(Array.isArray(transactions)).toBe(true);

    // 清理测试数据
    await prisma.account.delete({ where: { id: testAccount.id } });
  });

  // 测试创建买入交易
  test('should create buy transaction', async () => {
    const id = testId();
    const symbol = `AAPL_${id}`;

    // 创建测试账户
    const testAccount = await prisma.account.create({
      data: {
        name: `Test Account ${id}`,
        cash: 10000,
        marketType: 'exchange',
      },
    });

    // 创建买入交易
    const transaction = await transactionService.createTransaction({
      accountId: testAccount.id,
      type: 'buy',
      date: new Date(),
      shares: 10,
      price: 100,
      amount: 1000,
      symbol,
      name: 'Apple Inc.',
      assetType: 'stock',
      syncCash: true,
    });

    expect(transaction).toBeDefined();
    expect(transaction.type).toBe('buy');
    expect(transaction.shares).toBe(10);

    // 检查账户现金是否减少
    const updatedAccount = await prisma.account.findUnique({ where: { id: testAccount.id } });
    expect(updatedAccount?.cash).toBe(9000); // 10000 - 1000

    // 检查持仓是否创建
    const holding = await prisma.holding.findUnique({
      where: { accountId_assetId: { accountId: testAccount.id, assetId: transaction.assetId } },
    });
    expect(holding).toBeDefined();
    expect(holding?.shares).toBe(10);

    // 清理测试数据
    await prisma.transaction.delete({ where: { id: transaction.id } });
    if (holding) {
      await prisma.holding.delete({ where: { id: holding.id } });
    }
    await prisma.asset.delete({ where: { id: transaction.assetId } });
    await prisma.account.delete({ where: { id: testAccount.id } });
  });

  // 测试创建卖出交易
  test('should create sell transaction', async () => {
    const id = testId();
    const symbol = `AAPL_${id}`;

    // 创建测试账户和资产
    const testAccount = await prisma.account.create({
      data: {
        name: `Test Account ${id}`,
        cash: 10000,
        marketType: 'exchange',
      },
    });

    const testAsset = await prisma.asset.create({
      data: {
        symbol,
        name: 'Apple Inc.',
        type: 'stock',
        currentPrice: 100,
      },
    });

    // 创建持仓
    const holding = await prisma.holding.create({
      data: {
        accountId: testAccount.id,
        assetId: testAsset.id,
        shares: 20,
        avgCost: 90,
      },
    });

    // 创建卖出交易
    const transaction = await transactionService.createTransaction({
      accountId: testAccount.id,
      type: 'sell',
      date: new Date(),
      shares: 10,
      price: 100,
      amount: 1000,
      assetId: testAsset.id,
      syncCash: true,
    });

    expect(transaction).toBeDefined();
    expect(transaction.type).toBe('sell');
    expect(transaction.shares).toBe(10);

    // 检查账户现金是否增加
    const updatedAccount = await prisma.account.findUnique({ where: { id: testAccount.id } });
    expect(updatedAccount?.cash).toBe(11000); // 10000 + 1000

    // 检查持仓是否更新
    const updatedHolding = await prisma.holding.findUnique({ where: { id: holding.id } });
    expect(updatedHolding?.shares).toBe(10); // 20 - 10

    // 清理测试数据
    await prisma.transaction.delete({ where: { id: transaction.id } });
    await prisma.holding.delete({ where: { id: holding.id } });
    await prisma.asset.delete({ where: { id: testAsset.id } });
    await prisma.account.delete({ where: { id: testAccount.id } });
  });
});
