import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { ClosedDeal, Position, TradingAccount } from '../types/mt5';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export function subscribeAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

function positionDocPrefix(accountDocId: string): string {
  return accountDocId === 'main' ? 'pos_' : `pos_${accountDocId}_`;
}

function historyDocPrefix(accountDocId: string): string {
  return accountDocId === 'main' ? 'hist_' : `hist_${accountDocId}_`;
}

function isDocForAccount(
  docId: string,
  accountDocId: string,
  mainPrefix: string
): boolean {
  if (accountDocId === 'main') {
    const rest = docId.startsWith(mainPrefix)
      ? docId.slice(mainPrefix.length)
      : '';
    return docId.startsWith(mainPrefix) && !rest.startsWith('acc_');
  }
  return docId.startsWith(`${mainPrefix}${accountDocId}_`);
}

function docToPosition(snap: DocumentSnapshot): Position | null {
  try {
    const data = snap.data();
    if (!data) return null;
    const rawId = snap.id.split('_').pop() || snap.id;
    const ticketId = String(data.ticketId || rawId);
    const symbol = String(data.symbol || 'XAUUSD');
    const isBuy = data.isBuy !== false;
    const lots = Number(data.lots || 0.01);
    const openPrice = Number(data.openPrice || 0);
    const sl =
      typeof data.sl === 'number' && data.sl > 0 ? Number(data.sl) : null;
    const tp =
      typeof data.tp === 'number' && data.tp > 0 ? Number(data.tp) : null;
    const openTime = String(data.openTime || '');

    return {
      id: ticketId,
      symbol,
      type: isBuy ? 'buy' : 'sell',
      lots,
      openPrice,
      openTime,
      sl,
      tp,
      swap: 0.0,
      commission: Number((-7.0 * lots).toFixed(2)),
    };
  } catch {
    return null;
  }
}

function docToHistoryDeal(snap: DocumentSnapshot): ClosedDeal | null {
  try {
    const data = snap.data();
    if (!data) return null;
    const rawId = snap.id.split('_').pop() || snap.id;
    const rawTicketId = String(data.ticketId || rawId);
    const rawSymbol = String(data.symbol || 'XAUUSD');
    const isBalanceOp = rawSymbol.startsWith('WDR:') || rawSymbol === 'BALANCE';
    const symbol = isBalanceOp ? 'BALANCE' : rawSymbol;
    const isBuy = data.isBuy !== false;
    const lots = Number(data.lots ?? 0.01);
    const openPrice = Number(data.openPrice ?? 0);
    const closePrice = Number(data.closePrice ?? openPrice);
    const profit = Number(data.profit ?? 0);
    const comment = rawSymbol.startsWith('WDR:')
      ? rawSymbol.slice(4)
      : isBalanceOp
      ? profit >= 0
        ? 'Deposit'
        : 'Withdrawal'
      : '';
    const rawOpenTime = String(data.openTime || '');
    const closeTime = String(data.closeTime || '');
    const commission = Number(data.commission ?? 0);
    const swap = Number(data.swap ?? 0);

    let parsedOpenTime = rawOpenTime;
    let parsedSl: number | null = null;
    let parsedTp: number | null = null;
    let parsedTicketId = rawTicketId;
    let closeReason: 'manual' | 'sl' | 'tp' | 'deposit' = isBalanceOp
      ? 'deposit'
      : 'manual';

    if (isBalanceOp) {
      if (rawOpenTime.includes('|')) {
        const parts = rawOpenTime.split('|');
        parsedOpenTime = parts[0] || closeTime;
        if (parts[1]) parsedTicketId = parts[1];
      } else if (!parsedOpenTime) {
        parsedOpenTime = closeTime;
      }
    } else if (rawOpenTime.includes('|')) {
      const parts = rawOpenTime.split('|');
      parsedOpenTime = parts[0] || rawOpenTime;
      const slNum = parseFloat(parts[1] || '');
      const tpNum = parseFloat(parts[2] || '');
      if (!isNaN(slNum) && slNum > 0) parsedSl = slNum;
      if (!isNaN(tpNum) && tpNum > 0) parsedTp = tpNum;
      if (parts[3]) parsedTicketId = parts[3];
      if (parts[4] === '1') closeReason = 'sl';
      else if (parts[4] === '2') closeReason = 'tp';
    }

    return {
      id: rawId,
      orderId: parsedTicketId,
      symbol,
      type: isBalanceOp ? 'balance' : isBuy ? 'buy' : 'sell',
      lots: isBalanceOp ? 0 : lots,
      openPrice: isBalanceOp ? 0 : openPrice,
      closePrice: isBalanceOp ? 0 : closePrice,
      openTime: parsedOpenTime || closeTime,
      closeTime: closeTime || parsedOpenTime,
      profit,
      swap,
      commission,
      sl: parsedSl,
      tp: parsedTp,
      closeReason,
      comment,
    };
  } catch {
    return null;
  }
}

