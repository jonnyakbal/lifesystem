import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const source = path.resolve(process.env.LIFESYSTEM_DATA_DIR || 'data');
const defaultBackupRoot = process.env.LIFESYSTEM_DATA_DIR
  ? path.join(path.dirname(source), 'lifesystem-backups')
  : 'data/backups';
const destinationRoot = path.resolve(process.env.LIFESYSTEM_BACKUP_DIR || defaultBackupRoot);
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const destination = path.join(destinationRoot, stamp);

await mkdir(destination, { recursive: true });
const files = (await readdir(source)).filter((file) => file.endsWith('.json'));
for (const file of files) {
  await cp(path.join(source, file), path.join(destination, file));
}
console.log(`Backup criado: ${destination} (${files.length} arquivos)`);
