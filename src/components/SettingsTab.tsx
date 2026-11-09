import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Mail,
  BookOpen,
  Calendar,
  Send,
  KeyRound,
  FileText,
  Check,
  Cloud,
  LogOut,
  Trash2,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import {
  Candle,
  ClosedDeal,
  Position,
  QuoteData,
  TradingAccount,
} from '../types/mt5';
import {
  ALL_SYMBOL_CONFIGS,
  calculateClosedDealProfit,
  formatMT5DateTime,
  formatMT5Money,
  parseMT5DateTimeMs,
  sortDealsChronologically,
} from '../utils/mt5Formatters';
import { SriLankaMarketHours } from '../services/marketDataFeed';

interface SettingsTabProps {
  accounts: TradingAccount[];
  activeAccount: TradingAccount;
  deals: ClosedDeal[];
  quotes: Record<string, QuoteData>;
  get1mCandles: (symbol: string) => Candle[];
  onSelectAccount: (id: string) => void;
  onUpdateAccount: (updates: Partial<TradingAccount>) => void;
  onTopUpBalance: (amount: number) => void;
  onCreateAccount: (acc: Omit<TradingAccount, 'id'>) => void;
  onUpsertHistoryDeal: (deal: ClosedDeal) => void;
  onDeleteHistoryDeal: (dealId: string) => void;
  onAddRunningPosition: (pos: Position) => void;
  onForceSyncCloud?: () => void;
  twelveDataApiKey: string;
  onSaveTwelveDataKey: (key: string) => void;
  wsStatus: 'simulator' | 'connecting' | 'connected' | 'error';
  journalLogs: string[];
  cloudUserEmail?: string | null;
  onSignInGoogle?: () => void;
  onSignOutCloud?: () => void;
}

const QUICK_MODAL_SYMBOLS = [
  'XAUUSD',
  'USDSEK',
  'USDJPY',
  'USDCNH',
  'NAS100',
  'EURUSD',
  'GBPUSD',
  'BTCUSD',
];

function formatCandleChipTime(sec: number): string {
  const p = SriLankaMarketHours.getSriLankaDateParts(sec * 1000);
  const mo = String(p.month + 1).padStart(2, '0');
  const day = String(p.day).padStart(2, '0');
  const hh = String(p.hour).padStart(2, '0');
  const mm = String(p.minute).padStart(2, '0');
  return `${mo}.${day} ${hh}:${mm}`;
}

function formatCandleFullMinute(sec: number): string {
  const p = SriLankaMarketHours.getSriLankaDateParts(sec * 1000);
  const y = p.year;
  const mo = String(p.month + 1).padStart(2, '0');
  const day = String(p.day).padStart(2, '0');
  const hh = String(p.hour).padStart(2, '0');
  const mm = String(p.minute).padStart(2, '0');
  return `${y}.${mo}.${day} ${hh}:${mm}`;
}

