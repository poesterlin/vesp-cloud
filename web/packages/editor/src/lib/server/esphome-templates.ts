import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const templates = import.meta.glob('../templates/**/*', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const PREFIX = '../templates/';
const workerTemplatesRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../templates');

console.log('Loaded ESPHome templates:', Object.keys(templates));

export async function copyStaticTemplates(tempDir: string): Promise<void> {
  if (Object.keys(templates).length === 0) {
    await fs.cp(workerTemplatesRoot, tempDir, { recursive: true });
    return;
  }

  const writes = Object.entries(templates).map(async ([key, content]) => {
    const relativePath = key.startsWith(PREFIX) ? key.slice(PREFIX.length) : key;
    const destPath = join(tempDir, relativePath);
    await fs.mkdir(dirname(destPath), { recursive: true });

    const existingContent = await fs.readFile(destPath, 'utf-8').catch(() => null);
    if (existingContent === content) return;

    await fs.writeFile(destPath, content);
  });

  await Promise.all(writes);
}
