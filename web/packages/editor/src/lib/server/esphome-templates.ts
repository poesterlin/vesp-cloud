import { promises as fs } from 'fs';
import { join, dirname } from 'path';

const templates = import.meta.glob('../templates/improved/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const PREFIX = '../templates/improved/';

export async function copyStaticTemplates(tempDir: string): Promise<void> {
  for (const [key, content] of Object.entries(templates)) {
    const relativePath = key.startsWith(PREFIX) ? key.slice(PREFIX.length) : key;
    const destPath = join(tempDir, relativePath);
    await fs.mkdir(dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, content);
  }
}
