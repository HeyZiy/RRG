import { PrismaClient } from '@/generated/prisma';

const prismaClientSingleton = () => {
  // Use explicit DATABASE_URL if available
  if (process.env.DATABASE_URL) {
    return new PrismaClient();
  }

  // Default fallback if env not found
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./asset_tracker.db';

  return new PrismaClient();
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
