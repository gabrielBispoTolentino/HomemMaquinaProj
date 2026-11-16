// Starts a release: tags the pushed commit with package.json's version (vX.Y.Z) and pushes the tag. GitHub Actions
// (.github/workflows/release.yml) then builds the Windows installer and the Android APK and publishes them as a
// release, which installed apps offer as an update when they open (src/lib/updates.ts).
//
//   1. Raise "version" in package.json (Android takes it from there too, see android/app/build.gradle).
//   2. Commit and push.
//   3. bun run release
const { execFileSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const { version } = require(path.join(root, 'package.json'));
const tag = `v${version}`;

const run = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (run('status', '--porcelain', '--untracked-files=no') !== '') {
  fail('Há mudanças sem commit: faça o commit (e o push) antes de lançar.');
}

run('fetch', '--tags', 'origin');
if (run('tag', '--list', tag) !== '') {
  fail(`A versão ${tag} já existe. Aumente "version" no package.json, faça o commit e tente de novo.`);
}

// The release is built from what's on GitHub, so the commit must already be there.
const commit = run('rev-parse', 'HEAD');
if (run('branch', '-r', '--contains', commit) === '') {
  fail('O commit atual ainda não está no GitHub: faça git push antes de lançar.');
}

run('tag', '-a', tag, '-m', `Archivist ${version}`);
run('push', 'origin', tag);
console.log(`Tag ${tag} enviada. Acompanhe a geração em https://github.com/gabrielBispoTolentino/HomemMaquinaProj/actions`);
