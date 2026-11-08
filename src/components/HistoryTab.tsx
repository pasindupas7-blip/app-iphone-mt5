import React, { useState } from 'react';
import { ArrowUpDown, Clock } from 'lucide-react';
import { ClosedDeal, TradingAccount } from '../types/mt5';
import { formatMT5Money } from '../utils/mt5Formatters';

interface HistoryTabProps {
  account: TradingAccount;
  deals: ClosedDeal[];
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ account, deals }) => {
  const [subTab, setSubTab] = useState<'positions' | 'orders' | 'deals'>('positions');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [symbolFilter, setSymbolFilter] = useState<string>('ALL');
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);

  const uniqueSymbols = ['ALL', ...Array.from(new Set(deals.map((d) => d.symbol)))];

  const filteredDeals = deals.filter((d) =>
    symbolFilter === 'ALL' ? true : d.symbol === symbolFilter
  );

  const totalProfit = filteredDeals
    .filter((d) => d.type !== 'balance')
    .reduce((acc, d) => acc + d.profit, 0);
  const totalSwap = filteredDeals.reduce((acc, d) => acc + d.swap, 0);
  const totalCommission = filteredDeals.reduce((acc, d) => acc + d.commission, 0);
  const depositAmount = account.initialDeposit;
  const computedBalance = account.balance;

  const getDigits = (sym: string) => {
    if (sym === 'XAUUSD' || sym === 'NAS100' || sym === 'BTCUSD') return 2;
    if (sym.endsWith('JPY')) return 3;
    return 5;
  };

  return (
    <div className="flex flex-col h-full bg-[#0D1117] text-[#E6EDF3]">
      {/* Top MT5 iOS History Header (Screenshot 5) */}
      <header className="pt-safe bg-[#161B22]/95 backdrop-blur-md border-b border-[#21262D] shrink-0 z-20">
        <div className="h-11 px-3 flex items-center justify-between gap-2">
          {/* Left: Cycle Symbol Filter */}
          <button
            onClick={() => {
              const idx = uniqueSymbols.indexOf(symbolFilter);
              setSymbolFilter(uniqueSymbols[(idx + 1) % uniqueSymbols.length]);
            }}
            className="min-w-[44px] min-h-[38px] flex items-center justify-start gap-1 text-[#2962FF] active:opacity-70"
            title="Filter by Symbol"
          >
            <ArrowUpDown className="w-4 h-4" />
            {symbolFilter !== 'ALL' && (
              <span className="text-[11px] font-bold">{symbolFilter}</span>
            )}
          </button>

          {/* Center: Authentic iOS Segmented Control (Positions | Orders | Deals) */}
          <div className="flex-1 max-w-[260px] bg-[#0D1117] p-0.5 rounded-lg border border-[#21262D] grid grid-cols-3">
            {(['positions', 'orders', 'deals'] as const).map((tab) => {
              const active = subTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setSubTab(tab)}
                  className={`py-1 text-[12px] font-semibold rounded-[6px] capitalize transition-colors ${
                    active
                      ? 'bg-[#161B22] text-[#E6EDF3] shadow-xs'
                      : 'text-[#8B949E] hover:text-[#E6EDF3]'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Right: Period Filter Icon */}
          <button
            onClick={() => setShowPeriodMenu((p) => !p)}
            className="min-w-[44px] min-h-[38px] flex items-center justify-end text-[#2962FF] active:opacity-70"
            title="History Period"
          >
            <Clock className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Scrollable Closed Trades + Summary */}
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col justify-between">
        <div className="divide-y divide-[#21262D]/80">
          {/* Initial Balance / Deposit Row when viewing Deals */}
          {subTab === 'deals' && (
            <div className="px-4 py-2.5 flex items-center justify-between bg-[#0D1117]">
              <div>
                <div className="text-[14px] font-bold text-[#E6EDF3]">Balance</div>
                <div className="text-[12px] text-[#8B949E]">Initial Deposit</div>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-bold text-[#2962FF] font-mono">
                  {formatMT5Money(depositAmount)}
                </div>
                <div className="text-[12px] text-[#8B949E] font-mono">
                  2026.08.01 09:00:00
                </div>
              </div>
            </div>
          )}

          {filteredDeals.map((deal) => {
            const digits = getDigits(deal.symbol);
            const isExpanded = selectedDealId === deal.id;
            const isPositive = deal.profit >= 0;

            return (
              <div
                key={deal.id}
                onClick={() => setSelectedDealId(isExpanded ? null : deal.id)}
                className="px-4 py-2.5 bg-[#0D1117] active:bg-[#161B22] transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  {/* Left: Symbol + buy/sell lots + Open -> Close prices + SL/TP indicator */}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      {/* Green/Red SL/TP Indicator Pill/Dot */}
                      {deal.closeReason === 'tp' && (
                        <span
                          className="w-1.5 h-3.5 rounded-xs bg-[#089981] inline-block"
                          title="Closed by Take Profit"
                        />
                      )}
                      {deal.closeReason === 'sl' && (
                        <span
                          className="w-1.5 h-3.5 rounded-xs bg-[#F23645] inline-block"
                          title="Closed by Stop Loss"
                        />
                      )}

                      <span className="text-[15px] font-bold text-[#E6EDF3]">
                        {deal.symbol}
                      </span>
                      <span
                        className={`text-[14px] font-semibold ${
                          deal.type === 'buy' ? 'text-[#2962FF]' : 'text-[#F23645]'
                        }`}
                      >
                        {deal.type}{' '}
                        {subTab === 'orders'
                          ? `${deal.lots} / ${deal.lots}`
                          : deal.lots}
                      </span>

                      {deal.closeReason === 'tp' && (
                        <span className="text-[10px] font-bold text-[#089981] uppercase tracking-wider ml-1">
                          [TP]
                        </span>
                      )}
                      {deal.closeReason === 'sl' && (
                        <span className="text-[10px] font-bold text-[#F23645] uppercase tracking-wider ml-1">
                          [SL]
                        </span>
                      )}
                    </div>

                    <div className="text-[13px] text-[#8B949E] font-mono">
                      {subTab === 'orders'
                        ? 'market'
                        : `${deal.openPrice.toFixed(digits)} → ${deal.closePrice.toFixed(
                            digits
                          )}`}
                    </div>
                  </div>

                  {/* Right: Profit/Loss + Timestamp (Screenshot 5) */}
                  <div className="text-right space-y-0.5">
                    <div
                      className={`text-[15px] font-bold font-mono ${
                        subTab === 'orders'
                          ? 'text-[#8B949E]'
                          : isPositive
                          ? 'text-[#2962FF]'
                          : 'text-[#F23645]'
                      }`}
                    >
                      {subTab === 'orders' ? 'filled' : deal.profit.toFixed(2)}
                    </div>
                    <div className="text-[12.5px] text-[#8B949E] font-mono">
                      {deal.closeTime}
                    </div>
                  </div>
                </div>

                {/* Expanded Ticket Details */}
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-[#21262D]/70 grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px] text-[#8B949E] font-mono">
                    <div className="flex justify-between">
                      <span>Deal Ticket:</span>
                      <span className="text-[#E6EDF3]">#{deal.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Order:</span>
                      <span className="text-[#E6EDF3]">#{deal.orderId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>S/L:</span>
                      <span className="text-[#F23645]">
                        {deal.sl !== null ? deal.sl.toFixed(digits) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>T/P:</span>
                      <span className="text-[#089981]">
                        {deal.tp !== null ? deal.tp.toFixed(digits) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Swap:</span>
                      <span className="text-[#E6EDF3]">{deal.swap.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Commission:</span>
                      <span className="text-[#E6EDF3]">
                        {deal.commission.toFixed(2)}
                      </span>
                    </div>
                    <div className="col-span-2 flex justify-between">
                      <span>Open Time:</span>
                      <span className="text-[#E6EDF3]">{deal.openTime}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Authentic MT5 Bottom Financial Summary Block (Screenshot 5) */}
        <div className="px-4 py-3.5 bg-[#161B22]/90 border-t border-[#21262D] space-y-1.5 text-[14.5px] mt-2 shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#E6EDF3]">Deposit</span>
            <span className="font-bold text-[#E6EDF3] font-mono">
              {formatMT5Money(depositAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#E6EDF3]">Profit</span>
            <span
              className={`font-bold font-mono ${
                totalProfit >= 0 ? 'text-[#2962FF]' : 'text-[#F23645]'
              }`}
            >
              {formatMT5Money(totalProfit)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#E6EDF3]">Swap</span>
            <span className="font-bold text-[#E6EDF3] font-mono">
              {formatMT5Money(totalSwap)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#E6EDF3]">Commission</span>
            <span className="font-bold text-[#E6EDF3] font-mono">
              {formatMT5Money(totalCommission)}
            </span>
          </div>
          <div className="flex items-center justify-between pt-0.5">
            <span className="font-semibold text-[#E6EDF3]">Balance</span>
            <span className="font-bold text-[#E6EDF3] font-mono">
              {formatMT5Money(computedBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* Period Filter Sheet */}
      {showPeriodMenu && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end p-3 pb-safe"
          onClick={() => setShowPeriodMenu(false)}
        >
          <div
            className="w-full max-w-md mx-auto space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#161B22] border border-[#21262D] rounded-2xl overflow-hidden divide-y divide-[#21262D]">
              <div className="py-2.5 text-center text-[12px] font-semibold text-[#8B949E]">
                Filter History Symbol
              </div>
              {uniqueSymbols.map((sym) => (
                <button
                  key={sym}
                  onClick={() => {
                    setSymbolFilter(sym);
                    setShowPeriodMenu(false);
                  }}
                  className={`w-full py-3 text-[15px] font-medium ${
                    symbolFilter === sym
                      ? 'text-[#089981] font-bold'
                      : 'text-[#2962FF]'
                  }`}
                >
                  {sym === 'ALL' ? 'All Symbols' : sym}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowPeriodMenu(false)}
              className="w-full py-3.5 bg-[#161B22] border border-[#21262D] rounded-2xl text-[16px] font-semibold text-[#2962FF]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