export function observeOpenPositions(
  userId: string,
  accountDocId: string = 'main',
  onUpdate: (positions: Position[]) => void
) {
  const path = `users/${userId}/positions`;
  return onSnapshot(
    collection(db, 'users', userId, 'positions'),
    (snapshot) => {
      const list = snapshot.docs
        .filter((d) => isDocForAccount(d.id, accountDocId, 'pos_'))
        .map((d) => docToPosition(d))
        .filter((p): p is Position => p !== null);
      onUpdate(list);
    },
    (err) => handleFirestoreError(err, OperationType.GET, path)
  );
}

export function observeHistoryTrades(
  userId: string,
  accountDocId: string = 'main',
  onUpdate: (deals: ClosedDeal[]) => void
) {
  const path = `users/${userId}/history`;
  return onSnapshot(
    collection(db, 'users', userId, 'history'),
    (snapshot) => {
      const list = snapshot.docs
        .filter((d) => isDocForAccount(d.id, accountDocId, 'hist_'))
        .map((d) => docToHistoryDeal(d))
        .filter((item): item is ClosedDeal => item !== null)
        .sort((a, b) => (a.closeTime || a.openTime).localeCompare(b.closeTime || b.openTime));
      onUpdate(list);
    },
    (err) => handleFirestoreError(err, OperationType.GET, path)
  );
}

export function observeAllAccounts(
  userId: string,
  onUpdate: (accounts: TradingAccount[]) => void
) {
  const path = `users/${userId}/accounts`;
  return onSnapshot(
    collection(db, 'users', userId, 'accounts'),
    (snapshot) => {
      const list: TradingAccount[] = [];
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (!data) return;
        list.push({
          id: d.id,
          name: String(data.accountName || 'MetaTrader User'),
          login: String(data.accountId || '420784'),
          broker: String(data.serverName || 'FusionMarkets-Demo'),
          company: String(data.brokerName || 'Fusion Markets Pty Ltd'),
          server: String(data.serverName || 'FusionMarkets-Demo'),
          balance: Number(data.balance ?? 1.42),
          initialDeposit: Number(data.deposit ?? 674.08),
          leverage: 500,
          currency: 'USD',
          isDemo: !data.isReal,
          logoType: 'fusion',
        });
      });
      if (list.length > 0) {
        onUpdate(list);
      }
    },
    (err) => handleFirestoreError(err, OperationType.GET, path)
  );
}

