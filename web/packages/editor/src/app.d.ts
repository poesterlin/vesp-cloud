import type { Session } from '$lib/db/schema';

declare global {
  namespace App {
    interface Locals {
      user: { id: string; username: string } | null;
      session: Session | null;
    }
  }
}

export {};
