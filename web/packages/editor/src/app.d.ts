import type { Session } from '@esphome-designer/db/schema';

declare global {
  namespace App {
    interface Locals {
      user: { id: string; username: string } | null;
      session: Session | null;
    }
  }
}

export {};