export async function upsertPositionToCloud(
  userId: string,
  pos: Position,
  currentPrice: number,
  profit: number,
  accountDocId: string = 'main'
): Promise<void> {
  if (!userId) return;
  const docId = `${positionDocPrefix(accountDocId)}${pos.id}`;
  const path = `users/${userId}/positions/${docId}`;
  const docRef = doc(db, 'users', userId, 'positions', docId);
  try {
    const existing = await getDoc(docRef);
    const payload: Record<string, unknown> = {
      userId,
      ticketId: pos.id.slice(0, 40),
      symbol: pos.symbol.slice(0, 20),
      isBuy: pos.type === 'buy',
      lots: Math.max(0.01, Math.min(1000, pos.lots)),
      openPrice: Math.max(0, pos.openPrice),
      currentPrice: Math.max(0, currentPrice),
      profit,
      openTime: (pos.openTime || '2026.11.08 08:00:00').slice(0, 64),
      sl: pos.sl !== null && pos.sl > 0 ? pos.sl : null,
      tp: pos.tp !== null && pos.tp > 0 ? pos.tp : null,
      createdAt: existing.exists()
        ? existing.data()?.createdAt || Timestamp.now()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(docRef, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deletePositionFromCloud(
  userId: string,
  positionId: string,
  accountDocId: string = 'main'
): Promise<void> {
  if (!userId) return;
  const docId = `${positionDocPrefix(accountDocId)}${positionId}`;
  const path = `users/${userId}/positions/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'positions', docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function addHistoryDealToCloud(
  userId: string,
  deal: ClosedDeal,
  accountDocId: string = 'main'
): Promise<void> {
  if (!userId) return;
  const cleanDocKey = deal.id.replace(/[^a-zA-Z0-9_-]/g, '') || String(Date.now());
  const docId = `${historyDocPrefix(accountDocId)}${cleanDocKey}`;
  const path = `users/${userId}/history/${docId}`;
  const docRef = doc(db, 'users', userId, 'history', docId);
  try {
    const existing = await getDoc(docRef);
    const isBalanceOp = deal.type === 'balance';
    const safeTicket = (deal.orderId || deal.id).replace(/\|/g, '').trim() || cleanDocKey;
    const baseCloseTime = (deal.closeTime || deal.openTime || '2026.11.08 08:05:00')
      .replace(/\|/g, ' ')
      .slice(0, 32);

    let encodedSymbol: string;
    let encodedOpenTime: string;

    if (isBalanceOp) {
      const defaultLabel = deal.profit < 0 ? 'Withdrawal' : 'Deposit';
      const cleanComment = (deal.comment || defaultLabel)
        .replace(/\|/g, ' ')
        .trim() || defaultLabel;
      encodedSymbol = `WDR:${cleanComment.slice(0, 70)}`;
      encodedOpenTime = `${baseCloseTime}|${safeTicket}`.slice(0, 160);
    } else {
      encodedSymbol = (deal.symbol || 'XAUUSD').slice(0, 20);
      const baseOpenTime = (deal.openTime || baseCloseTime)
        .replace(/\|/g, ' ')
        .slice(0, 32);
      const hitCode =
        deal.closeReason === 'sl' ? '1' : deal.closeReason === 'tp' ? '2' : '0';
      const slStr = deal.sl !== null && deal.sl > 0 ? String(deal.sl) : '';
      const tpStr = deal.tp !== null && deal.tp > 0 ? String(deal.tp) : '';
      encodedOpenTime = `${baseOpenTime}|${slStr}|${tpStr}|${safeTicket}|${hitCode}`.slice(
        0,
        160
      );
    }

    const payload: Record<string, unknown> = {
      userId,
      ticketId: safeTicket.slice(0, 40),
      symbol: encodedSymbol,
      isBuy: isBalanceOp ? deal.profit >= 0 : deal.type === 'buy',
      lots: isBalanceOp ? 0.0 : Math.max(0.01, Math.min(1000, deal.lots)),
      openPrice: isBalanceOp ? 0.0 : Math.max(0, deal.openPrice),
      closePrice: isBalanceOp ? 0.0 : Math.max(0, deal.closePrice),
      profit: Number(deal.profit.toFixed(2)),
      openTime: encodedOpenTime,
      closeTime: baseCloseTime.slice(0, 64),
      commission: isBalanceOp ? 0.0 : Number(deal.commission.toFixed(2)),
      swap: isBalanceOp ? 0.0 : Number(deal.swap.toFixed(2)),
      createdAt: existing.exists()
        ? existing.data()?.createdAt || Timestamp.now()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(docRef, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteHistoryDealFromCloud(
  userId: string,
  dealId: string,
  accountDocId: string = 'main'
): Promise<void> {
  if (!userId) return;
  const cleanDocKey = dealId.replace(/[^a-zA-Z0-9_-]/g, '');
  const docId = `${historyDocPrefix(accountDocId)}${cleanDocKey}`;
  const path = `users/${userId}/history/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'history', docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveAccountInfoToCloud(
  userId: string,
  account: TradingAccount,
  realizedProfit: number,
  totalSwap: number,
  totalCommission: number,
  accountDocId: string = 'main'
): Promise<void> {
  if (!userId) return;
  const path = `users/${userId}/accounts/${accountDocId}`;
  const docRef = doc(db, 'users', userId, 'accounts', accountDocId);
  try {
    const existing = await getDoc(docRef);
    const payload: Record<string, unknown> = {
      userId,
      balance: Number(account.balance.toFixed(2)),
      deposit: Number(account.initialDeposit.toFixed(2)),
      realizedProfit: Number(realizedProfit.toFixed(2)),
      totalSwap: Number(totalSwap.toFixed(2)),
      totalCommission: Number(totalCommission.toFixed(2)),
      accountName: account.name.slice(0, 100) || 'DEMO_010',
      brokerName: account.company.slice(0, 120) || 'Fusion Markets Pty Ltd',
      accountId: account.login.slice(0, 40) || '420784',
      serverName: account.server.slice(0, 100) || 'FusionMarkets-Demo',
      isReal: !account.isDemo,
      createdAt: existing.exists()
        ? existing.data()?.createdAt || Timestamp.now()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(docRef, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
