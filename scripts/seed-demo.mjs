import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const dataDir = path.resolve(process.env.LIFESYSTEM_DATA_DIR || path.join(process.cwd(), 'data'));
const file = path.join(dataDir, 'pillars.json');
const definitions = [
  ['Saúde', 'Cuidar do corpo e da energia.', '🌿', '#34d399'],
  ['Trabalho', 'Projetos e entregas profissionais.', '✦', '#a78bfa'],
  ['Aprendizado', 'Estudar e criar conhecimento.', '📚', '#60a5fa'],
  ['Relações', 'Tempo de qualidade com pessoas importantes.', '♡', '#fb7185'],
  ['Finanças', 'Decisões conscientes sobre recursos.', '◈', '#fbbf24'],
  ['Bem-estar', 'Descanso, lazer e reflexão.', '☀', '#f59e0b'],
];

await fs.mkdir(dataDir, { recursive: true });
const now = new Date().toISOString();
const pillars = definitions.map(([name, description, icon, color], sortOrder) => ({
  id: randomUUID(), name, description, icon, color, sortOrder,
  currentStatus: '', target: '', createdAt: now, updatedAt: now,
}));

try {
  await fs.writeFile(file, `${JSON.stringify(pillars, null, 2)}\n`, { flag: 'wx' });
  console.log('Seis pilares demonstrativos criados. Personalize-os no LIFESYSTEM.');
} catch (error) {
  if (error?.code === 'EEXIST') {
    console.error('Já existe pillars.json neste diretório. Nenhum dado foi alterado.');
    process.exitCode = 1;
  } else throw error;
}
