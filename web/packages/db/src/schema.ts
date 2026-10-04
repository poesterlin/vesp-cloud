import { pgTable, uuid, text, timestamp, varchar, jsonb, boolean, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const fullCascade = { onDelete: 'cascade', onUpdate: 'cascade' } as const;

// ── Users ──────────────────────────────────────────────────────────────────
export const usersTable = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email'),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  lastLogin: timestamp('last_login', { withTimezone: true, mode: 'date' }),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true, mode: 'date' }),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'date' }),
});

export type User = typeof usersTable.$inferSelect;

// ── Email Verification Tokens ──────────────────────────────────────────
export const emailVerificationTokens = pgTable('email_verification_token', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id, fullCascade),
  email: text('email').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;

// ── Sessions ───────────────────────────────────────────────────────────────
export const sessionTable = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id, fullCascade),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export type Session = typeof sessionTable.$inferSelect;

// ── Password Reset Tokens ──────────────────────────────────────────────────
export const passwordResetTokens = pgTable('password_reset_token', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id, fullCascade),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

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

// Immutable boot-manifest artifacts and the firmware resources they require.
export const uiFirmwareBuilds = pgTable('ui_firmware_build', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').unique().references(() => compilationJobs.id, { onDelete: 'set null' }),
  sourceExport: boolean('source_export').notNull().default(false),
  available: boolean('available').notNull().default(false),
  projectId: uuid('project_id').notNull().references(() => projects.id, fullCascade),
  capabilities: jsonb('capabilities').notNull(),
  manifestBase64: text('manifest_base64').notNull(),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  fingerprint: varchar('fingerprint', { length: 16 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const uiManifestReleases = pgTable('ui_manifest_release', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, fullCascade),
  revision: integer('revision').notNull(),
  requirements: jsonb('requirements').notNull(),
  manifestBase64: text('manifest_base64').notNull(),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  fingerprint: varchar('fingerprint', { length: 16 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('ui_manifest_release_project_revision').on(table.projectId, table.revision)]);

export const uiDeviceBoots = pgTable('ui_device_boot', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, fullCascade),
  deviceId: varchar('device_id', { length: 64 }).notNull(),
  firmwareBuildId: uuid('firmware_build_id').references(() => uiFirmwareBuilds.id, { onDelete: 'set null' }),
  fingerprint: varchar('fingerprint', { length: 16 }).notNull(),
  source: varchar('source', { length: 16 }).notNull(),
  error: varchar('error', { length: 512 }),
  reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('ui_device_boot_project_device').on(table.projectId, table.deviceId)]);

// ── Stripe Customers ────────────────────────────────────────────────────────
export const stripeCustomers = pgTable("stripe_customer", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export type StripeCustomer = typeof stripeCustomers.$inferSelect;

// ── Stripe Checkout Sessions ────────────────────────────────────────────────
export const stripeCheckoutSessions = pgTable('stripe_checkout_session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  priceId: text('price_id').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  consentAt: timestamp('consent_at', { withTimezone: true, mode: 'date' }),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export type StripeCheckoutSession = typeof stripeCheckoutSessions.$inferSelect;

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
  packKey: text("pack_key"),
  amountPaidCents: integer("amount_paid_cents"),
  currency: varchar("currency", { length: 3 }),
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

// ── Withdrawal Requests ─────────────────────────────────────────────────────
export const withdrawalRequests = pgTable(
  'withdrawal_request',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stripeSessionId: text('stripe_session_id').notNull(),
    userId: text('user_id').references(() => usersTable.id, { onDelete: 'set null' }),
    email: text('email').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    creditsPurchased: integer('credits_purchased'),
    amountPaidCents: integer('amount_paid_cents'),
    creditsConsumed: integer('credits_consumed'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'date' }),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('withdrawal_request_stripe_session_active_idx')
      .on(table.stripeSessionId)
      .where(sql`${table.status} <> 'rejected'`),
  ],
);

export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type NewWithdrawalRequest = typeof withdrawalRequests.$inferInsert;

// ── Feedback ────────────────────────────────────────────────────────────────
export const feedbackEntries = pgTable('feedback_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id, fullCascade),
  message: text('message').notNull(),
  attachmentKey: text('attachment_key'),
  attachmentName: text('attachment_name'),
  attachmentType: varchar('attachment_type', { length: 50 }),
  attachmentSize: integer('attachment_size'),
  adminReply: text('admin_reply'),
  repliedAt: timestamp('replied_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type FeedbackEntry = typeof feedbackEntries.$inferSelect;
export type NewFeedbackEntry = typeof feedbackEntries.$inferInsert;
