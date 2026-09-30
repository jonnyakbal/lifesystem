import { z } from 'zod';
export const brandSchema = z.enum(['arco-labs', 'arcopass', 'atelie-studio', 'freelance']);
export const BRANDS = [
  { id: 'arco-labs', name: 'Arco Labs', handle: '@arcolabsmkt', priority: 'Caixa com serviços' },
  { id: 'arcopass', name: 'Arcopass', handle: '@arcopass', priority: 'Validação de produto' },
  { id: 'atelie-studio', name: 'Ateliê Studio', handle: '@ateliestudioapp', priority: 'Validação de produto' },
  { id: 'freelance', name: 'Freelas', handle: '', priority: 'Serviços e vídeo' },
] as const;
