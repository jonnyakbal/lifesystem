import type { ExternalJob } from './schemas';

/** No claim is made about the installed Hermes API. This is the v1 transport boundary. */
export interface HermesAdapter {
  capabilities(): Promise<{ adapter: string; contractVersion: '1.0'; installedVersion: string; supportsIdempotency: boolean }>;
  submit(input: { job: ExternalJob; brief: unknown; idempotencyKey: string }): Promise<{ boardId: string; cardId: string }>;
  observe(job: ExternalJob): Promise<{ contractVersion: '1.0'; jobId: string; eventId: string; sequence: number; execution: ExternalJob['execution']; boardId: string; cardId: string }>;
}
export class SimulatedHermesAdapter implements HermesAdapter {
  private cards = new Map<string, { boardId: string; cardId: string }>();
  async capabilities() { return { adapter: 'simulated', contractVersion: '1.0' as const, installedVersion: 'synthetic-test', supportsIdempotency: true }; }
  async submit(input: { job: ExternalJob; brief: unknown; idempotencyKey: string }) {
    const prior = this.cards.get(input.job.id); if (prior) return prior;
    const result = { boardId: 'synthetic-board', cardId: `card-${input.job.id}` }; this.cards.set(input.job.id, result); return result;
  }
  async observe(job: ExternalJob) { const card = this.cards.get(job.id); if (!card) throw new Error('Trabalho não enviado ao adapter simulado.'); return { contractVersion: '1.0' as const, jobId: job.id, eventId: `snapshot-${job.id}-1`, sequence: 1, execution: 'running' as const, ...card }; }
}
