// checkPrisma.js
import { PrismaClient } from './app/generated/prisma/default.js';

const prisma = new PrismaClient();

const main = async () => {
  console.log('Models available in Prisma client:');
  console.log(Object.keys(prisma));
  await prisma.$disconnect();
};

main();