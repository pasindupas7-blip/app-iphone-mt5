import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  UserPlus,
  Mail,
  BookOpen,
  Calendar,
  MessageSquare,
  Globe,
  Send,
  KeyRound,
  Languages,
  BarChart2,
  FileText,
  Settings,
  Wifi,
  Check,
  DollarSign,
} from 'lucide-react';
import { TradingAccount } from '../types/mt5';
import { formatMT5Money } from '../utils/mt5Formatters';

interface SettingsTabProps {
  accounts: TradingAccount[];
  activeAccount: TradingAccount;
  onSelectAccount: (id: string) => void;
  onUpdateAccount: (updates: Partial<TradingAccount>) => void;
  onTopUpBalance: (amount: number) => void;
  onCreateAccount: (acc: Omit<TradingAccount, 'id'>) => void;
  twelveDataApiKey: string;
  onSaveTwelveDataKey: (key: string) => void;
  wsStatus: 'simulator' | 'connecting' | 'connected' | 'error';
  journalLogs: string[];
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  accounts,
  activeAccount,
  onSelectAccount,
  onUpdateAccount,
  onTopUpBalance,
  onCreateAccount,
  twelveDataApiKey,
  onSaveTwelveDataKey,
  wsStatus,
  journalLogs,
}) => {
  const [subView, setSubView] = useState<
    'main' | 'accounts' | 'config' | 'journal' | 'mailbox' | 'otp'
  >('main');

  // Form states for Account & Feed Configuration
  const [accName, setAccName] = useState(activeAccount.name);
  const [accServer, setAccServer] = useState(activeAccount.server);
  const [accLogin, setAccLogin] = useState(activeAccount.login);
  const [topUpInput, setTopUpInput] = useState('1000.00');
  const [apiKeyInput, setApiKeyInput] = useState(twelveDataApiKey);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 2200);
  };

  const syncFormWithAccount = (acc: TradingAccount) => {
    setAccName(acc.name);
    setAccServer(acc.server);
    setAccLogin(acc.login);
  };

  const handleSaveAccountConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateAccount({
      name: accName.trim() || activeAccount.name,
      server: accServer.trim() || activeAccount.server,
      broker: accServer.trim() || activeAccount.broker,
      login: accLogin.trim() || activeAccount.login,
    });
    onSaveTwelveDataKey(apiKeyInput.trim());
    showToast('Account & feed settings saved');
  };

  const handleBalanceTopUp = (amount: number) => {
    if (isNaN(amount) || amount <= 0) return;
    onTopUpBalance(amount);
    showToast(`Deposited +${formatMT5Money(amount)} USD`);
  };

  const renderBrokerLogo = (logoType: TradingAccount['logoType']) => {
    switch (logoType) {
      case 'fusion':
        return (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#4C1D95] flex items-center justify-center text-white font-black text-[18px] shrink-0 shadow-xs">
            F
          </div>
        );
      case 'ftmo':
        return (
          <div className="w-10 h-10 rounded-lg bg-[#111827] border border-[#089981]/50 flex items-center justify-center text-white font-bold text-[15px] shrink-0">
            <span className="rotate-45 border-2 border-white w-4 h-4 inline-block" />
          </div>
        );
      case 'ftmo_mt5':
        return (
          <div className="w-10 h-10 rounded-lg bg-[#1E293B] border border-[#2962FF]/40 flex items-center justify-center text-[#089981] font-extrabold text-[11px] shrink-0">
            MT5
          </div>
        );
      case 'fundingpips':
        return (
          <div className="w-10 h-10 rounded-lg bg-[#0F172A] border border-[#3B82F6]/40 flex items-center justify-center text-white font-black text-[15px] shrink-0">
            FP
          </div>
        );
      case 'vt':
        return (
          <div className="w-10 h-10 rounded-lg bg-[#161B22] border border-[#21262D] flex items-center justify-center font-black text-[16px] shrink-0">
            <span className="text-[#E6EDF3]">v</span>
            <span className="text-[#06B6D4]">t</span>
          </div>
        );
    }
  };

  // SUBVIEW 1: ACCOUNTS SCREEN (Screenshot 1)
  if (subView === 'accounts') {
    return (
      <div className="flex flex-col h-full bg-[#0D1117] text-[#E6EDF3]">
        <header className="pt-safe bg-[#161B22]/95 backdrop-blur-md border-b border-[#21262D] shrink-0 z-20">
          <div className="h-11 px-3 flex items-center justify-between">
            <button
              onClick={() => setSubView('main')}
              className="min-w-[44px] min-h-[44px] flex items-center text-[#2962FF] active:opacity-70"
            >
              <ChevronLeft className="w-6 h-6 -ml-1" />
            </button>
            <h1 className="text-[17px] font-semibold text-[#E6EDF3]">Accounts</h1>
            <button
              onClick={() => {
                const newNum = Math.floor(100000 + Math.random() * 900000);
                onCreateAccount({
                  name: `DEMO_${String(accounts.length + 1).padStart(3, '0')}`,
                  login: String(newNum),
                  broker: 'FusionMarkets-Demo',
                  company: 'Fusion Markets Pty Ltd',
                  server: 'FusionMarkets-Demo',
                  balance: 100000.0,
                  initialDeposit: 100000.0,
                  leverage: 500,
                  currency: 'USD',
                  isDemo: true,
                  logoType: 'fusion',
                });
                showToast('Created new $100k Demo Account');
              }}
              className="min-w-[44px] min-h-[44px] flex items-center justify-end text-[#2962FF] active:opacity-70"
              title="Add New Demo Account"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-[#21262D]">
          {accounts.map((acc) => {
            const isActive = acc.id === activeAccount.id;
            return (
              <div
                key={acc.id}
                onClick={() => {
                  onSelectAccount(acc.id);
                  syncFormWithAccount(acc);
                  setSubView('main');
                }}
                className={`px-4 py-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                  isActive ? 'bg-[#161B22]' : 'bg-[#0D1117] active:bg-[#161B22]/60'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {renderBrokerLogo(acc.logoType)}
                  <div className="min-w-0 space-y-0.5">
                    <div
                      className={`text-[15.5px] font-bold truncate ${
                        isActive ? 'text-[#2962FF]' : 'text-[#E6EDF3]'
                      }`}
                    >
                      {acc.name}
                    </div>
                    <div className="text-[13px] text-[#8B949E] truncate">
                      {acc.login} - {acc.server}
                    </div>
                    <div className="text-[13px] text-[#8B949E] font-mono">
                      {formatMT5Money(acc.balance)} {acc.currency}, Hedge
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between self-stretch shrink-0 ml-2">
                  {acc.readOnly ? (
                    <span className="text-[11px] font-semibold text-[#8B949E] border border-[#8B949E]/40 rounded-full px-2 py-0.5">
                      Read Only
                    </span>
                  ) : acc.isDemo ? (
                    <span className="text-[11px] font-semibold text-[#089981] border border-[#089981]/50 bg-[#089981]/10 rounded-full px-2.5 py-0.5">
                      Demo
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-[#2962FF] border border-[#2962FF]/50 bg-[#2962FF]/10 rounded-full px-2.5 py-0.5">
                      Real
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-[#8B949E] mt-2" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // SUBVIEW 2: JOURNAL SCREEN
  if (subView === 'journal') {
    return (
      <div className="flex flex-col h-full bg-[#0D1117] text-[#E6EDF3]">
        <header className="pt-safe bg-[#161B22] border-b border-[#21262D] shrink-0">
          <div className="h-11 px-3 flex items-center justify-between">
            <button
              onClick={() => setSubView('main')}
              className="min-w-[44px] min-h-[44px] flex items-center text-[#2962FF]"
            >
              <ChevronLeft className="w-6 h-6 -ml-1" />
              <span className="text-[15px]">Settings</span>
            </button>
            <h1 className="text-[17px] font-semibold">Journal</h1>
            <div className="w-12" />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-3 font-mono text-[11.5px] space-y-1.5">
          {journalLogs.map((log, i) => (
            <div
              key={i}
              className="p-2 rounded bg-[#161B22] border border-[#21262D] text-[#8B949E]"
            >
              {log}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // SUBVIEW 3: MAILBOX SCREEN
  if (subView === 'mailbox') {
    return (
      <div className="flex flex-col h-full bg-[#0D1117] text-[#E6EDF3]">
        <header className="pt-safe bg-[#161B22] border-b border-[#21262D] shrink-0">
          <div className="h-11 px-3 flex items-center justify-between">
            <button
              onClick={() => setSubView('main')}
              className="min-w-[44px] min-h-[44px] flex items-center text-[#2962FF]"
            >
              <ChevronLeft className="w-6 h-6 -ml-1" />
              <span className="text-[15px]">Settings</span>
            </button>
            <h1 className="text-[17px] font-semibold">Mailbox</h1>
            <div className="w-12" />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto divide-y divide-[#21262D]">
          <div className="p-4 bg-[#161B22]/60 space-y-1">
            <div className="flex justify-between text-[12px] text-[#8B949E]">
              <span className="font-semibold text-[#2962FF]">Trading System</span>
              <span>Today</span>
            </div>
            <div className="text-[14px] font-bold text-[#E6EDF3]">
              You have registered a new account - {activeAccount.company}
            </div>
            <p className="text-[12.5px] text-[#8B949E] pt-1 leading-relaxed">
              Login: {activeAccount.login}
              <br />
              Server: {activeAccount.server}
              <br />
              Account Name: {activeAccount.name}
              <br />
              Leverage: 1:{activeAccount.leverage} ({activeAccount.currency}, Hedge)
            </p>
          </div>
        </div>
      </div>
    );
  }

  // MAIN SETTINGS SCREEN (Screenshots 2 & 4 + Inline Account/Server/Top-up/TwelveData Config)
  return (
    <div className="flex flex-col h-full bg-[#0D1117] text-[#E6EDF3]">
      {/* Top Header */}
      <header className="pt-safe bg-[#161B22]/95 backdrop-blur-md border-b border-[#21262D] shrink-0 z-20">
        <div className="h-11 px-4 flex items-center justify-center relative">
          <h1 className="text-[17px] font-semibold tracking-tight text-[#E6EDF3]">
            Settings
          </h1>
        </div>
      </header>

      {savedToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#089981] text-white text-[13px] font-semibold shadow-lg flex items-center gap-1.5">
          <Check className="w-4 h-4" />
          <span>{savedToast}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar pb-6 space-y-3">
        {/* Top Active Account Profile Banner (Screenshot 4) */}
        <div
          onClick={() => setSubView('accounts')}
          className="relative overflow-hidden bg-[#161B22] border-b border-[#21262D] px-4 py-4 flex items-center justify-between cursor-pointer active:bg-[#21262D]/70 transition-colors"
        >
          {/* Diagonal Green DEMO Ribbon on Top-Right */}
          {activeAccount.isDemo && (
            <div className="absolute top-2 -right-7 rotate-45 bg-[#089981] text-white text-[9px] font-bold px-7 py-0.5 shadow-xs uppercase tracking-wider">
              Demo
            </div>
          )}

          <div className="flex-1 text-center space-y-0.5 pr-4">
            <div className="text-[17px] font-bold text-[#E6EDF3]">
              {activeAccount.name}
            </div>
            <div className="text-[13px] font-medium text-[#E6EDF3]/90">
              {activeAccount.company}
            </div>
            <div className="text-[13px] text-[#8B949E] pt-1">
              {activeAccount.login} - {activeAccount.server}
            </div>
            <div className="text-[12px] text-[#8B949E]">
              Balance: {formatMT5Money(activeAccount.balance)} {activeAccount.currency} · Local Access Server
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-[#8B949E] shrink-0" />
        </div>

        {/* Terminal Configuration Card: Account Name, Server, Balance Top-Up & Twelve Data WebSocket API Key */}
        <div className="mx-3 bg-[#161B22] border border-[#21262D] rounded-2xl p-4 space-y-3.5">
          <div className="flex items-center justify-between border-b border-[#21262D] pb-2.5">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#2962FF]" />
              <h2 className="text-[14px] font-bold text-[#E6EDF3]">
                Account & Market Data Configuration
              </h2>
            </div>
            <span
              className={`text-[11px] font-semibold flex items-center gap-1 ${
                wsStatus === 'connected'
                  ? 'text-[#089981]'
                  : wsStatus === 'error'
                  ? 'text-[#F23645]'
                  : 'text-[#2962FF]'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              {wsStatus === 'connected'
                ? 'Twelve Data Live WS'
                : wsStatus === 'connecting'
                ? 'Connecting WS...'
                : 'Live Tick Simulator'}
            </span>
          </div>

          <form onSubmit={handleSaveAccountConfig} className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-[#8B949E] mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0D1117] border border-[#21262D] rounded-xl text-[13px] text-[#E6EDF3] focus:outline-none focus:border-[#2962FF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#8B949E] mb-1">
                  Broker Server
                </label>
                <input
                  type="text"
                  value={accServer}
                  onChange={(e) => setAccServer(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0D1117] border border-[#21262D] rounded-xl text-[13px] text-[#E6EDF3] focus:outline-none focus:border-[#2962FF]"
                />
              </div>
            </div>

            {/* Balance Top-up Section */}
            <div className="pt-1">
              <label className="block text-[11px] font-medium text-[#8B949E] mb-1">
                Balance Top-Up / Instant Deposit (USD)
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <DollarSign className="w-3.5 h-3.5 text-[#8B949E] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="100"
                    value={topUpInput}
                    onChange={(e) => setTopUpInput(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-[#0D1117] border border-[#21262D] rounded-xl text-[13px] font-mono text-[#E6EDF3] focus:outline-none focus:border-[#2962FF]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleBalanceTopUp(parseFloat(topUpInput) || 0)}
                  className="px-3.5 py-2 rounded-xl bg-[#089981] text-white text-[13px] font-semibold active:opacity-85 shrink-0"
                >
                  + Deposit
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                {[500, 1000, 10000, 50000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleBalanceTopUp(preset)}
                    className="flex-1 py-1 rounded-lg bg-[#0D1117] border border-[#21262D] text-[11px] font-mono font-medium text-[#2962FF] active:bg-[#21262D]"
                  >
                    +${preset.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Twelve Data WebSocket API Key Input */}
            <div className="pt-1">
              <label className="block text-[11px] font-medium text-[#8B949E] mb-1">
                Twelve Data WebSocket API Key (Optional — Simulator Active by Default)
              </label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Enter Twelve Data API key for live WebSocket..."
                className="w-full px-3 py-2 bg-[#0D1117] border border-[#21262D] rounded-xl text-[13px] font-mono text-[#E6EDF3] placeholder-[#8B949E]/60 focus:outline-none focus:border-[#2962FF]"
              />
            </div>

            <button
              type="submit"
              className="w-full h-10 rounded-xl bg-[#2962FF] text-white text-[14px] font-semibold active:opacity-90 transition-opacity"
            >
              Save Settings
            </button>
          </form>
        </div>

        {/* Authentic MT5 iOS Menu Rows Group 1 (Screenshots 2 & 4) */}
        <div className="bg-[#161B22] border-y border-[#21262D] divide-y divide-[#21262D]">
          <button
            onClick={() => setSubView('accounts')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#21262D]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#22C55E] flex items-center justify-center text-white">
                <UserPlus className="w-4 h-4" />
              </div>
              <span className="text-[15px] font-medium text-[#E6EDF3]">
                New Account / Switch Account
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8B949E]" />
          </button>

          <button
            onClick={() => setSubView('mailbox')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#21262D]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#38BDF8] flex items-center justify-center text-white shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-[15px] font-medium text-[#E6EDF3]">Mailbox</div>
                <div className="text-[12px] text-[#8B949E] truncate max-w-[230px]">
                  You have registered a new account - {activeAccount.company}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8B949E] shrink-0" />
          </button>

          <button
            onClick={() => showToast('Financial News Feed is up to date')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#21262D]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F59E0B] flex items-center justify-center text-white">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="text-[15px] font-medium text-[#E6EDF3]">News</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8B949E]" />
          </button>

          <button
            onClick={() => showToast('Tradays Economic Calendar synced')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#21262D]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#EF4444] flex items-center justify-center text-white">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-[15px] font-medium text-[#E6EDF3]">Tradays</div>
                <div className="text-[12px] text-[#8B949E]">Economic calendar</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8B949E]" />
          </button>
        </div>

        {/* Authentic MT5 iOS Menu Rows Group 2 */}
        <div className="bg-[#161B22] border-y border-[#21262D] divide-y divide-[#21262D]">
          <button
            onClick={() => showToast('MQL5.community connected')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#21262D]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#3B82F6] flex items-center justify-center text-white relative">
                <MessageSquare className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#F23645] text-[10px] font-bold flex items-center justify-center">
                  1
                </span>
              </div>
              <div className="text-left">
                <div className="text-[15px] font-medium text-[#E6EDF3]">
                  Chat and Messages
                </div>
                <div className="text-[12px] text-[#8B949E]">
                  Sign in to MQL5.community!
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8B949E]" />
          </button>

          <button
            onClick={() => showToast('MQL5 Traders Community')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#21262D]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#1D4ED8] flex items-center justify-center text-white font-bold text-[10px]">
                MQL5
              </div>
              <span className="text-[15px] font-medium text-[#E6EDF3]">
                Traders Community
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8B949E]" />
          </button>

          <button
            onClick={() => showToast('MQL5 Algo Trading Active')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#21262D]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#0EA5E9] flex items-center justify-center text-white">
                <Send className="w-4 h-4" />
              </div>
              <span className="text-[15px] font-medium text-[#E6EDF3]">
                MQL5 Algo Trading
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8B949E]" />
          </button>
        </div>

        {/* Authentic MT5 iOS Menu Rows Group 3 */}
        <div className="bg-[#161B22] border-y border-[#21262D] divide-y divide-[#21262D]">
          <button
            onClick={() =>
              showToast(`OTP Code: ${Math.floor(100000 + Math.random() * 900000)}`)
            }
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#21262D]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#22C55E] flex items-center justify-center text-white">
                <KeyRound className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-[15px] font-medium text-[#E6EDF3]">OTP</div>
                <div className="text-[12px] text-[#8B949E]">
                  One-time password generator
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8B949E]" />
          </button>

          <button
            onClick={() => showToast('Language: English (iOS Native)')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#21262D]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#2962FF] flex items-center justify-center text-white">
                <Languages className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-[15px] font-medium text-[#E6EDF3]">
                  Interface
                </div>
                <div className="text-[12px] text-[#8B949E]">English</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8B949E]" />
          </button>

          <button
            onClick={() => showToast('Candlestick OHLC + Moving Averages active')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#21262D]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#0284C7] flex items-center justify-center text-white">
                <BarChart2 className="w-4 h-4" />
              </div>
              <span className="text-[15px] font-medium text-[#E6EDF3]">Charts</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8B949E]" />
          </button>

          <button
            onClick={() => setSubView('journal')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#21262D]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#64748B] flex items-center justify-center text-white">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-[15px] font-medium text-[#E6EDF3]">Journal</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8B949E]" />
          </button>

          <button
            onClick={() => showToast('MetaTrader 5 iOS Build 4650')}
            className="w-full px-4 py-2.5 flex items-center justify-between active:bg-[#21262D]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#089981] flex items-center justify-center text-white">
                <Globe className="w-4 h-4" />
              </div>
              <span className="text-[15px] font-medium text-[#E6EDF3]">
                About MetaTrader 5
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8B949E]" />
          </button>
        </div>
      </div>
    </div>
  );
};
