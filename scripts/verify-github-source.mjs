import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 30000 }).trim();
try {
  if (git(['status', '--porcelain'])) throw new Error('Source non committée. Terminer le commit avant publication.');
  const head = git(['rev-parse', 'HEAD']);
  const remote = git(['ls-remote', '--exit-code', 'https://github.com/supertrampsss/Braise.git', 'refs/heads/main']).split(/\s+/)[0];
  if (head !== remote) throw new Error('La source locale diffère de GitHub main. Synchroniser le dépôt avant publication Sites.');
  console.log(`Source GitHub main vérifiée : ${head}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
