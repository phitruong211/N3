// Generate local audio for the original JLPT-style exercises on macOS.
// Requires Node with built-in TypeScript stripping (v22.18+) and macOS voices.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { examItems } from '../src/components/listening/examData.ts';

const directory = new URL('../public/audio/jlpt/', import.meta.url).pathname;
mkdirSync(directory, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), 'jlpt-audio-'));
try {
  for (const item of examItems) {
    const aiff = join(temporary, `${item.id}.aiff`);
    const output = join(directory, `${item.id}.m4a`);
    const rate = item.level === 'N4' ? '185' : item.level === 'N3' ? '205' : '220';
    execFileSync('say', ['-v', 'Kyoko', '-r', rate, '-o', aiff, item.transcript.map(line => line.ja).join(' ')]);
    execFileSync('afconvert', [aiff, '-o', output, '-f', 'm4af', '-d', 'aac ', '-b', '64000']);
    console.log(`${item.id}: ${output}`);
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
