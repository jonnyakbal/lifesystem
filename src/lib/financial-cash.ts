import { storage } from '@/lib/storage';
import type { Account, CashTransfer } from '@/lib/finance-model';

type BillDebit = {
  kind: 'bill';
  id: string;
  accountId: string;
  amount: number;
  recordedAt: string;
};

type TransferMovement = CashTransfer & { kind: 'transfer' };
type CashMovement = TransferMovement | BillDebit;
type CashAccount = Account & { cashMovements?: CashMovement[]; updatedAt?: string };

export class CashOperationError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

export function balanceCheck(balance: number | undefined) {
  return balance === undefined ? {} : { balanceCheckedAt: new Date().toISOString() };
}

export function moneyCents(amount: number) {
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents)) throw new CashOperationError('O valor está fora do intervalo permitido.', 400);
  return cents;
}

function requireActiveAccount(accounts: CashAccount[], id: string) {
  const account = accounts.find(item => item.id === id && item.isActive);
  if (!account) throw new CashOperationError('Selecione uma conta ativa.', 404);
  return account;
}

function changeBalance(account: CashAccount, delta: number, recordedAt: string) {
  const next = moneyCents(account.balance) + delta;
  if (!Number.isSafeInteger(next)) throw new CashOperationError('O saldo excede o intervalo permitido.', 400);
  account.balance = next / 100;
  account.updatedAt = recordedAt;
}

function movements(accounts: CashAccount[]) {
  return accounts.flatMap(account => account.cashMovements ?? []);
}

export async function listCashTransfers() {
  const accounts = await storage.getAll<CashAccount>('accounts');
  return movements(accounts)
    .filter((movement): movement is TransferMovement => movement.kind === 'transfer')
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, 50);
}

type TransferInput = Pick<CashTransfer, 'id' | 'fromAccountId' | 'toAccountId' | 'amount'>;

export async function transferBetweenAccounts(input: TransferInput) {
  if (input.fromAccountId === input.toAccountId) {
    throw new CashOperationError('A origem e o destino devem ser contas diferentes.', 400);
  }
  const cents = moneyCents(input.amount);
  if (cents < 1) throw new CashOperationError('Informe um valor de pelo menos um centavo.', 400);
  return storage.transact<CashAccount, TransferMovement>('accounts', accounts => {
    const existing = movements(accounts).find(item => item.kind === 'transfer' && item.id === input.id);
    if (existing?.kind === 'transfer') {
      if (existing.fromAccountId === input.fromAccountId && existing.toAccountId === input.toAccountId &&
        moneyCents(existing.amount) === cents) return existing;
      throw new CashOperationError('Esta transferência já foi registrada com outros dados.');
    }
    const source = requireActiveAccount(accounts, input.fromAccountId);
    const destination = requireActiveAccount(accounts, input.toAccountId);
    const recordedAt = new Date().toISOString();
    const movement: TransferMovement = {
      ...input, kind: 'transfer', amount: cents / 100, recordedAt,
      fromAccountName: source.name, toAccountName: destination.name,
    };
    changeBalance(source, -cents, recordedAt);
    changeBalance(destination, cents, recordedAt);
    (source.cashMovements ??= []).push(movement);
    return movement;
  });
}

function findDebit(accounts: CashAccount[], billId: string) {
  return movements(accounts).find((item): item is BillDebit => item.kind === 'bill' && item.id === billId);
}

export async function findBillDebit(billId: string) {
  return findDebit(await storage.getAll<CashAccount>('accounts'), billId);
}

export async function debitBillPayment(billId: string, accountId: string, cents: number) {
  return storage.transact<CashAccount, BillDebit>('accounts', accounts => {
    const existing = findDebit(accounts, billId);
    if (existing) {
      if (existing.accountId === accountId && moneyCents(existing.amount) === cents) return existing;
      throw new CashOperationError('O débito já foi registrado. Use a conta original para concluir a quitação.');
    }
    const account = requireActiveAccount(accounts, accountId);
    const recordedAt = new Date().toISOString();
    const movement: BillDebit = { kind: 'bill', id: billId, accountId, amount: cents / 100, recordedAt };
    changeBalance(account, -cents, recordedAt);
    (account.cashMovements ??= []).push(movement);
    return movement;
  });
}
