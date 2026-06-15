import type { Config } from 'drizzle-kit';

export default {
  schema: '../db/src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://esphome:changeme@localhost:5432/esphome',
  },
} satisfies Config;
