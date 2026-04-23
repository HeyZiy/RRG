import prisma from '../lib/db';

beforeAll(() => {
  const databaseUrl = process.env.DATABASE_URL || '';
  const isTestDb =
    databaseUrl.includes('.test.db') ||
    databaseUrl.includes('_test.db') ||
    databaseUrl.includes('test.db');

  if (!isTestDb) {
    throw new Error(`Unsafe DATABASE_URL for tests: ${databaseUrl}`);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
