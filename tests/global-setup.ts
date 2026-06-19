import { readFileSync } from 'fs';
import { join } from 'path';

/** Load .env.local into process.env before any test worker starts.
 *  Workers inherit process.env from the main process, so this is the
 *  correct place to load file-based secrets. */
export default function globalSetup() {
  try {
    const content = readFileSync(join(process.cwd(), '.env.local'), 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
  } catch { /* no .env.local in CI — use OS env vars */ }
}
