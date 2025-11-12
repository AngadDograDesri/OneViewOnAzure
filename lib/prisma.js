import { PrismaClient } from '@/app/generated/prisma/default.js';

const globalForPrisma = global;

// Get the database URL from environment variable
const getDatabaseUrl = () => {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('DATABASE_URL is not defined in environment variables');
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Handle special characters in the connection string
  // If the URL contains unescaped special characters, they need to be encoded
  try {
    // Try to parse and validate the URL format
    // This will help catch encoding issues early
    if (dbUrl.includes('\\') || url.match(/[^:]:\/\/[^@]*[^@\s]+:[^@\s]*[@#$%&\\]/)) {
      console.warn('Connection string may contain special characters that need encoding');
    }
  } catch (e) {
    console.error('Error validating DATABASE_URL:', e.message);
  }

  console.log('Database URL loaded successfully');
  return dbUrl;
};

const prisma = globalForPrisma.prisma || new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl()
    }
  },
  log: ['query', 'error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;