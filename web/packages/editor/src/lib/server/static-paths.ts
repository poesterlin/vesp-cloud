import { existsSync } from 'fs';
import { join } from 'path';

export function getStaticBuildsDir(): string {
  const monorepoStaticDir = join(process.cwd(), 'packages', 'editor', 'static');
  if (existsSync(monorepoStaticDir)) {
    return join(monorepoStaticDir, 'builds');
  }

  return join(process.cwd(), 'static', 'builds');
}
