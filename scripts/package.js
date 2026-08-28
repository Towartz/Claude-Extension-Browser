import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8'));
const version = pkg.version || '0.3.0';
const zipPath = path.resolve(rootDir, `claude-account-switcher-v${version}.zip`);

if (!fs.existsSync(distDir)) {
  console.error('Error: dist/ directory does not exist. Run npm run build first.');
  process.exit(1);
}

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const sizeKb = (archive.pointer() / 1024).toFixed(1);
  console.log(`\nExtension packaged successfully!`);
  console.log(`Archive: ${path.basename(zipPath)} (${sizeKb} KB)`);
  console.log(`Path: ${zipPath}`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(distDir, false);
archive.finalize();
