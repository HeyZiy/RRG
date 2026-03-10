import { PrismaClient } from '@/generated/prisma';

const prismaClientSingleton = () => {
  // Use explicit DATABASE_URL if available
  if (process.env.DATABASE_URL) {
    return new PrismaClient();
  }

  // Fallback for Railway production volume
  if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
    process.env.DATABASE_URL = 'file:/app/data/asset_tracker.db';
  } else {
    // Local development fallback
    process.env.DATABASE_URL = 'file:./asset_tracker.db';
  }

  return new PrismaClient();
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
