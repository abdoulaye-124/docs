import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default function globalSetup() {
  if (process.env.TERANGA_E2E_NO_RESET) return;
  const script = fileURLToPath(new URL('../../../dev/local-stack.sh', import.meta.url));
  execFileSync(script, ['reset'], { stdio: 'inherit' });
}
