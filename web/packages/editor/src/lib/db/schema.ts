import { pgTable, uuid, text, timestamp, varchar, jsonb, boolean, integer } from 'drizzle-orm/pg-core';

const fullCascade = { onDelete: 'cascade', onUpdate: 'cascade' } as const;

// ── Users ──────────────────────────────────────────────────────────────────
export const usersTable = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').unique('user_email_unique', { nulls: 'distinct' }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  lastLogin: timestamp('last_login', { withTimezone: true, mode: 'date' }),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true, mode: 'date' }),
});

export type User = typeof usersTable.$inferSelect;

// ── Sessions ───────────────────────────────────────────────────────────────
export const sessionTable = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id, fullCascade),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export type Session = typeof sessionTable.$inferSelect;

// ── Projects ───────────────────────────────────────────────────────────────
export const projects = pgTable('project', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id, fullCascade),
  name: varchar('name', { length: 255 }).notNull(),
  data: jsonb('data').notNull(),
  lastSavedData: jsonb('last_saved_data'),
  firmwareToken: uuid('firmware_token').notNull().defaultRandom().unique(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

// ── Compilation Jobs ───────────────────────────────────────────────────────
export const compilationJobs = pgTable('compilation_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  userId: text('user_id').references(() => usersTable.id, { onDelete: 'set null' }),
  projectName: varchar('project_name', { length: 255 }).notNull(),
  config: text('config').notNull(),
  configPath: varchar('config_path', { length: 500 }),
  template: varchar('template', { length: 50 }), // 'initial' for initial flash firmware, null for full dashboard
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  published: boolean('published').notNull().default(false),
  pinned: boolean('pinned').notNull().default(false),
  output: text('output'),
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
});

export type CompilationJob = typeof compilationJobs.$inferSelect;
export type NewCompilationJob = typeof compilationJobs.$inferInsert;

// ── Stripe Customers ────────────────────────────────────────────────────────
export const stripeCustomers = pgTable("stripe_customer", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export type StripeCustomer = typeof stripeCustomers.$inferSelect;

// ── Credit Balances ─────────────────────────────────────────────────────────
export const creditBalances = pgTable("credit_balance", {
  userId: text("user_id").primaryKey(),
  balance: integer("balance").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export type CreditBalance = typeof creditBalances.$inferSelect;

// ── Credit Transactions ─────────────────────────────────────────────────────
export const creditTransactions = pgTable("credit_transaction", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  amount: integer("amount").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  reason: text("reason").notNull(),
  stripeSessionId: text("stripe_session_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export type CreditTransaction = typeof creditTransactions.$inferSelect;

export const stripeEvents = pgTable('stripe_event', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export type StripeEvent = typeof stripeEvents.$inferSelect;
