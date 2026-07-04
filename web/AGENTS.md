# vESP.cloud - Agent Instructions

This is a monorepo for the vESP.cloud web application.

## Architecture Overview

### Single-Container Setup (PostgreSQL + Drizzle)

The application uses a simplified architecture where the compilation worker runs inside the SvelteKit application container:

- **Database**: PostgreSQL 16 for persistent job storage
- **ORM**: Drizzle ORM for type-safe database access
- **Queue**: In-memory queue with PostgreSQL persistence
- **Worker**: Worker threads running inside SvelteKit process

### Project Structure

```
web/
├── packages/
│   ├── schema/                    # Component type definitions
│   ├── compilation-service/       # Queue + DB + Worker logic
│   │   ├── src/
│   │   │   ├── db/               # Drizzle schema & connection
│   │   │   ├── queue/            # Worker queue management
│   │   │   └── types/            # TypeScript types
│   │   └── drizzle.config.ts
│   │
│   └── editor/                    # Main SvelteKit app
│       ├── src/
│       │   ├── lib/              # Svelte components & utilities
│       │   ├── routes/           # SvelteKit routes
│       │   └── hooks.server.ts   # Worker initialization
│       ├── Dockerfile
│       └── docker-compose.yml
```

## Database Schema

See `packages/compilation-service/src/db/schema.ts` for the full schema.

Main table: `compilation_jobs`
- Stores all ESPHome compilation jobs
- Tracks status (pending/running/completed/failed)
- Persists output and error messages
- Queryable for history and analytics

## Development Workflow

### Starting the Application

```bash
# Install dependencies
bun install

# Push database schema
bun run db:push

# Start development server
bun run dev
```

### Database Operations

```bash
# Generate migration files
bun run db:generate

# Push schema to database (no migration files)
bun run db:push

# View database in Drizzle Studio
cd packages/compilation-service
bun drizzle-kit studio
```

### Building

```bash
# Build all packages
bun run build
```

## Key Files to Know

- `packages/compilation-service/src/db/schema.ts` - Database schema
- `packages/compilation-service/src/queue/index.ts` - Worker queue logic
- `packages/editor/src/hooks.server.ts` - Server initialization
- `packages/editor/src/routes/api/compile/+server.ts` - API endpoints

## Svelte MCP Tools

You have access to Svelte 5 and SvelteKit documentation:

### 1. list-sections
Use FIRST to discover available documentation sections.

### 2. get-documentation
Retrieves full documentation content for specific sections.

### 3. svelte-autofixer
Analyzes Svelte code and returns issues. MUST use before sending code to user.

### 4. playground-link
Generates a Svelte Playground link. Ask user first, never use if code written to files.

## Important Notes

- Always use `bun` instead of `npm` or `pnpm`
- Database migrations are optional - use `db:push` for development
- The worker starts automatically in `hooks.server.ts`
- Jobs persist in PostgreSQL, surviving server restarts
- See `DATABASE.md` for detailed setup instructions
