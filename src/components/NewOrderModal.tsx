import React, { useState, useEffect } from 'react';
import { ChevronDown, Minus, Plus, X } from 'lucide-react';
import { QuoteData } from '../types/mt5';
import { splitMT5Price } from '../utils/mt5Formatters';

interface NewOrderModalProps {
  isOpen: boolean;
  initialSymbol: string;
  quotes: Record<string, QuoteData>;
  watchlist: string[];
  onClose: () => void;
  onExecuteOrder: (
    symbol: string,
    type: 'buy' | 'sell',
    lots: number,
    sl: number | null,
    tp: number | null
  ) => void;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  initialSymbol,
  quotes,
  watchlist,
  onClose,
  onExecuteOrder,
}) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [lotsStr, setLotsStr] = useState('0.10');
  const [slStr, setSlStr] = useState('');
  const [tpStr, setTpStr] = useState('');
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSymbol(initialSymbol);
      setSlStr('');
      setTpStr('');
    }
  }, [isOpen, initialSymbol]);

  if (!isOpen) return null;

  const q = quotes[symbol] || Object.values(quotes)[0];
  if (!q) return null;

  const adjustLots = (delta: number) => {
    const current = parseFloat(lotsStr) || 0.01;
    const next = Math.max(0.01, Math.min(100, Number((current + delta).toFixed(2))));
    setLotsStr(next.toFixed(2));
  };

  const stepPriceInput = (
    currentVal: string,
    setter: (v: string) => void,
    direction: 1 | -1
  ) => {
    const step = q.point * 10;
    const base = parseFloat(currentVal);
    if (isNaN(base) || base <= 0) {
      const startPrice = Number((q.bid + direction * step * 5).toFixed(q.digits));
      setter(startPrice.toFixed(q.digits));
    } else {
      const next = Math.max(q.point, Number((base + direction * step).toFixed(q.digits)));
      setter(next.toFixed(q.digits));
    }
  };

  const handlePlaceOrder = (type: 'buy' | 'sell') => {
    const lots = Math.max(0.01, parseFloat(lotsStr) || 0.01);
    const sl = slStr.trim() !== '' && parseFloat(slStr) > 0 ? parseFloat(slStr) : null;
    const tp = tpStr.trim() !== '' && parseFloat(tpStr) > 0 ? parseFloat(tpStr) : null;
    onExecuteOrder(symbol, type, lots, sl, tp);
    onClose();
  };

  const bidParts = splitMT5Price(q.bid, q.digits);
  const askParts = splitMT5Price(q.ask, q.digits);
  const isUp = q.flash === 'up' || (q.flash === 'none' && q.bid >= q.prevBid);
  const priceColor = isUp ? 'text-[#2962FF]' : 'text-[#F23645]';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#0D1117] border-t sm:border border-[#21262D] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[92vh] pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3 bg-[#161B22] border-b border-[#21262D] flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-[15px] text-[#2962FF] font-medium min-w-[54px] text-left active:opacity-70"
          >
            Cancel
          </button>

          <button
            onClick={() => setShowSymbolPicker((p) => !p)}
            className="flex flex-col items-center"
          >
            <div className="flex items-center gap-1 text-[16px] font-bold text-[#E6EDF3]">
              <span>{q.symbol}</span>
              <ChevronDown className="w-4 h-4 text-[#8B949E]" />
            </div>
            <span className="text-[11px] text-[#8B949E]">{q.description}</span>
          </button>

          <button
            onClick={onClose}
            className="min-w-[54px] flex justify-end text-[#8B949E] hover:text-[#E6EDF3]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Symbol Switcher Accordion */}
        {showSymbolPicker && (
          <div className="bg-[#161B22] border-b border-[#21262D] max-h-48 overflow-y-auto divide-y divide-[#21262D]">
            {watchlist.map((sym) => {
              const item = quotes[sym];
              if (!item) return null;
              return (
                <button
                  key={sym}
                  onClick={() => {
                    setSymbol(sym);
                    setSlStr('');
                    setTpStr('');
                    setShowSymbolPicker(false);
                  }}
                  className={`w-full px-4 py-2.5 flex items-center justify-between text-left ${
                    sym === symbol ? 'bg-[#2962FF]/15 text-[#2962FF]' : 'text-[#E6EDF3]'
                  }`}
                >
                  <div>
                    <div className="text-[14px] font-bold">{item.symbol}</div>
                    <div className="text-[11px] text-[#8B949E]">{item.description}</div>
                  </div>
                  <div className="text-[13px] font-mono">
                    {item.bid.toFixed(item.digits)} / {item.ask.toFixed(item.digits)}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="p-4 space-y-3 overflow-y-auto">
          {/* Execution Type */}
          <div className="bg-[#161B22] border border-[#21262D] rounded-xl px-3.5 py-2.5 flex items-center justify-between">
            <span className="text-[14px] text-[#8B949E]">Execution</span>
            <span className="text-[14px] font-semibold text-[#E6EDF3]">
              Market Execution
            </span>
          </div>

          {/* Authentic MT5 Lot Size Steppers: -0.1 | -0.01 | LOT INPUT | +0.01 | +0.1 */}
          <div className="bg-[#161B22] border border-[#21262D] rounded-xl px-2 py-1.5 flex items-center justify-between">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => adjustLots(-0.1)}
                className="min-w-[46px] min-h-[40px] px-2 text-[14px] font-semibold text-[#2962FF] active:bg-[#21262D] rounded-lg"
              >
                -0.1
              </button>
              <button
                type="button"
                onClick={() => adjustLots(-0.01)}
                className="min-w-[48px] min-h-[40px] px-2 text-[14px] font-semibold text-[#2962FF] active:bg-[#21262D] rounded-lg"
              >
                -0.01
              </button>
            </div>

            <input
              type="number"
              step="0.01"
              min="0.01"
              value={lotsStr}
              onChange={(e) => setLotsStr(e.target.value)}
              className="w-24 text-center bg-transparent text-[19px] font-bold text-[#E6EDF3] focus:outline-none"
            />

            <div className="flex items-center">
              <button
                type="button"
                onClick={() => adjustLots(0.01)}
                className="min-w-[48px] min-h-[40px] px-2 text-[14px] font-semibold text-[#2962FF] active:bg-[#21262D] rounded-lg"
              >
                +0.01
              </button>
              <button
                type="button"
                onClick={() => adjustLots(0.1)}
                className="min-w-[46px] min-h-[40px] px-2 text-[14px] font-semibold text-[#2962FF] active:bg-[#21262D] rounded-lg"
              >
                +0.1
              </button>
            </div>
          </div>

          {/* Live Bid & Ask Display */}
          <div className="py-2 px-4 bg-[#161B22]/60 border border-[#21262D] rounded-xl flex items-center justify-around">
            <div className="text-center">
              <div className="text-[11px] text-[#8B949E] uppercase mb-0.5">Bid</div>
              <div className={`inline-flex items-baseline ${priceColor}`}>
                <span className="text-[18px] font-medium">{bidParts.prefix}</span>
                <span className="text-[28px] font-bold">{bidParts.big}</span>
                {bidParts.sup && (
                  <span className="text-[14px] font-bold self-start -mt-0.5">
                    {bidParts.sup}
                  </span>
                )}
              </div>
            </div>

            <div className="h-9 w-[1px] bg-[#21262D]" />

            <div className="text-center">
              <div className="text-[11px] text-[#8B949E] uppercase mb-0.5">Ask</div>
              <div className={`inline-flex items-baseline ${priceColor}`}>
                <span className="text-[18px] font-medium">{askParts.prefix}</span>
                <span className="text-[28px] font-bold">{askParts.big}</span>
                {askParts.sup && (
                  <span className="text-[14px] font-bold self-start -mt-0.5">
                    {askParts.sup}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stop Loss & Take Profit Inputs */}
          <div className="bg-[#161B22] border border-[#21262D] rounded-xl divide-y divide-[#21262D]">
            {/* Stop Loss */}
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-[14px] font-medium text-[#F23645] w-24">
                Stop Loss
              </span>
              <div className="flex items-center gap-1 flex-1 justify-end">
                <button
                  type="button"
                  onClick={() => stepPriceInput(slStr, setSlStr, -1)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#2962FF] active:bg-[#21262D]"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  step={q.point}
                  value={slStr}
                  onChange={(e) => setSlStr(e.target.value)}
                  placeholder="Not set"
                  className="w-28 text-center bg-[#0D1117] border border-[#21262D] rounded-lg py-1.5 text-[14px] font-mono text-[#E6EDF3] placeholder-[#8B949E] focus:outline-none focus:border-[#2962FF]"
                />
                <button
                  type="button"
                  onClick={() => stepPriceInput(slStr, setSlStr, 1)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#2962FF] active:bg-[#21262D]"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Take Profit */}
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-[14px] font-medium text-[#089981] w-24">
                Take Profit
              </span>
              <div className="flex items-center gap-1 flex-1 justify-end">
                <button
                  type="button"
                  onClick={() => stepPriceInput(tpStr, setTpStr, -1)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#2962FF] active:bg-[#21262D]"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  step={q.point}
                  value={tpStr}
                  onChange={(e) => setTpStr(e.target.value)}
                  placeholder="Not set"
                  className="w-28 text-center bg-[#0D1117] border border-[#21262D] rounded-lg py-1.5 text-[14px] font-mono text-[#E6EDF3] placeholder-[#8B949E] focus:outline-none focus:border-[#2962FF]"
                />
                <button
                  type="button"
                  onClick={() => stepPriceInput(tpStr, setTpStr, 1)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#2962FF] active:bg-[#21262D]"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Instant SELL / BUY by Market Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => handlePlaceOrder('sell')}
              className="h-14 rounded-xl bg-[#F23645] active:bg-[#F23645]/85 text-white flex flex-col items-center justify-center shadow-lg transition-transform active:scale-[0.98]"
            >
              <span className="text-[15px] font-bold tracking-tight leading-tight">
                SELL
              </span>
              <span className="text-[11px] font-medium opacity-90 leading-tight">
                by Market
              </span>
            </button>

            <button
              type="button"
              onClick={() => handlePlaceOrder('buy')}
              className="h-14 rounded-xl bg-[#2962FF] active:bg-[#2962FF]/85 text-white flex flex-col items-center justify-center shadow-lg transition-transform active:scale-[0.98]"
            >
              <span className="text-[15px] font-bold tracking-tight leading-tight">
                BUY
              </span>
              <span className="text-[11px] font-medium opacity-90 leading-tight">
                by Market
              </span>
            </button>
          </div>

          <div className="text-center text-[11px] text-[#8B949E] pt-0.5">
            Attention! The trade will be executed at market conditions, difference with requested price may be significant!
          </div>
        </div>
      </div>
    </div>
  );
};