function computeRolloverDays(openTimeStr: string, closeTimeStr: string): number {
  const openMs = parseMT5DateTimeMs(openTimeStr);
  const closeMs = parseMT5DateTimeMs(closeTimeStr);
  if (!openMs || !closeMs || closeMs <= openMs) return 0;

  const startDay = new Date(openMs);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(closeMs);
  endDay.setHours(0, 0, 0, 0);

  let rollovers = 0;
  const cursor = new Date(startDay.getTime());
  while (cursor.getTime() < endDay.getTime()) {
    const dow = cursor.getDay(); // 3 = Wednesday
    if (dow === 3) {
      rollovers += 3; // 3x Wednesday rollover
    } else if (dow !== 0 && dow !== 6) {
      rollovers += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return rollovers;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  accounts,
  activeAccount,
  deals,
  quotes,
  get1mCandles,
  onSelectAccount,
  onUpdateAccount,
  onUpsertHistoryDeal,
  onDeleteHistoryDeal,
  onAddRunningPosition,
  onForceSyncCloud,
  twelveDataApiKey,
  onSaveTwelveDataKey,
  journalLogs,
  cloudUserEmail,
  onSignInGoogle,
  onSignOutCloud,
}) => {
  const [subView, setSubView] = useState<
    'main' | 'accounts' | 'config' | 'journal' | 'mailbox'
  >('main');

  const [controlSubTab, setControlSubTab] = useState<'trades' | 'withdrawals'>(
    'trades'
  );
  const [chartTradeMoveOn, setChartTradeMoveOn] = useState<boolean>(true);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Account Profile Edit Modal State
  const [accountEditModalOpen, setAccountEditModalOpen] = useState(false);
  const [accName, setAccName] = useState(activeAccount.name);
  const [accServer, setAccServer] = useState(activeAccount.server);
  const [accCompany, setAccCompany] = useState(activeAccount.company);
  const [accLogin, setAccLogin] = useState(activeAccount.login);
  const [accLeverage, setAccLeverage] = useState(String(activeAccount.leverage || 500));
  const [initialDepositInput, setInitialDepositInput] = useState(
    String(activeAccount.initialDeposit)
  );
  const [apiKeyInput, setApiKeyInput] = useState(twelveDataApiKey);

  // Trade Add/Edit Modal State (Matches Screenshots 1 & 2)
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [tSymbol, setTSymbol] = useState<string>('XAUUSD');
  const [tType, setTType] = useState<'buy' | 'sell'>('buy');
  const [isRunningTrade, setIsRunningTrade] = useState<boolean>(false);
  const [tLots, setTLots] = useState<string>('0.01');
  const [tTicketId, setTTicketId] = useState<string>('#387253233');
  const [tOpenTime, setTOpenTime] = useState<string>('2026.11.07 02:26:25');
  const [tCloseTime, setTCloseTime] = useState<string>('2026.11.07 02:29:16');
  const [tOpenPrice, setTOpenPrice] = useState<string>('4071.90');
  const [tClosePrice, setTClosePrice] = useState<string>('4071.88');
  const [tSl, setTSl] = useState<string>('');
  const [tTp, setTTp] = useState<string>('');
  const [autoCalcProfit, setAutoCalcProfit] = useState<boolean>(true);
  const [tProfit, setTProfit] = useState<string>('-0.02');
  const [autoCommSwap, setAutoCommSwap] = useState<boolean>(true);
  const [tCommission, setTCommission] = useState<string>('-0.06');
  const [tSwap, setTSwap] = useState<string>('0.00');
  const [tCloseReason, setTCloseReason] = useState<'manual' | 'sl' | 'tp'>(
    'manual'
  );

  // Withdrawal / Deposit Modal State
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null);
  const [bOpType, setBOpType] = useState<'withdrawal' | 'deposit'>('withdrawal');
  const [bAmount, setBAmount] = useState<string>('100.00');
  const [bDateTime, setBDateTime] = useState<string>(() =>
    formatMT5DateTime(new Date())
  );
  const [bComment, setBComment] = useState<string>('Withdrawal');

  const showToast = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 2400);
  };

  // Strictly sort all deals chronologically by date (Oldest = #1)
  const sortedDeals = useMemo(() => sortDealsChronologically(deals), [deals]);
  const tradeHistoryDeals = useMemo(
    () => sortedDeals.filter((d) => d.type !== 'balance'),
    [sortedDeals]
  );
  const balanceHistoryDeals = useMemo(
    () => sortedDeals.filter((d) => d.type === 'balance'),
    [sortedDeals]
  );

  // Financial Summary Metrics (Screenshot 3)
  const extraDeposits = useMemo(
    () =>
      balanceHistoryDeals
        .filter((d) => d.profit > 0)
        .reduce((s, d) => s + d.profit, 0),
    [balanceHistoryDeals]
  );
  const totalWithdrawals = useMemo(
    () =>
      balanceHistoryDeals
        .filter((d) => d.profit < 0)
        .reduce((s, d) => s + d.profit, 0),
    [balanceHistoryDeals]
  );
  const realizedPL = useMemo(
    () =>
      Number(
        tradeHistoryDeals
          .reduce((s, d) => s + d.profit + d.swap + d.commission, 0)
          .toFixed(2)
      ),
    [tradeHistoryDeals]
  );
  const totalDepositDisplay = Number(
    (activeAccount.initialDeposit + extraDeposits).toFixed(2)
  );
  const totalBalanceDisplay = Number(
    (totalDepositDisplay + totalWithdrawals + realizedPL).toFixed(2)
  );

  const getDigits = (sym: string) => {
    const clean = sym.trim().toUpperCase();
    const cfg = ALL_SYMBOL_CONFIGS.find((c) => c.symbol === clean);
    if (cfg) return cfg.digits;
    if (clean === 'XAUUSD' || clean === 'NAS100' || clean === 'BTCUSD') return 2;
    if (clean.endsWith('JPY')) return 3;
    return 5;
  };

  // Recent 1m candles for the currently selected symbol in the Trade Modal
  const symbol1mCandles = useMemo(() => {
    const cleanSym = tSymbol.trim().toUpperCase() || 'XAUUSD';
    const list = get1mCandles(cleanSym);
    return list.slice(-24).reverse(); // Newest first so recent 1m chips appear left-to-right like Screenshot 1 & 2
  }, [tSymbol, get1mCandles]);

  // Match Entry 1m candle to tOpenTime (or fallback to 4th candle / latest)
  const matchedEntryCandle = useMemo(() => {
    if (symbol1mCandles.length === 0) return null;
    const targetPrefix = tOpenTime.trim().slice(0, 16); // "YYYY.MM.DD HH:MM"
    const exact = symbol1mCandles.find(
      (c) => formatCandleFullMinute(c.time) === targetPrefix
    );
    return exact || symbol1mCandles[Math.min(3, symbol1mCandles.length - 1)];
  }, [symbol1mCandles, tOpenTime]);

  // Match Close 1m candle to tCloseTime (or fallback to newest candle)
  const matchedCloseCandle = useMemo(() => {
    if (symbol1mCandles.length === 0) return null;
    const targetPrefix = tCloseTime.trim().slice(0, 16);
    const exact = symbol1mCandles.find(
      (c) => formatCandleFullMinute(c.time) === targetPrefix
    );
    return exact || symbol1mCandles[0];
  }, [symbol1mCandles, tCloseTime]);

  // Auto-calculate 1:500 Profit whenever relevant fields change
  const computedProfitPreview = useMemo(() => {
    const cleanSym = tSymbol.trim().toUpperCase() || 'XAUUSD';
    const lotsNum = Math.max(0.01, parseFloat(tLots) || 0.01);
    const openNum = parseFloat(tOpenPrice) || 0;
    const closeNum = parseFloat(tClosePrice) || 0;
    return calculateClosedDealProfit(cleanSym, tType, lotsNum, openNum, closeNum);
  }, [tSymbol, tType, tLots, tOpenPrice, tClosePrice]);

  useEffect(() => {
    if (autoCalcProfit) {
      setTProfit(computedProfitPreview.toFixed(2));
    }
  }, [autoCalcProfit, computedProfitPreview]);

  // Auto-calculate Commission ($6.00/lot) & Swap (rollover days, 3x Wed)
  const rolloverDaysCount = useMemo(
    () => (isRunningTrade ? 0 : computeRolloverDays(tOpenTime, tCloseTime)),
    [isRunningTrade, tOpenTime, tCloseTime]
  );

  const computedCommPreview = useMemo(() => {
    const lotsNum = Math.max(0.01, parseFloat(tLots) || 0.01);
    return Number((-6.0 * lotsNum).toFixed(2));
  }, [tLots]);

  const computedSwapPreview = useMemo(() => {
    if (rolloverDaysCount <= 0) return 0.0;
    const lotsNum = Math.max(0.01, parseFloat(tLots) || 0.01);
    return Number((-1.2 * lotsNum * rolloverDaysCount).toFixed(2));
  }, [tLots, rolloverDaysCount]);

  useEffect(() => {
    if (autoCommSwap) {
      setTCommission(computedCommPreview.toFixed(2));
      setTSwap(computedSwapPreview.toFixed(2));
    }
  }, [autoCommSwap, computedCommPreview, computedSwapPreview]);

  // Automatic S/L or T/P First-Hit check when S/L or T/P is entered
  const firstHitCheckStatus = useMemo(() => {
    const slVal = parseFloat(tSl);
    const tpVal = parseFloat(tTp);
    const hasSl = tSl.trim() !== '' && !isNaN(slVal) && slVal > 0;
    const hasTp = tTp.trim() !== '' && !isNaN(tpVal) && tpVal > 0;
    if (!hasSl && !hasTp) {
      return 'No T/P or S/L entered • Manual Close (No side line in History)';
    }
    const closeNum = parseFloat(tClosePrice) || 0;
    if (tType === 'buy') {
      if (hasTp && closeNum >= tpVal) {
        return `T/P (${tpVal}) reached at Close • Green Line in History`;
      }
      if (hasSl && closeNum <= slVal) {
        return `S/L (${slVal}) triggered at Close • Red Line in History`;
      }
    } else {
      if (hasTp && closeNum <= tpVal) {
        return `T/P (${tpVal}) reached at Close • Green Line in History`;
      }
      if (hasSl && closeNum >= slVal) {
        return `S/L (${slVal}) triggered at Close • Red Line in History`;
      }
    }
    return 'S/L or T/P set • Select T/P Hit, S/L Hit, or Manual below';
  }, [tSl, tTp, tClosePrice, tType]);

  const generateRandomTicket = () => {
    const num = Math.floor(385000000 + Math.random() * 4999999);
    return `#${num}`;
  };

  const handleOpenAddTradeModal = () => {
    setEditingTradeId(null);
    const defaultSym = 'XAUUSD';
    setTSymbol(defaultSym);
    setTType('buy');
    setIsRunningTrade(false);
    setTLots('0.01');
    setTTicketId(generateRandomTicket());

    const candles = get1mCandles(defaultSym);
    const digits = getDigits(defaultSym);
    if (candles.length >= 4) {
      const entryC = candles[candles.length - 4];
      const closeC = candles[candles.length - 1];
      setTOpenTime(`${formatCandleFullMinute(entryC.time)}:25`);
      setTCloseTime(`${formatCandleFullMinute(closeC.time)}:16`);
      setTOpenPrice(entryC.close.toFixed(digits));
      setTClosePrice(closeC.close.toFixed(digits));
    } else {
      const now = new Date();
      const earlier = new Date(now.getTime() - 3 * 60 * 1000);
      setTOpenTime(formatMT5DateTime(earlier));
      setTCloseTime(formatMT5DateTime(now));
      const q = quotes[defaultSym];
      const baseP = q ? q.bid : 4071.9;
      setTOpenPrice(baseP.toFixed(digits));
      setTClosePrice((baseP - 0.02).toFixed(digits));
    }

    setTSl('');
    setTTp('');
    setAutoCalcProfit(true);
    setAutoCommSwap(true);
    setTCloseReason('manual');
    setTradeModalOpen(true);
  };

  const handleOpenEditTradeModal = (deal: ClosedDeal) => {
    setEditingTradeId(deal.id);
    setTSymbol(deal.symbol);
    setTType(deal.type === 'sell' ? 'sell' : 'buy');
    setIsRunningTrade(false);
    setTLots(String(deal.lots));
    const rawTicket = deal.orderId || deal.id;
    setTTicketId(rawTicket.startsWith('#') ? rawTicket : `#${rawTicket}`);
    setTOpenTime(deal.openTime);
    setTCloseTime(deal.closeTime);
    const digits = getDigits(deal.symbol);
    setTOpenPrice(deal.openPrice.toFixed(digits));
    setTClosePrice(deal.closePrice.toFixed(digits));
    setTSl(deal.sl !== null ? String(deal.sl) : '');
    setTTp(deal.tp !== null ? String(deal.tp) : '');
    setAutoCalcProfit(false);
    setTProfit(deal.profit.toFixed(2));
    setAutoCommSwap(false);
    setTCommission(deal.commission.toFixed(2));
    setTSwap(deal.swap.toFixed(2));
    setTCloseReason(
      deal.closeReason === 'sl' || deal.closeReason === 'tp'
        ? deal.closeReason
        : 'manual'
    );
    setTradeModalOpen(true);
  };

  const handleSelectQuickSymbolInModal = (sym: string) => {
    setTSymbol(sym);
    const digits = getDigits(sym);
    const candles = get1mCandles(sym);
    if (candles.length >= 4 && !editingTradeId) {
      const entryC = candles[candles.length - 4];
      const closeC = candles[candles.length - 1];
      setTOpenTime(`${formatCandleFullMinute(entryC.time)}:25`);
      setTCloseTime(`${formatCandleFullMinute(closeC.time)}:16`);
      setTOpenPrice(entryC.close.toFixed(digits));
      setTClosePrice(closeC.close.toFixed(digits));
    } else if (!editingTradeId) {
      const q = quotes[sym];
      if (q) {
        setTOpenPrice(q.bid.toFixed(digits));
        setTClosePrice(q.ask.toFixed(digits));
      }
    }
  };

  const handleSaveTradeFromModal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSym = tSymbol.trim().toUpperCase() || 'XAUUSD';
    const lotsNum = Math.max(0.01, parseFloat(tLots) || 0.01);
    const openNum = Math.max(0, parseFloat(tOpenPrice) || 0);
    const closeNum = Math.max(0, parseFloat(tClosePrice) || openNum);
    const cleanTicket =
      tTicketId.replace(/^#/, '').trim() ||
      String(Math.floor(385000000 + Math.random() * 4999999));
    const slNum =
      tSl.trim() !== '' && !isNaN(parseFloat(tSl)) && parseFloat(tSl) > 0
        ? parseFloat(tSl)
        : null;
    const tpNum =
      tTp.trim() !== '' && !isNaN(parseFloat(tTp)) && parseFloat(tTp) > 0
        ? parseFloat(tTp)
        : null;
    const commNum = Number((parseFloat(tCommission) || 0).toFixed(2));
    const swapNum = Number((parseFloat(tSwap) || 0).toFixed(2));

    const shouldAddAsRunning =
      isRunningTrade || tCloseTime.trim() === '';

    if (shouldAddAsRunning) {
      const newPos: Position = {
        id: cleanTicket,
        symbol: cleanSym,
        type: tType,
        lots: lotsNum,
        openPrice: openNum,
        openTime: tOpenTime.trim() || formatMT5DateTime(new Date()),
        sl: slNum,
        tp: tpNum,
        swap: swapNum,
        commission: commNum,
      };
      onAddRunningPosition(newPos);
      setTradeModalOpen(false);
      showToast(`Added running trade #${cleanTicket} & synced to Cloud`);
      return;
    }

    const parsedProfit = parseFloat(tProfit);
    const finalProfit = isNaN(parsedProfit)
      ? computedProfitPreview
      : Number(parsedProfit.toFixed(2));

    const dealId = editingTradeId || cleanTicket;
    const deal: ClosedDeal = {
      id: dealId,
      orderId: cleanTicket,
      symbol: cleanSym,
      type: tType,
      lots: lotsNum,
      openPrice: openNum,
      closePrice: closeNum,
      openTime: tOpenTime.trim() || formatMT5DateTime(new Date()),
      closeTime: tCloseTime.trim() || formatMT5DateTime(new Date()),
      profit: finalProfit,
      swap: swapNum,
      commission: commNum,
      sl: slNum,
      tp: tpNum,
      closeReason: tCloseReason,
    };

    onUpsertHistoryDeal(deal);
    setTradeModalOpen(false);
    showToast(
      editingTradeId
        ? `Updated trade #${cleanTicket} & synced to Cloud`
        : `Added trade #${cleanTicket} & synced to Cloud`
    );
  };

  const handleOpenAddBalanceModal = (defaultType: 'withdrawal' | 'deposit' = 'withdrawal') => {
    setEditingBalanceId(null);
    setBOpType(defaultType);
    setBAmount('100.00');
    setBDateTime(formatMT5DateTime(new Date()));
    setBComment(defaultType === 'withdrawal' ? 'Withdrawal' : 'Deposit');
    setBalanceModalOpen(true);
  };

  const handleOpenEditBalanceModal = (deal: ClosedDeal) => {
    setEditingBalanceId(deal.id);
    const isWdr = deal.profit < 0;
    setBOpType(isWdr ? 'withdrawal' : 'deposit');
    setBAmount(Math.abs(deal.profit).toFixed(2));
    setBDateTime(deal.closeTime || deal.openTime);
    setBComment(deal.comment || (isWdr ? 'Withdrawal' : 'Deposit'));
    setBalanceModalOpen(true);
  };

  const handleSaveBalanceFromModal = (e: React.FormEvent) => {
    e.preventDefault();
    const rawAmt = Math.abs(parseFloat(bAmount) || 0);
    if (rawAmt <= 0) return;

    const signedProfit =
      bOpType === 'withdrawal'
        ? Number((-rawAmt).toFixed(2))
        : Number(rawAmt.toFixed(2));
    const defaultComment = bOpType === 'withdrawal' ? 'Withdrawal' : 'Deposit';
    const cleanComment = bComment.trim() || defaultComment;
    const generatedId =
      editingBalanceId ||
      String(Math.floor(388000000 + Math.random() * 999999));
    const dt = bDateTime.trim() || formatMT5DateTime(new Date());

    const deal: ClosedDeal = {
      id: generatedId,
      orderId: generatedId,
      symbol: 'BALANCE',
      type: 'balance',
      lots: 0,
      openPrice: 0,
      closePrice: 0,
      openTime: dt,
      closeTime: dt,
      profit: signedProfit,
      swap: 0,
      commission: 0,
      sl: null,
      tp: null,
      closeReason: 'deposit',
      comment: cleanComment,
    };

    onUpsertHistoryDeal(deal);
    setBalanceModalOpen(false);
    showToast(`${cleanComment} (${signedProfit >= 0 ? '+' : ''}${signedProfit.toFixed(2)} USD) saved & synced`);
  };

  const handleSaveAccountProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedInitialDep = parseFloat(initialDepositInput);
    const parsedLev = parseInt(accLeverage, 10);
    onUpdateAccount({
      name: accName.trim() || activeAccount.name,
      server: accServer.trim() || activeAccount.server,
      broker: accServer.trim() || activeAccount.broker,
      company: accCompany.trim() || activeAccount.company,
      login: accLogin.trim() || activeAccount.login,
      leverage: !isNaN(parsedLev) && parsedLev > 0 ? parsedLev : activeAccount.leverage,
      ...(isNaN(parsedInitialDep)
        ? {}
        : { initialDeposit: Number(parsedInitialDep.toFixed(2)) }),
    });
    onSaveTwelveDataKey(apiKeyInput.trim());
    setAccountEditModalOpen(false);
    showToast('Account & Deposit settings saved to Cloud');
  };

  // Authentic Broker Logos matching Screenshot 3 of original iOS set
  const renderBrokerLogo = (logoType: TradingAccount['logoType']) => {
    switch (logoType) {
      case 'fusion':
        return (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9333EA] via-[#6B21A8] to-[#3B0764] flex items-center justify-center text-white font-black text-[20px] italic shrink-0 shadow-xs">
            F
          </div>
        );
      case 'ftmo_mt5':
        return (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#E0F2FE] to-[#BAE6FD] border border-[#7DD3FC] flex items-center justify-center shrink-0">
            <svg className="w-7 h-7" viewBox="0 0 32 32">
              <circle cx="16" cy="9" r="4" fill="#16A34A" />
              <path d="M10 20c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="#22C55E" />
              <circle cx="9" cy="17" r="3.5" fill="#2563EB" />
              <circle cx="23" cy="17" r="3.5" fill="#EAB308" />
            </svg>
          </div>
        );
      case 'ftmo':
        return (
          <div className="w-10 h-10 rounded-[4px] bg-[#1C1C1E] border-2 border-[#4ADE80] flex items-center justify-center shrink-0">
            <div className="w-4 h-4 border-2 border-white rotate-45 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white" />
            </div>
          </div>
        );
      case 'fundingpips':
        return (
          <div className="w-10 h-10 rounded-[4px] bg-[#111840] flex items-center justify-center text-white font-extrabold text-[16px] shrink-0">
            iP
          </div>
        );
      case 'vt':
        return (
          <div className="w-10 h-10 flex items-center justify-center font-black text-[22px] tracking-tighter shrink-0">
            <span className="text-[#0F172A]">v</span>
            <span className="text-[#0F172A]">t</span>
            <span className="w-2 h-2 rounded-full bg-[#06B6D4] self-end mb-1.5 -ml-0.5" />
          </div>
        );
    }
  };

  // SUBVIEW 1: ACCOUNTS SCREEN
  if (subView === 'accounts') {
    return (
      <div className="flex flex-col h-full bg-[#F2F2F7] text-black">
        <header className="pt-safe bg-white border-b border-[#E5E5EA] shrink-0 z-20">
          <div className="h-11 px-3 flex items-center justify-between">
            <button
              onClick={() => setSubView('main')}
              className="min-w-[40px] min-h-[40px] flex items-center text-[#007AFF] active:opacity-60"
            >
              <ChevronLeft className="w-7 h-7 -ml-1 stroke-[2.2]" />
            </button>
            <h1 className="text-[17px] font-bold text-black">Accounts</h1>
            <button
              onClick={() => setSubView('config')}
              className="min-w-[40px] min-h-[40px] flex items-center justify-end text-[#007AFF] active:opacity-60"
              title="Configure Account"
            >
              <Plus className="w-7 h-7 stroke-[2]" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar pt-4">
          <div className="bg-white divide-y divide-[#E5E5EA]/60">
            {accounts.map((acc) => {
              const isActive = acc.id === activeAccount.id;
              return (
                <div
                  key={acc.id}
                  onClick={() => {
                    onSelectAccount(acc.id);
                    setAccName(acc.name);
                    setAccServer(acc.server);
                    setAccCompany(acc.company);
                    setAccLogin(acc.login);
                    setAccLeverage(String(acc.leverage || 500));
                    setInitialDepositInput(String(acc.initialDeposit));
                    setSubView('main');
                  }}
                  className="px-4 py-3.5 flex items-center justify-between cursor-pointer active:bg-[#F2F2F7] transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {renderBrokerLogo(acc.logoType)}
                    <div className="min-w-0 space-y-0.5">
                      <div
                        className={`text-[16px] font-bold truncate ${
                          isActive ? 'text-[#007AFF]' : 'text-black'
                        }`}
                      >
                        {acc.name}
                      </div>
                      <div
                        className={`text-[14px] truncate ${
                          isActive ? 'text-black font-medium' : 'text-[#6C6C70]'
                        }`}
                      >
                        {acc.login} - {acc.server}
                      </div>
                      {acc.id !== 'acc-fundingpips' && (
                        <div
                          className={`text-[14px] ${
                            isActive
                              ? 'text-black font-medium'
                              : 'text-[#6C6C70]'
                          }`}
                        >
                          {formatMT5Money(acc.balance)} {acc.currency}, Hedge
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between self-stretch shrink-0 ml-2">
                    {acc.readOnly ? (
                      <span className="text-[12px] font-semibold text-[#6C6C70] border border-[#AEAEB2] bg-[#F2F2F7] rounded-full px-3 py-0.5">
                        Read Only
                      </span>
                    ) : acc.isDemo ? (
                      <span className="text-[12px] font-semibold text-[#3A9E42] border border-[#63C76A] bg-[#E8F8E9] rounded-full px-3 py-0.5">
                        Demo
                      </span>
                    ) : (
                      <span />
                    )}
                    {isActive && (
                      <ChevronRight className="w-4 h-4 text-[#8E8E93] mt-2" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // SUBVIEW 2: TRADE HISTORY & WITHDRAWAL CONTROL SCREEN (Matches Screenshot 3 + Modal from Screenshots 1 & 2)
  if (subView === 'config') {
    const cleanModalSym = tSymbol.trim().toUpperCase() || 'XAUUSD';
    const liveModalQuote = quotes[cleanModalSym];
    const modalDigits = getDigits(cleanModalSym);
    const liveBidStr = liveModalQuote
      ? liveModalQuote.bid.toFixed(modalDigits)
      : (parseFloat(tOpenPrice) || 4074.9).toFixed(modalDigits);
    const liveAskStr = liveModalQuote
      ? liveModalQuote.ask.toFixed(modalDigits)
      : (parseFloat(tClosePrice) || 4075.05).toFixed(modalDigits);

    return (
      <div className="flex flex-col h-full bg-[#F8F9FA] text-[#111827] relative">
        {/* Top Navigation Bar */}
        <header className="pt-safe bg-white border-b border-[#E5E7EB] shrink-0 z-20">
          <div className="h-11 px-3 flex items-center justify-between">
            <button
              onClick={() => setSubView('main')}
              className="min-w-[44px] min-h-[44px] flex items-center text-[#1967D2] font-medium active:opacity-60"
            >
              <ChevronLeft className="w-6 h-6 -ml-1" />
              <span className="text-[15.5px]">Settings</span>
            </button>
            <h1 className="text-[16.5px] font-bold text-[#111827]">
              Trade & Cloud Control
            </h1>
            <button
              onClick={() => {
                setAccName(activeAccount.name);
                setAccServer(activeAccount.server);
                setAccCompany(activeAccount.company);
                setAccLogin(activeAccount.login);
                setAccLeverage(String(activeAccount.leverage || 500));
                setInitialDepositInput(String(activeAccount.initialDeposit));
                setAccountEditModalOpen(true);
              }}
              className="min-w-[44px] min-h-[44px] flex items-center justify-end text-[#1967D2] text-[13.5px] font-semibold active:opacity-60"
            >
              Edit Acc
            </button>
          </div>
        </header>

        {savedToast && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#137333] text-white text-[13px] font-semibold shadow-lg flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>{savedToast}</span>
          </div>
        )}

        {/* Main Scrollable Content matching Screenshot 3 */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
          {/* Top Account & Sri Lanka Market Hours Banner (Screenshot 3) */}
          <div className="bg-white px-4 pt-3 pb-4 border-b border-[#E5E7EB]">
            <div className="text-center space-y-1">
              <h2 className="text-[20px] font-extrabold text-[#111827] tracking-tight">
                MetaTrader 5 Terminal
              </h2>
              <p className="text-[13.5px] text-[#4B5563] leading-snug">
                {activeAccount.name} • {activeAccount.login} -{' '}
                {activeAccount.server} • 1:{activeAccount.leverage || 500}{' '}
                Leverage
              </p>
              <p className="text-[13px] font-semibold text-[#1967D2] pt-0.5">
                Sri Lanka Time (Asia/Colombo) • Mon 03:30 – Sat 02:29
              </p>
            </div>

            {/* GOOGLE ACCOUNT & CLOUD TRADE SERVER section */}
            <div className="mt-4">
              <div className="text-[12px] font-bold text-[#6B7280] tracking-wider uppercase mb-2 px-1">
                GOOGLE ACCOUNT & CLOUD TRADE SERVER
              </div>

              <div className="rounded-2xl border border-[#E5E7EB] bg-white divide-y divide-[#E5E7EB] shadow-2xs">
                {/* Row 1: Sign in with Google (Cloud Trade Server) */}
                <div
                  onClick={() => {
                    if (!cloudUserEmail && onSignInGoogle) {
                      onSignInGoogle();
                    } else if (cloudUserEmail && onForceSyncCloud) {
                      onForceSyncCloud();
                      showToast('Synced all trades & balance to Cloud Server');
                    }
                  }}
                  className="p-3.5 flex items-center justify-between gap-3 cursor-pointer active:bg-[#F3F4F6] transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#1967D2] flex items-center justify-center text-white shrink-0">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15.5px] font-bold text-[#111827] truncate">
                      {cloudUserEmail
                        ? `Cloud Connected (${cloudUserEmail})`
                        : 'Sign in with Google (Cloud Trade Server)'}
                    </div>
                    <div className="text-[13px] text-[#6B7280] truncate">
                      Save & restore open trades and trade history on cloud
                    </div>
                  </div>
                  {cloudUserEmail && onSignOutCloud ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSignOutCloud();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#FEE2E2] text-[#D32F2F] text-[12px] font-bold shrink-0"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  ) : (
                    <ChevronRight className="w-5 h-5 text-[#6B7280] shrink-0" />
                  )}
                </div>

                {/* Row 2: Chart Trade History Move */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#2ECC71] flex items-center justify-center text-white shrink-0">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15.5px] font-bold text-[#111827]">
                      Chart Trade History Move
                    </div>
                    <div className="text-[13px] text-[#6B7280] truncate">
                      {chartTradeMoveOn ? 'ON' : 'OFF'} • Long-press trade on
                      chart to move & edit
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChartTradeMoveOn((v) => !v)}
                    className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors shrink-0 ${
                      chartTradeMoveOn
                        ? 'bg-[#137333] text-white'
                        : 'bg-[#E5E7EB] text-[#4B5563]'
                    }`}
                  >
                    {chartTradeMoveOn ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Trade History & Withdrawal Control (Screenshot 3) */}
          <div className="mt-2 bg-white px-4 pt-4 pb-6 border-t border-[#E5E7EB] space-y-4">
            {/* Title & Google Login Pill */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-[19px] font-extrabold text-[#111827] tracking-tight">
                  Trade History & Withdrawal Control
                </h3>
                <p className="text-[13px] text-[#6B7280] leading-snug">
                  Ordered by Date (Oldest = #1) • Tap badge to{' '}
                  {cloudUserEmail ? 'Sync Cloud' : 'Sign in with Google'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!cloudUserEmail && onSignInGoogle) {
                    onSignInGoogle();
                  } else if (onForceSyncCloud) {
                    onForceSyncCloud();
                    showToast('Synced with Cloud Trade Server');
                  }
                }}
                className="px-3.5 py-2 rounded-full bg-[#EBF3FF] text-[#1967D2] text-[12.5px] font-bold flex items-center gap-1.5 shrink-0 active:opacity-75"
              >
                <Cloud className="w-4 h-4" />
                <span>{cloudUserEmail ? 'Cloud Synced' : 'Google Login'}</span>
              </button>
            </div>

            {/* 4-Column Financial Summary Card: Deposit | Realized P/L | Withdrawals | Balance */}
            <div
              onClick={() => {
                setInitialDepositInput(String(activeAccount.initialDeposit));
                setAccountEditModalOpen(true);
              }}
              className="rounded-2xl border border-[#D0D5DD] bg-[#F8F9FA] px-3.5 py-3 grid grid-cols-4 gap-2 cursor-pointer active:bg-[#F1F5F9]"
              title="Tap to edit base Deposit & Account Info"
            >
              <div>
                <div className="text-[12px] text-[#6B7280] font-medium">
                  Deposit
                </div>
                <div className="text-[15px] font-extrabold text-[#111827] font-mono tabular-nums mt-0.5">
                  ${totalDepositDisplay.toFixed(2)}
                </div>
              </div>

              <div>
                <div className="text-[12px] text-[#6B7280] font-medium">
                  Realized P/L
                </div>
                <div
                  className={`text-[15px] font-extrabold font-mono tabular-nums mt-0.5 ${
                    realizedPL >= 0 ? 'text-[#1967D2]' : 'text-[#D32F2F]'
                  }`}
                >
                  {realizedPL >= 0
                    ? `+$${realizedPL.toFixed(2)}`
                    : `-$${Math.abs(realizedPL).toFixed(2)}`}
                </div>
              </div>

              <div>
                <div className="text-[12px] text-[#6B7280] font-medium">
                  Withdrawals
                </div>
                <div className="text-[15px] font-extrabold text-[#D32F2F] font-mono tabular-nums mt-0.5">
                  -${Math.abs(totalWithdrawals).toFixed(2)}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[12px] text-[#6B7280] font-medium">
                  Balance
                </div>
                <div className="text-[15px] font-extrabold text-[#111827] font-mono tabular-nums mt-0.5">
                  ${totalBalanceDisplay.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Segmented Control: TRADES (N) | WITHDRAWALS (M) */}
            <div className="bg-[#ECEEF1] p-1 rounded-xl grid grid-cols-2">
              <button
                type="button"
                onClick={() => setControlSubTab('trades')}
                className={`py-2.5 rounded-lg text-[13.5px] font-extrabold tracking-wide transition-all ${
                  controlSubTab === 'trades'
                    ? 'bg-white text-[#1967D2] shadow-xs'
                    : 'text-[#4B5563]'
                }`}
              >
                TRADES ({tradeHistoryDeals.length})
              </button>
              <button
                type="button"
                onClick={() => setControlSubTab('withdrawals')}
                className={`py-2.5 rounded-lg text-[13.5px] font-extrabold tracking-wide transition-all ${
                  controlSubTab === 'withdrawals'
                    ? 'bg-white text-[#1967D2] shadow-xs'
                    : 'text-[#4B5563]'
                }`}
              >
                WITHDRAWALS ({balanceHistoryDeals.length})
              </button>
            </div>

            {/* Primary Blue CTA Button */}
            {controlSubTab === 'trades' ? (
              <button
                type="button"
                onClick={handleOpenAddTradeModal}
                className="w-full h-12 rounded-xl bg-[#1967D2] text-white text-[15px] font-bold flex items-center justify-center gap-2 shadow-xs active:opacity-90"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
                <span>Add New Trade History Item</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleOpenAddBalanceModal('withdrawal')}
                  className="h-12 rounded-xl bg-[#D32F2F] text-white text-[14px] font-bold flex items-center justify-center gap-1.5 shadow-xs active:opacity-90"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Add Withdrawal</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAddBalanceModal('deposit')}
                  className="h-12 rounded-xl bg-[#1967D2] text-white text-[14px] font-bold flex items-center justify-center gap-1.5 shadow-xs active:opacity-90"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Add Deposit</span>
                </button>
              </div>
            )}

            {/* Chronologically Ordered List (Oldest = #1) */}
            {controlSubTab === 'trades' ? (
              <div className="space-y-3">
                {tradeHistoryDeals.length === 0 ? (
                  <div className="py-10 text-center text-[14px] text-[#6B7280] border border-dashed border-[#D0D5DD] rounded-2xl">
                    No trade history items yet. Tap &ldquo;+ Add New Trade
                    History Item&rdquo; above.
                  </div>
                ) : (
                  tradeHistoryDeals.map((deal, idx) => {
                    const digits = getDigits(deal.symbol);
                    const isProfitPos = deal.profit >= 0;
                    const ticketLabel = (deal.orderId || deal.id).startsWith(
                      '#'
                    )
                      ? deal.orderId || deal.id
                      : `#${deal.orderId || deal.id}`;

                    return (
                      <div
                        key={deal.id}
                        className="rounded-2xl border border-[#E0E3E7] bg-white p-3.5 flex items-center gap-3 shadow-2xs"
                      >
                        {/* Left Circular Number Badge (Oldest = #1) */}
                        <div className="w-8 h-8 rounded-full border border-[#1967D2] bg-[#EBF3FF] text-[#1967D2] text-[13.5px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </div>

                        {/* Middle Trade Details */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="text-[16px] font-extrabold text-[#111827]">
                              {deal.symbol},
                            </span>
                            <span
                              className={`text-[15px] font-extrabold ${
                                deal.type === 'buy'
                                  ? 'text-[#1967D2]'
                                  : 'text-[#D32F2F]'
                              }`}
                            >
                              {deal.type} {deal.lots.toFixed(2)}
                            </span>
                            <span className="text-[13px] text-[#6B7280] font-mono">
                              {ticketLabel}
                            </span>
                            {deal.closeReason === 'tp' && (
                              <span className="px-2 py-0.5 rounded-md bg-[#E6F4EA] text-[#137333] text-[10.5px] font-extrabold uppercase">
                                TP HIT
                              </span>
                            )}
                            {deal.closeReason === 'sl' && (
                              <span className="px-2 py-0.5 rounded-md bg-[#FCE8E6] text-[#C5221F] text-[10.5px] font-extrabold uppercase">
                                SL HIT
                              </span>
                            )}
                          </div>

                          <div className="text-[14.5px] text-[#4B5563] font-mono tabular-nums">
                            {deal.openPrice.toFixed(digits)} &rarr;{' '}
                            {deal.closePrice.toFixed(digits)}
                          </div>

                          <div className="text-[12px] text-[#6B7280] truncate">
                            Open: {deal.openTime} | Close: {deal.closeTime}
                          </div>

                          <div className="text-[12.5px] text-[#6B7280] font-mono">
                            Swap: {deal.swap.toFixed(2)} | Comm:{' '}
                            {deal.commission.toFixed(2)}
                          </div>
                        </div>

                        {/* Right Column: Profit + Edit & Delete Icons */}
                        <div className="flex flex-col items-end justify-between self-stretch shrink-0 pl-1">
                          <div
                            className={`text-[16px] font-extrabold font-mono tabular-nums ${
                              isProfitPos ? 'text-[#1967D2]' : 'text-[#D32F2F]'
                            }`}
                          >
                            {deal.profit.toFixed(2)}
                          </div>

                          <div className="flex items-center gap-3 mt-3">
                            <button
                              type="button"
                              onClick={() => handleOpenEditTradeModal(deal)}
                              className="p-1.5 text-[#1967D2] active:opacity-60"
                              title="Edit Trade"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteHistoryDeal(deal.id);
                                showToast(
                                  `Deleted trade ${ticketLabel} & synced Cloud`
                                );
                              }}
                              className="p-1.5 text-[#D32F2F] active:opacity-60"
                              title="Delete Trade"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* Withdrawals / Deposits List */
              <div className="space-y-3">
                {balanceHistoryDeals.length === 0 ? (
                  <div className="py-10 text-center text-[14px] text-[#6B7280] border border-dashed border-[#D0D5DD] rounded-2xl">
                    No withdrawal or deposit items yet. Tap &ldquo;+ Add
                    Withdrawal&rdquo; or &ldquo;+ Add Deposit&rdquo; above.
                  </div>
                ) : (
                  balanceHistoryDeals.map((deal, idx) => {
                    const isDeposit = deal.profit >= 0;
                    const label =
                      deal.comment || (isDeposit ? 'Deposit' : 'Withdrawal');
                    return (
                      <div
                        key={deal.id}
                        className="rounded-2xl border border-[#E0E3E7] bg-white p-3.5 flex items-center gap-3 shadow-2xs"
                      >
                        <div className="w-8 h-8 rounded-full border border-[#1967D2] bg-[#EBF3FF] text-[#1967D2] text-[13.5px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[16px] font-extrabold text-[#111827]">
                              Balance
                            </span>
                            <span
                              className={`text-[12px] font-bold px-2 py-0.5 rounded-md ${
                                isDeposit
                                  ? 'bg-[#E6F4EA] text-[#137333]'
                                  : 'bg-[#FCE8E6] text-[#C5221F]'
                              }`}
                            >
                              {isDeposit ? 'DEPOSIT' : 'WITHDRAWAL'}
                            </span>
                          </div>
                          <div className="text-[13.5px] text-[#4B5563]">
                            {label}
                          </div>
                          <div className="text-[12px] text-[#6B7280] font-mono">
                            Date: {deal.closeTime || deal.openTime}
                          </div>
                        </div>

                        <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                          <div
                            className={`text-[16px] font-extrabold font-mono tabular-nums ${
                              isDeposit ? 'text-[#1967D2]' : 'text-[#D32F2F]'
                            }`}
                          >
                            {deal.profit >= 0
                              ? `+${deal.profit.toFixed(2)}`
                              : deal.profit.toFixed(2)}
                          </div>

                          <div className="flex items-center gap-3 mt-3">
                            <button
                              type="button"
                              onClick={() => handleOpenEditBalanceModal(deal)}
                              className="p-1.5 text-[#1967D2] active:opacity-60"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteHistoryDeal(deal.id);
                                showToast(
                                  `Deleted ${label} & synced Cloud`
                                );
                              }}
                              className="p-1.5 text-[#D32F2F] active:opacity-60"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* MODAL 1: ADD / EDIT TRADE ITEM (EXACT MATCH TO SCREENSHOTS 1 & 2)     */}
        {/* ===================================================================== */}
        {tradeModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
            <form
              onSubmit={handleSaveTradeFromModal}
              className="w-full max-w-[410px] max-h-[90dvh] bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Scrollable Modal Body */}
              <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 space-y-3.5">
                {/* Modal Title */}
                <h2 className="text-[21px] font-extrabold text-[#111827] tracking-tight">
                  {editingTradeId ? 'Edit Trade Item' : 'Add New Trade Item'}
                </h2>

                {/* Quick Symbol Selector Buttons (XAUUSD, USDSEK, USDJPY, USDCNH, etc.) */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                  {QUICK_MODAL_SYMBOLS.map((sym) => {
                    const isSelected = cleanModalSym === sym;
                    return (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => handleSelectQuickSymbolInModal(sym)}
                        className={`px-3.5 py-2 rounded-lg text-[13.5px] font-extrabold shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-[#1967D2] text-white'
                            : 'bg-[#F1F3F5] text-[#111827]'
                        }`}
                      >
                        {sym}
                      </button>
                    );
                  })}
                </div>

                {/* Live Chart Price Banner */}
                <div className="text-[13.5px] font-bold text-[#1967D2] leading-snug">
                  Live {cleanModalSym} Chart Price: Bid {liveBidStr} / Ask{' '}
                  {liveAskStr}
                </div>

                {/* Outlined Input: Symbol */}
                <div className="relative pt-1">
                  <label className="absolute -top-1.5 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                    Symbol (e.g. XAUUSD, NAS100, EURUSD)
                  </label>
                  <input
                    type="text"
                    value={tSymbol}
                    onChange={(e) => setTSymbol(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-3 rounded-xl border border-[#C4C7C5] text-[16px] font-medium text-[#111827] focus:border-[#1967D2] focus:outline-none"
                  />
                </div>

                {/* BUY / SELL Large Buttons */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTType('buy')}
                    className={`h-11 rounded-xl text-[15px] font-extrabold transition-colors ${
                      tType === 'buy'
                        ? 'bg-[#1967D2] text-white'
                        : 'bg-[#ECEEF1] text-[#111827]'
                    }`}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setTType('sell')}
                    className={`h-11 rounded-xl text-[15px] font-extrabold transition-colors ${
                      tType === 'sell'
                        ? 'bg-[#D32F2F] text-white'
                        : 'bg-[#ECEEF1] text-[#111827]'
                    }`}
                  >
                    SELL
                  </button>
                </div>

                {/* Running Trade (Without Close Time) Checkbox Box */}
                <label className="rounded-xl border border-[#D0D5DD] p-3.5 flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRunningTrade}
                    onChange={(e) => setIsRunningTrade(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-[#1967D2] rounded shrink-0"
                  />
                  <div className="space-y-0.5">
                    <div className="text-[14.5px] font-extrabold text-[#111827] leading-snug">
                      Running Trade (Without Close Time)
                    </div>
                    <div className="text-[12.5px] text-[#6B7280] leading-snug">
                      Check this or clear Close Time to add an open running
                      trade
                    </div>
                  </div>
                </label>

                {/* Lots & Unique Ticket ID Row */}
                <div className="grid grid-cols-12 gap-2.5 pt-1">
                  <div className="col-span-5 relative">
                    <label className="absolute -top-2 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                      Lots
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={tLots}
                      onChange={(e) => setTLots(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-[#C4C7C5] text-[16px] font-medium text-[#111827] font-mono focus:border-[#1967D2] focus:outline-none"
                    />
                  </div>

                  <div className="col-span-7 relative">
                    <label className="absolute -top-2 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                      Unique Ticket ID
                    </label>
                    <div className="flex items-center rounded-xl border border-[#C4C7C5] px-3 py-3 focus-within:border-[#1967D2]">
                      <input
                        type="text"
                        value={tTicketId}
                        onChange={(e) => setTTicketId(e.target.value)}
                        className="w-full text-[15.5px] font-medium text-[#111827] font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setTTicketId(generateRandomTicket())}
                        className="text-[#1967D2] pl-2 active:rotate-90 transition-transform"
                        title="Generate New Ticket ID"
                      >
                        <RefreshCw className="w-4 h-4 stroke-[2.2]" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Entry / Open Time Outlined Input */}
                <div className="relative pt-1">
                  <label className="absolute -top-1.5 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                    Entry / Open Time (yyyy.MM.dd HH:mm:ss)
                  </label>
                  <div className="flex items-center rounded-xl border border-[#C4C7C5] px-3.5 py-3 focus-within:border-[#1967D2]">
                    <input
                      type="text"
                      value={tOpenTime}
                      onChange={(e) => setTOpenTime(e.target.value)}
                      className="w-full text-[15.5px] font-medium text-[#111827] font-mono focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (matchedEntryCandle) {
                          setTOpenTime(
                            `${formatCandleFullMinute(matchedEntryCandle.time)}:25`
                          );
                          setTOpenPrice(
                            matchedEntryCandle.close.toFixed(modalDigits)
                          );
                        }
                      }}
                      className="text-[13px] font-bold text-[#1967D2] shrink-0 pl-2"
                    >
                      Sync 1m
                    </button>
                  </div>
                </div>

                {/* Entry 1m Chart Candle Box (Screenshot 1) */}
                {matchedEntryCandle && (
                  <div className="rounded-xl border border-[#D0D5DD] bg-[#F8FAFC] p-3 space-y-2.5">
                    <div className="text-[13px] font-bold text-[#1967D2] leading-snug">
                      Entry 1m Chart Candle [
                      {formatCandleFullMinute(matchedEntryCandle.time)}]: Move
                      Time {tOpenTime.slice(11, 19) || '02:26:25'} &rarr;{' '}
                      {tOpenPrice}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTOpenTime(
                            `${formatCandleFullMinute(matchedEntryCandle.time)}:07`
                          );
                          setTOpenPrice(
                            matchedEntryCandle.open.toFixed(modalDigits)
                          );
                        }}
                        className="py-2 px-2.5 rounded-lg border border-[#D0D5DD] bg-white text-[12.5px] font-mono text-[#111827] active:bg-[#EBF3FF]"
                      >
                        Open :07 ({matchedEntryCandle.open.toFixed(modalDigits)}
                        )
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTOpenTime(
                            `${formatCandleFullMinute(matchedEntryCandle.time)}:19`
                          );
                          setTOpenPrice(
                            matchedEntryCandle.high.toFixed(modalDigits)
                          );
                        }}
                        className="py-2 px-2.5 rounded-lg border border-[#D0D5DD] bg-white text-[12.5px] font-mono text-[#111827] active:bg-[#EBF3FF]"
                      >
                        High :19 ({matchedEntryCandle.high.toFixed(modalDigits)}
                        )
                      </button>
                    </div>

                    <div className="text-[12px] text-[#6B7280]">
                      Tap Chart 1m Candle Time to Auto-Load Time &amp; Price:
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      {symbol1mCandles.map((c) => {
                        const chipLabel = formatCandleChipTime(c.time);
                        const fullMin = formatCandleFullMinute(c.time);
                        const isSelected = tOpenTime.startsWith(fullMin);
                        return (
                          <button
                            key={c.time}
                            type="button"
                            onClick={() => {
                              setTOpenTime(`${fullMin}:25`);
                              setTOpenPrice(c.close.toFixed(modalDigits));
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[12px] font-mono shrink-0 border transition-colors ${
                              isSelected
                                ? 'border-2 border-[#1967D2] bg-[#EBF3FF] text-[#1967D2] font-bold'
                                : 'border-[#D0D5DD] bg-white text-[#111827]'
                            }`}
                          >
                            {chipLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Close Time Outlined Input */}
                {!isRunningTrade && (
                  <>
                    <div className="relative pt-1">
                      <label className="absolute -top-1.5 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                        Close Time (yyyy.MM.dd HH:mm:ss • Empty = Running)
                      </label>
                      <div className="flex items-center rounded-xl border border-[#C4C7C5] px-3.5 py-3 focus-within:border-[#1967D2]">
                        <input
                          type="text"
                          value={tCloseTime}
                          onChange={(e) => setTCloseTime(e.target.value)}
                          className="w-full text-[15.5px] font-medium text-[#111827] font-mono focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (matchedCloseCandle) {
                              setTCloseTime(
                                `${formatCandleFullMinute(matchedCloseCandle.time)}:16`
                              );
                              setTClosePrice(
                                matchedCloseCandle.close.toFixed(modalDigits)
                              );
                            }
                          }}
                          className="text-[13px] font-bold text-[#1967D2] shrink-0 pl-2"
                        >
                          Sync 1m
                        </button>
                      </div>
                    </div>

                    {/* Close 1m Chart Candle Box (Screenshot 2) */}
                    {matchedCloseCandle && (
                      <div className="rounded-xl border border-[#D0D5DD] bg-[#F8FAFC] p-3 space-y-2.5">
                        <div className="text-[13px] font-bold text-[#1967D2] leading-snug">
                          Close 1m Chart Candle [
                          {formatCandleFullMinute(matchedCloseCandle.time)}]:
                          Move Time {tCloseTime.slice(11, 19) || '02:29:16'}{' '}
                          &rarr; {tClosePrice}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setTCloseTime(
                                `${formatCandleFullMinute(matchedCloseCandle.time)}:08`
                              );
                              setTClosePrice(
                                matchedCloseCandle.open.toFixed(modalDigits)
                              );
                            }}
                            className="py-2 px-2.5 rounded-lg border border-[#D0D5DD] bg-white text-[12.5px] font-mono text-[#111827] active:bg-[#EBF3FF]"
                          >
                            Open :08 (
                            {matchedCloseCandle.open.toFixed(modalDigits)})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTCloseTime(
                                `${formatCandleFullMinute(matchedCloseCandle.time)}:38`
                              );
                              setTClosePrice(
                                matchedCloseCandle.high.toFixed(modalDigits)
                              );
                            }}
                            className="py-2 px-2.5 rounded-lg border border-[#D0D5DD] bg-white text-[12.5px] font-mono text-[#111827] active:bg-[#EBF3FF]"
                          >
                            High :38 (
                            {matchedCloseCandle.high.toFixed(modalDigits)})
                          </button>
                        </div>

                        <div className="text-[12px] text-[#6B7280]">
                          Tap Chart 1m Candle Time to Auto-Load Time &amp;
                          Price:
                        </div>

                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                          {symbol1mCandles.map((c) => {
                            const chipLabel = formatCandleChipTime(c.time);
                            const fullMin = formatCandleFullMinute(c.time);
                            const isSelected = tCloseTime.startsWith(fullMin);
                            return (
                              <button
                                key={c.time}
                                type="button"
                                onClick={() => {
                                  setTCloseTime(`${fullMin}:16`);
                                  setTClosePrice(c.close.toFixed(modalDigits));
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[12px] font-mono shrink-0 border transition-colors ${
                                  isSelected
                                    ? 'border-2 border-[#1967D2] bg-[#EBF3FF] text-[#1967D2] font-bold'
                                    : 'border-[#D0D5DD] bg-white text-[#111827]'
                                }`}
                              >
                                {chipLabel}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Open Price (Editable) & Close Price (Editable) Row */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="relative">
                    <label className="absolute -top-2.5 left-3 px-1 bg-white text-[11px] text-[#6B7280] leading-tight">
                      Open Price
                      <br />
                      (Editable)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={tOpenPrice}
                      onChange={(e) => setTOpenPrice(e.target.value)}
                      className="w-full px-3.5 pt-4 pb-2.5 rounded-xl border border-[#C4C7C5] text-[16px] font-medium text-[#111827] font-mono focus:border-[#1967D2] focus:outline-none"
                    />
                  </div>

                  <div className="relative">
                    <label className="absolute -top-2.5 left-3 px-1 bg-white text-[11px] text-[#6B7280] leading-tight">
                      Close Price
                      <br />
                      (Editable)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={tClosePrice}
                      onChange={(e) => setTClosePrice(e.target.value)}
                      className="w-full px-3.5 pt-4 pb-2.5 rounded-xl border border-[#C4C7C5] text-[16px] font-medium text-[#111827] font-mono focus:border-[#1967D2] focus:outline-none"
                    />
                  </div>
                </div>

                {/* S/L (Optional) & T/P (Optional) Row */}
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="number"
                    step="any"
                    value={tSl}
                    onChange={(e) => setTSl(e.target.value)}
                    placeholder="S/L (Optional)"
                    className="w-full px-3.5 py-3 rounded-xl border border-[#C4C7C5] text-[15px] text-[#111827] placeholder-[#6B7280] font-mono focus:border-[#1967D2] focus:outline-none"
                  />
                  <input
                    type="number"
                    step="any"
                    value={tTp}
                    onChange={(e) => setTTp(e.target.value)}
                    placeholder="T/P (Optional)"
                    className="w-full px-3.5 py-3 rounded-xl border border-[#C4C7C5] text-[15px] text-[#111827] placeholder-[#6B7280] font-mono focus:border-[#1967D2] focus:outline-none"
                  />
                </div>

                {/* Auto-calculate 1:500 Profit Checkbox */}
                <label className="flex items-center gap-3 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCalcProfit}
                    onChange={(e) => setAutoCalcProfit(e.target.checked)}
                    className="w-5 h-5 accent-[#1967D2] rounded"
                  />
                  <span className="text-[14.5px] font-medium text-[#111827]">
                    Auto-calculate 1:500 Profit (${computedProfitPreview.toFixed(2)})
                  </span>
                </label>

                {/* Profit USD (+ or -) Outlined Input */}
                <div className="relative pt-1">
                  <label className="absolute -top-1.5 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                    Profit USD (+ or -)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={tProfit}
                    onChange={(e) => {
                      setAutoCalcProfit(false);
                      setTProfit(e.target.value);
                    }}
                    className="w-full px-3.5 py-3 rounded-xl border border-[#C4C7C5] text-[16px] font-medium text-[#111827] font-mono focus:border-[#1967D2] focus:outline-none"
                  />
                </div>

                {/* Auto Commission & Swap Checkbox (Screenshot 2) */}
                <label className="flex items-start gap-3 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCommSwap}
                    onChange={(e) => setAutoCommSwap(e.target.checked)}
                    className="mt-1 w-5 h-5 accent-[#1967D2] rounded shrink-0"
                  />
                  <div className="space-y-0.5">
                    <div className="text-[14.5px] font-extrabold text-[#111827] leading-snug">
                      Auto Commission &amp; Swap (Moneta Markets ($6.00/lot))
                    </div>
                    <div className="text-[12.5px] text-[#6B7280] leading-snug">
                      Comm: ${computedCommPreview.toFixed(2)} • Swap: $
                      {computedSwapPreview.toFixed(2)} ({rolloverDaysCount}{' '}
                      rollover days, 3x Wed)
                    </div>
                  </div>
                </label>

                {/* Commission USD & Swap USD Row */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="relative">
                    <label className="absolute -top-2 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                      Commission USD
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={tCommission}
                      onChange={(e) => {
                        setAutoCommSwap(false);
                        setTCommission(e.target.value);
                      }}
                      className="w-full px-3.5 py-3 rounded-xl border border-[#C4C7C5] text-[16px] font-medium text-[#111827] font-mono focus:border-[#1967D2] focus:outline-none"
                    />
                  </div>

                  <div className="relative">
                    <label className="absolute -top-2 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                      Swap USD
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={tSwap}
                      onChange={(e) => {
                        setAutoCommSwap(false);
                        setTSwap(e.target.value);
                      }}
                      className="w-full px-3.5 py-3 rounded-xl border border-[#C4C7C5] text-[16px] font-medium text-[#111827] font-mono focus:border-[#1967D2] focus:outline-none"
                    />
                  </div>
                </div>

                {/* T/P or S/L Hit Status (History Left Line) Box (Screenshot 2) */}
                <div className="rounded-2xl border border-[#D0D5DD] bg-[#F8FAFC] p-3.5 space-y-3">
                  <div className="text-[14.5px] font-extrabold text-[#111827]">
                    T/P or S/L Hit Status (History Left Line)
                  </div>

                  <div className="rounded-xl border border-[#E0E3E7] bg-white p-3 space-y-1">
                    <div className="text-[12.5px] font-extrabold text-[#111827]">
                      Chart Data First-Hit Check:
                    </div>
                    <div className="text-[12.5px] text-[#4B5563] leading-snug">
                      {firstHitCheckStatus}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* T/P Hit (Green Line) */}
                    <button
                      type="button"
                      onClick={() => setTCloseReason('tp')}
                      className={`relative overflow-hidden rounded-xl py-2.5 px-2 text-center border transition-all ${
                        tCloseReason === 'tp'
                          ? 'border-2 border-[#137333] bg-[#E6F4EA]'
                          : 'border-[#D0D5DD] bg-white'
                      }`}
                    >
                      <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2E7D32]" />
                      <div className="text-[13px] font-extrabold text-[#111827]">
                        T/P Hit
                      </div>
                      <div className="text-[11px] font-bold text-[#2E7D32] mt-0.5">
                        Green Line
                      </div>
                    </button>

                    {/* S/L Hit (Red Line) */}
                    <button
                      type="button"
                      onClick={() => setTCloseReason('sl')}
                      className={`relative overflow-hidden rounded-xl py-2.5 px-2 text-center border transition-all ${
                        tCloseReason === 'sl'
                          ? 'border-2 border-[#D32F2F] bg-[#FCE8E6]'
                          : 'border-[#D0D5DD] bg-white'
                      }`}
                    >
                      <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#D32F2F]" />
                      <div className="text-[13px] font-extrabold text-[#111827]">
                        S/L Hit
                      </div>
                      <div className="text-[11px] font-bold text-[#D32F2F] mt-0.5">
                        Red Line
                      </div>
                    </button>

                    {/* Manual / None */}
                    <button
                      type="button"
                      onClick={() => setTCloseReason('manual')}
                      className={`rounded-xl py-2.5 px-2.5 text-left border transition-all ${
                        tCloseReason === 'manual'
                          ? 'border-2 border-[#1967D2] bg-[#EBF3FF]'
                          : 'border-[#D0D5DD] bg-white'
                      }`}
                    >
                      <div className="text-[12.5px] font-extrabold text-[#1967D2] leading-tight">
                        Manual /
                      </div>
                      <div className="text-[12.5px] font-extrabold text-[#1967D2] leading-tight mt-0.5">
                        None
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sticky Bottom Modal Footer: Cancel | Save & Sync Cloud */}
              <div className="px-4 py-3 bg-white border-t border-[#E5E7EB] flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setTradeModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-[15px] font-bold text-[#4B5563] active:bg-[#F3F4F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-[#1967D2] text-white text-[15px] font-extrabold shadow-sm active:opacity-90"
                >
                  Save &amp; Sync Cloud
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===================================================================== */}
        {/* MODAL 2: ADD / EDIT WITHDRAWAL OR DEPOSIT                             */}
        {/* ===================================================================== */}
        {balanceModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
            <form
              onSubmit={handleSaveBalanceFromModal}
              className="w-full max-w-[400px] bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-5 space-y-4">
                <h2 className="text-[20px] font-extrabold text-[#111827]">
                  {editingBalanceId
                    ? 'Edit Balance Operation'
                    : 'Add Withdrawal / Deposit'}
                </h2>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setBOpType('withdrawal');
                      if (bComment === 'Deposit') setBComment('Withdrawal');
                    }}
                    className={`h-11 rounded-xl text-[14px] font-extrabold transition-colors ${
                      bOpType === 'withdrawal'
                        ? 'bg-[#D32F2F] text-white'
                        : 'bg-[#ECEEF1] text-[#111827]'
                    }`}
                  >
                    WITHDRAWAL (-USD)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBOpType('deposit');
                      if (bComment === 'Withdrawal') setBComment('Deposit');
                    }}
                    className={`h-11 rounded-xl text-[14px] font-extrabold transition-colors ${
                      bOpType === 'deposit'
                        ? 'bg-[#1967D2] text-white'
                        : 'bg-[#ECEEF1] text-[#111827]'
                    }`}
                  >
                    DEPOSIT (+USD)
                  </button>
                </div>

                <div className="relative pt-1">
                  <label className="absolute -top-1.5 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                    Amount USD
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={bAmount}
                    onChange={(e) => setBAmount(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl border border-[#C4C7C5] text-[16px] font-mono font-bold text-[#111827] focus:border-[#1967D2] focus:outline-none"
                  />
                </div>

                <div className="relative pt-1">
                  <label className="absolute -top-1.5 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                    Date &amp; Time (yyyy.MM.dd HH:mm:ss)
                  </label>
                  <div className="flex items-center rounded-xl border border-[#C4C7C5] px-3.5 py-3">
                    <input
                      type="text"
                      value={bDateTime}
                      onChange={(e) => setBDateTime(e.target.value)}
                      className="w-full text-[15px] font-mono text-[#111827] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setBDateTime(formatMT5DateTime(new Date()))
                      }
                      className="text-[12.5px] font-bold text-[#1967D2] pl-2"
                    >
                      Now
                    </button>
                  </div>
                </div>

                <div className="relative pt-1">
                  <label className="absolute -top-1.5 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                    Comment / Note
                  </label>
                  <input
                    type="text"
                    value={bComment}
                    onChange={(e) => setBComment(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl border border-[#C4C7C5] text-[15px] text-[#111827] focus:border-[#1967D2] focus:outline-none"
                  />
                </div>
              </div>

              <div className="px-4 py-3 bg-white border-t border-[#E5E7EB] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setBalanceModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-[15px] font-bold text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-[#1967D2] text-white text-[15px] font-extrabold"
                >
                  Save &amp; Sync Cloud
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===================================================================== */}
        {/* MODAL 3: EDIT ACCOUNT PROFILE & BASE DEPOSIT                          */}
        {/* ===================================================================== */}
        {accountEditModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
            <form
              onSubmit={handleSaveAccountProfile}
              className="w-full max-w-[400px] bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-5 space-y-3.5 max-h-[82dvh] overflow-y-auto">
                <h2 className="text-[20px] font-extrabold text-[#111827]">
                  Account &amp; Deposit Settings
                </h2>

                <div className="relative pt-1">
                  <label className="absolute -top-1.5 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                    Base Deposit Amount (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={initialDepositInput}
                    onChange={(e) => setInitialDepositInput(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl border border-[#C4C7C5] text-[16px] font-mono font-bold text-[#111827] focus:border-[#1967D2] focus:outline-none"
                  />
                </div>

                <div className="relative pt-1">
                  <label className="absolute -top-1.5 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#C4C7C5] text-[15px] text-[#111827]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="relative">
                    <label className="absolute -top-1.5 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                      Account Login ID
                    </label>
                    <input
                      type="text"
                      value={accLogin}
                      onChange={(e) => setAccLogin(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#C4C7C5] text-[15px] font-mono text-[#111827]"
                    />
                  </div>
                  <div className="relative">
                    <label className="absolute -top-1.5 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                      Leverage (1:X)
                    </label>
                    <input
                      type="number"
                      value={accLeverage}
                      onChange={(e) => setAccLeverage(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#C4C7C5] text-[15px] font-mono text-[#111827]"
                    />
                  </div>
                </div>

                <div className="relative pt-1">
                  <label className="absolute -top-1.5 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                    Trading Server (e.g. MonetaMarkets-Live)
                  </label>
                  <input
                    type="text"
                    value={accServer}
                    onChange={(e) => setAccServer(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#C4C7C5] text-[15px] text-[#111827]"
                  />
                </div>

                <div className="relative pt-1">
                  <label className="absolute -top-1.5 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                    Broker Company Name
                  </label>
                  <input
                    type="text"
                    value={accCompany}
                    onChange={(e) => setAccCompany(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#C4C7C5] text-[15px] text-[#111827]"
                  />
                </div>

                <div className="relative pt-1">
                  <label className="absolute -top-1.5 left-3 px-1 bg-white text-[11.5px] text-[#6B7280] font-medium">
                    Twelve Data API Key (Optional)
                  </label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Optional WebSocket key"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#C4C7C5] text-[14px] text-[#111827]"
                  />
                </div>
              </div>

              <div className="px-4 py-3 bg-white border-t border-[#E5E7EB] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAccountEditModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-[15px] font-bold text-[#4B5563]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-[#1967D2] text-white text-[15px] font-extrabold"
                >
                  Save &amp; Sync Cloud
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // SUBVIEW 3: JOURNAL SCREEN
  if (subView === 'journal') {
    return (
      <div className="flex flex-col h-full bg-[#F2F2F7] text-black">
        <header className="pt-safe bg-white border-b border-[#E5E5EA] shrink-0">
          <div className="h-11 px-3 flex items-center justify-between">
            <button
              onClick={() => setSubView('main')}
              className="min-w-[44px] min-h-[44px] flex items-center text-[#007AFF]"
            >
              <ChevronLeft className="w-6 h-6 -ml-1" />
              <span className="text-[16px]">Settings</span>
            </button>
            <h1 className="text-[17px] font-bold">Journal</h1>
            <div className="w-12" />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-3 font-mono text-[11.5px] space-y-1.5">
          {journalLogs.map((log, i) => (
            <div
              key={i}
              className="p-2.5 rounded-lg bg-white border border-[#E5E5EA] text-[#3A3A3C]"
            >
              {log}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // SUBVIEW 4: MAILBOX SCREEN
  if (subView === 'mailbox') {
    return (
      <div className="flex flex-col h-full bg-[#F2F2F7] text-black">
        <header className="pt-safe bg-white border-b border-[#E5E5EA] shrink-0">
          <div className="h-11 px-3 flex items-center justify-between">
            <button
              onClick={() => setSubView('main')}
              className="min-w-[44px] min-h-[44px] flex items-center text-[#007AFF]"
            >
              <ChevronLeft className="w-6 h-6 -ml-1" />
              <span className="text-[16px]">Settings</span>
            </button>
            <h1 className="text-[17px] font-bold">Mailbox</h1>
            <div className="w-12" />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 bg-white border-b border-[#E5E5EA] space-y-1">
            <div className="flex justify-between text-[12px] text-[#6C6C70]">
              <span className="font-semibold text-[#007AFF]">
                Trading System
              </span>
              <span>16:14</span>
            </div>
            <div className="text-[15px] font-bold text-black">
              You have registered a new account - {activeAccount.company}
            </div>
            <p className="text-[13px] text-[#48484A] pt-1 leading-relaxed">
              Login: {activeAccount.login}
              <br />
              Server: {activeAccount.server}
              <br />
              Name: {activeAccount.name}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // MAIN SETTINGS SCREEN (iOS MT5 Menu)
  return (
    <div className="flex flex-col h-full bg-[#F2F2F7] text-black">
      <header className="pt-safe bg-white border-b border-[#E5E5EA] shrink-0 z-20">
        <div className="h-11 px-4 flex items-center justify-center relative">
          <h1 className="text-[17px] font-bold tracking-tight text-black">
            Settings
          </h1>
        </div>
      </header>

      {savedToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#34C759] text-white text-[13px] font-semibold shadow-lg flex items-center gap-1.5">
          <Check className="w-4 h-4" />
          <span>{savedToast}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
        {/* Top Active Account Profile Banner */}
        <div
          onClick={() => setSubView('accounts')}
          className="mt-3 relative overflow-hidden bg-white border-t border-b border-[#E5E5EA] px-4 py-3.5 flex items-center justify-between cursor-pointer active:bg-[#F2F2F7] transition-colors"
        >
          {activeAccount.isDemo && (
            <div className="absolute top-2 -right-7 rotate-45 bg-[#4CD964] text-white text-[10px] font-semibold px-7 py-0.5 shadow-2xs">
              Demo
            </div>
          )}

          <div className="flex-1 text-center space-y-0.5 pl-4">
            <div className="text-[17px] font-semibold text-black">
              {activeAccount.name}
            </div>
            <div className="text-[14px] font-medium text-black">
              {activeAccount.company}
            </div>
            <div className="text-[14px] font-medium text-black pt-1.5">
              {activeAccount.login} - {activeAccount.server}
            </div>
            <div className="text-[13.5px] font-medium text-black">
              Local Access Server
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-[#C7C7CC] shrink-0" />
        </div>

        {/* Group 1: New Account, Mailbox, News, Tradays */}
        <div className="bg-white border-b border-[#E5E5EA] divide-y divide-[#E5E5EA]">
          <button
            onClick={() => setSubView('accounts')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#F2F2F7]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-[7px] bg-[#53D769] flex items-center justify-center text-white shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="8" r="4" />
                  <path d="M2 20c0-3.5 3.1-6 7-6s7 2.5 7 6H2z" />
                  <path
                    d="M19 8v6M16 11h6"
                    stroke="white"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span className="text-[16px] font-medium text-black">
                New Account
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />
          </button>

          <button
            onClick={() => setSubView('mailbox')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#F2F2F7]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-8 h-8 rounded-[7px] bg-[#5AC8FA] flex items-center justify-center text-white shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-[16px] font-medium text-black leading-snug">
                  Mailbox
                </div>
                <div className="text-[13px] font-medium text-black truncate max-w-[245px] leading-snug">
                  You have registered a new account - Fusion Markets Pt...
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#C7C7CC] shrink-0" />
          </button>

          <button
            onClick={() => showToast('No new financial news')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#F2F2F7]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-[7px] bg-[#FFAA1D] flex items-center justify-center text-white shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-[16px] font-medium text-black">News</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />
          </button>

          <button
            onClick={() => showToast('Tradays Economic Calendar')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#F2F2F7]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-[7px] bg-[#EB4E3D] flex items-center justify-center text-white shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-[16px] font-medium text-black leading-snug">
                  Tradays
                </div>
                <div className="text-[13px] font-medium text-black leading-snug">
                  Economic calendar
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />
          </button>
        </div>

        {/* Group 2: Chat and Messages, Traders Community, MQL5 Algo Trading */}
        <div className="mt-5 bg-white border-y border-[#E5E5EA] divide-y divide-[#E5E5EA]">
          <button
            onClick={() => {
              if (!cloudUserEmail && onSignInGoogle) {
                onSignInGoogle();
              } else {
                setSubView('config');
              }
            }}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#F2F2F7]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-[7px] bg-[#4A89DC] flex items-center justify-center text-white relative shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66-.23-.45-.52-.86-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84C7 18.95 8.05 20 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z" />
                </svg>
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#EB4E3D] text-white text-[10px] font-bold flex items-center justify-center">
                  1
                </span>
              </div>
              <div className="text-left">
                <div className="text-[16px] font-medium text-black leading-snug">
                  Chat and Messages
                </div>
                <div className="text-[13px] font-medium text-black leading-snug">
                  {cloudUserEmail
                    ? `Synced: ${cloudUserEmail}`
                    : 'Sign in to MQL5.community!'}
                </div>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#1C85E8] flex items-center justify-center text-white shadow-xs">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path d="M5 8h14M5 12h14M5 16h9" strokeLinecap="round" />
              </svg>
            </div>
          </button>

          <button
            onClick={() => showToast('MQL5 Traders Community')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#F2F2F7]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-[7px] bg-[#1E62D0] flex items-center justify-center text-white font-black text-[10px] tracking-tighter shrink-0">
                MQL5
              </div>
              <span className="text-[16px] font-medium text-black">
                Traders Community
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />
          </button>

          <button
            onClick={() => showToast('MQL5 Algo Trading')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#F2F2F7]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-[7px] bg-[#32A4F6] flex items-center justify-center text-white shrink-0">
                <Send className="w-4 h-4" />
              </div>
              <span className="text-[16px] font-medium text-black">
                MQL5 Algo Trading
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />
          </button>
        </div>

        {/* Group 3: OTP, Interface, Charts, Journal, Settings */}
        <div className="mt-5 bg-white border-y border-[#E5E5EA] divide-y divide-[#E5E5EA]">
          <button
            onClick={() =>
              showToast(`OTP: ${Math.floor(100000 + Math.random() * 900000)}`)
            }
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#F2F2F7]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-[7px] bg-[#5AD469] flex items-center justify-center text-white shrink-0">
                <KeyRound className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-[16px] font-medium text-black leading-snug">
                  OTP
                </div>
                <div className="text-[13px] font-medium text-black leading-snug">
                  One-time password generator
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />
          </button>

          <button
            onClick={() => setSubView('config')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#F2F2F7]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-[7px] bg-[#2586F6] flex items-center justify-center text-white font-bold text-[11px] shrink-0">
                A文
              </div>
              <div className="text-left">
                <div className="text-[16px] font-medium text-black leading-snug">
                  Interface
                </div>
                <div className="text-[13px] font-medium text-black leading-snug">
                  English
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />
          </button>

          <button
            onClick={() => setSubView('config')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#F2F2F7]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-[7px] bg-[#2586F6] flex items-center justify-center text-white shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="7" width="4" height="10" rx="0.5" />
                  <path d="M8 3v18" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="14" y="5" width="4" height="9" rx="0.5" />
                  <path d="M16 2v16" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </div>
              <span className="text-[16px] font-medium text-black">Charts</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />
          </button>

          <button
            onClick={() => setSubView('journal')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#F2F2F7]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-[7px] bg-[#AEB4BC] flex items-center justify-center text-white shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-[16px] font-medium text-black">
                Journal
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />
          </button>

          {/* Bottom-most Settings row -> Opens Trade History & Withdrawal Control (Screenshots 1, 2, 3) */}
          <button
            onClick={() => setSubView('config')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#F2F2F7]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-[7px] bg-gradient-to-b from-[#BAE6FD] to-[#7DD3FC] flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" viewBox="0 0 32 32">
                  <circle cx="16" cy="9" r="4" fill="#16A34A" />
                  <path d="M10 20c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="#22C55E" />
                  <circle cx="9" cy="17" r="3.5" fill="#2563EB" />
                  <circle cx="23" cy="17" r="3.5" fill="#EAB308" />
                </svg>
              </div>
              <span className="text-[16px] font-medium text-black">
                Settings
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />
          </button>
        </div>
      </div>
    </div>
  );
};
