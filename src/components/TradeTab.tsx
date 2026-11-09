import React, { useState } from 'react';
import { Plus, Pencil, CheckCircle2, BarChart2, X } from 'lucide-react';
import { Position, QuoteData, TradingAccount } from '../types/mt5';
import {
  calculatePositionMargin,
  calculatePositionPL,
  formatMT5Money,
} from '../utils/mt5Formatters';

interface TradeTabProps {
  account: TradingAccount;
  positions: Position[];
  quotes: Record<string, QuoteData>;
  activeSymbol: string;
  onOpenNewOrder: (symbol: string) => void;
  onClosePosition: (positionId: string) => void;
  onModifyPosition: (positionId: string, sl: number | null, tp: number | null) => void;
  onCloseAllPositions: (filter?: 'all' | 'profit' | 'loss') => void;
  onOpenChart: (symbol: string) => void;
}

export const TradeTab: React.FC<TradeTabProps> = ({
  account,
  positions,
  quotes,
  activeSymbol,
  onOpenNewOrder,
  onClosePosition,
  onModifyPosition,
  onCloseAllPositions,
  onOpenChart,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modifyPos, setModifyPos] = useState<Position | null>(null);
  const [modSl, setModSl] = useState('');
  const [modTp, setModTp] = useState('');
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  let totalFloatingPL = 0;
  let totalMargin = 0;

  for (const pos of positions) {
    const q = quotes[pos.symbol];
    totalFloatingPL += calculatePositionPL(pos, q);
    totalMargin += calculatePositionMargin(pos, q, account.leverage);
  }

  totalFloatingPL = Number(totalFloatingPL.toFixed(2));
  totalMargin = Number(totalMargin.toFixed(2));
  const equity = Number((account.balance + totalFloatingPL).toFixed(2));
  const freeMargin = Number((equity - totalMargin).toFixed(2));
  const marginLevel =
    totalMargin > 0 ? Number(((equity / totalMargin) * 100).toFixed(2)) : 0;

  const hasPositions = positions.length > 0;
  const headerPlColor =
    !hasPositions
      ? 'text-black'
      : totalFloatingPL >= 0
      ? 'text-[#007AFF]'
      : 'text-[#D92B2B]';

  const openModifyDialog = (pos: Position) => {
    setModifyPos(pos);
    setModSl(pos.sl !== null ? String(pos.sl) : '');
    setModTp(pos.tp !== null ? String(pos.tp) : '');
  };

  const handleSaveModify = () => {
    if (!modifyPos) return;
    const slVal = modSl.trim() !== '' && parseFloat(modSl) > 0 ? parseFloat(modSl) : null;
    const tpVal = modTp.trim() !== '' && parseFloat(modTp) > 0 ? parseFloat(modTp) : null;
    onModifyPosition(modifyPos.id, slVal, tpVal);
    setModifyPos(null);
  };

  return (
    <div className="flex flex-col h-full bg-white text-black">
      {/* Top Header (Screenshot 1: Centered "USD" + Right "+") */}
      <header className="pt-safe bg-white shrink-0 z-20">
        <div className="h-11 px-4 flex items-center justify-between">
          <div className="w-8" />

          <div className="flex flex-col items-center">
            <span
              className={`text-[21px] font-bold tracking-tight mt5-symbol-font ${headerPlColor}`}
            >
              {hasPositions
                ? `${formatMT5Money(totalFloatingPL, false)} ${account.currency}`
                : account.currency}
            </span>
          </div>

          <button
            onClick={() => onOpenNewOrder(activeSymbol)}
            className="min-w-[36px] min-h-[36px] flex items-center justify-end text-[#6C6C70] active:opacity-60"
            aria-label="New Order"
          >
            <Plus className="w-7 h-7 stroke-[1.7]" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
        {/* Account Summary Header (Screenshot 1: Balance, Equity, Free Margin) */}
        <div className="px-4 pt-2 pb-3 bg-white space-y-1.5 text-[15.5px]">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-black">Balance:</span>
            <span className="font-bold text-black">
              {formatMT5Money(account.balance)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-black">Equity:</span>
            <span className="font-bold text-black">
              {formatMT5Money(equity)}
            </span>
          </div>
          {hasPositions && (
            <div className="flex items-center justify-between">
              <span className="font-semibold text-black">Margin:</span>
              <span className="font-bold text-black">
                {formatMT5Money(totalMargin)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-black">Free Margin:</span>
            <span className="font-bold text-black">
              {formatMT5Money(freeMargin)}
            </span>
          </div>
          {hasPositions && (
            <div className="flex items-center justify-between">
              <span className="font-semibold text-black">Margin Level (%):</span>
              <span className="font-bold text-black">
                {formatMT5Money(marginLevel)}
              </span>
            </div>
          )}
        </div>

        {hasPositions ? (
          <div className="flex-1 border-t border-[#E5E5EA]">
            {/* Positions Section Header */}
            <div className="px-4 py-1.5 bg-[#F2F2F7] border-b border-[#E5E5EA] flex items-center justify-between">
              <span className="text-[12px] font-semibold text-[#6C6C70] uppercase tracking-wider">
                Positions
              </span>
              <button
                onClick={() => setShowBulkMenu(true)}
                className="text-[#6C6C70] px-1 text-[16px] leading-none font-bold"
              >
                •••
              </button>
            </div>

            {/* Open Positions List */}
            <div className="divide-y divide-[#E5E5EA]">
              {positions.map((pos) => {
                const q = quotes[pos.symbol];
                const digits = q?.digits ?? 2;
                const currentPrice = q
                  ? pos.type === 'buy'
                    ? q.bid
                    : q.ask
                  : pos.openPrice;
                const pl = calculatePositionPL(pos, q);
                const isExpanded = expandedId === pos.id;

                return (
                  <div key={pos.id} className="bg-white">
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : pos.id)}
                      className="px-4 py-2.5 flex items-center justify-between cursor-pointer active:bg-[#F2F2F7]"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[16px] font-extrabold text-black mt5-symbol-font">
                            {pos.symbol}
                          </span>
                          <span
                            className={`text-[15px] font-bold ${
                              pos.type === 'buy' ? 'text-[#007AFF]' : 'text-[#D92B2B]'
                            }`}
                          >
                            {pos.type} {pos.lots}
                          </span>
                        </div>
                        <div className="text-[13.5px] text-[#48484A]">
                          {pos.openPrice.toFixed(digits)} → {currentPrice.toFixed(digits)}
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                        <span
                          className={`text-[16px] font-bold ${
                            pl >= 0 ? 'text-[#007AFF]' : 'text-[#D92B2B]'
                          }`}
                        >
                          {pl.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1.5 bg-[#F9F9F9] border-t border-[#E5E5EA] space-y-2.5">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-[#6C6C70]">
                          <div className="flex justify-between">
                            <span>S/L:</span>
                            <span className="text-black font-medium">
                              {pos.sl !== null ? pos.sl.toFixed(digits) : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Swap:</span>
                            <span className="text-black font-medium">
                              {pos.swap.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>T/P:</span>
                            <span className="text-black font-medium">
                              {pos.tp !== null ? pos.tp.toFixed(digits) : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>ID:</span>
                            <span className="text-black font-medium">#{pos.id}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <button
                            onClick={() => onClosePosition(pos.id)}
                            className="py-2 px-2 rounded-lg bg-[#D92B2B] text-white text-[12px] font-bold flex items-center justify-center gap-1 active:opacity-85"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Close ({pl.toFixed(2)})</span>
                          </button>

                          <button
                            onClick={() => openModifyDialog(pos)}
                            className="py-2 px-2 rounded-lg bg-[#E5E5EA] text-[#007AFF] text-[12px] font-semibold flex items-center justify-center gap-1"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Modify</span>
                          </button>

                          <button
                            onClick={() => onOpenChart(pos.symbol)}
                            className="py-2 px-2 rounded-lg bg-[#E5E5EA] text-black text-[12px] font-semibold flex items-center justify-center gap-1"
                          >
                            <BarChart2 className="w-3.5 h-3.5" />
                            <span>Chart</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Authentic MT5 Empty Positions Watermark Graphic (Screenshot 1) */
          <div className="flex-1 flex items-center justify-center pb-12">
            <svg
              viewBox="0 0 120 120"
              className="w-36 h-36 text-[#F1F1F3]"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 86 L50 58 L64 72 L98 38" />
              <path d="M74 38 H98 V62" />
              <path d="M38 98 L62 74" />
              <path d="M58 98 L74 82" />
            </svg>
          </div>
        )}
      </div>

      {/* Modify SL / TP Modal */}
      {modifyPos && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setModifyPos(null)}
        >
          <div
            className="w-full max-w-sm bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[#E5E5EA] flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-black">
                  Modify Position #{modifyPos.id}
                </h3>
                <p className="text-[12px] text-[#6C6C70]">
                  {modifyPos.symbol} {modifyPos.type} {modifyPos.lots}
                </p>
              </div>
              <button onClick={() => setModifyPos(null)} className="text-[#6C6C70]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#D92B2B] mb-1">
                  Stop Loss (SL)
                </label>
                <input
                  type="number"
                  step="any"
                  value={modSl}
                  onChange={(e) => setModSl(e.target.value)}
                  placeholder="Not set"
                  className="w-full px-3 py-2 bg-[#F2F2F7] rounded-xl text-[14px] text-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#269E86] mb-1">
                  Take Profit (TP)
                </label>
                <input
                  type="number"
                  step="any"
                  value={modTp}
                  onChange={(e) => setModTp(e.target.value)}
                  placeholder="Not set"
                  className="w-full px-3 py-2 bg-[#F2F2F7] rounded-xl text-[14px] text-black focus:outline-none"
                />
              </div>

              <button
                onClick={handleSaveModify}
                className="w-full h-11 rounded-xl bg-[#007AFF] text-white text-[15px] font-bold"
              >
                Modify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Close Positions Action Sheet */}
      {showBulkMenu && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex flex-col justify-end p-3 pb-safe"
          onClick={() => setShowBulkMenu(false)}
        >
          <div
            className="w-full max-w-md mx-auto space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl overflow-hidden divide-y divide-[#E5E5EA] shadow-lg">
              <button
                onClick={() => {
                  onCloseAllPositions('all');
                  setShowBulkMenu(false);
                }}
                className="w-full py-3.5 text-[16px] font-medium text-[#D92B2B]"
              >
                Close All Positions ({formatMT5Money(totalFloatingPL, true)} USD)
              </button>
              <button
                onClick={() => {
                  onCloseAllPositions('profit');
                  setShowBulkMenu(false);
                }}
                className="w-full py-3.5 text-[16px] font-medium text-[#007AFF]"
              >
                Close Profitable Positions
              </button>
              <button
                onClick={() => {
                  onCloseAllPositions('loss');
                  setShowBulkMenu(false);
                }}
                className="w-full py-3.5 text-[16px] font-medium text-[#007AFF]"
              >
                Close Losing Positions
              </button>
            </div>
            <button
              onClick={() => setShowBulkMenu(false)}
              className="w-full py-3.5 bg-white rounded-2xl text-[16px] font-semibold text-[#007AFF] shadow-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
