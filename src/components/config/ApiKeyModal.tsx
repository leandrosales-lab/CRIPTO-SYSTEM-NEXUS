import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store/useStore';
import axios from 'axios';

type Mode = 'paper' | 'testnet' | 'live';

interface ConfigStatus {
  hasKeys: boolean;
  liveMode: boolean;
  testnet: boolean;
  paperMode: boolean;
  maskedKey: string | null;
  mode: Mode;
}

interface AccountInfo {
  totalWalletBalance?: string;
  availableBalance?: string;
  totalUnrealizedProfit?: string;
  totalMarginBalance?: string;
}

export default function ApiKeyModal() {
  const { setShowApiModal, setApiKeySet, addAlert } = useStore();
  const [apiKey, setApiKey]     = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [mode, setMode]         = useState<Mode>('paper');
  const [loading, setLoading]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [status, setStatus]     = useState<ConfigStatus | null>(null);
  const [account, setAccount]   = useState<AccountInfo | null>(null);
  const [liveConfirmed, setLiveConfirmed] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    axios.get<ConfigStatus>('/api/config/status')
      .then(r => {
        setStatus(r.data);
        if (r.data.mode === 'live')    setMode('live');
        else if (r.data.mode === 'testnet') setMode('testnet');
        else setMode('paper');
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setError('');
    setSuccess('');

    if (mode === 'paper') {
      setApiKeySet(false);
      addAlert({ level: 'info', message: 'Modo Paper Trading ativado — ordens são simuladas' });
      setShowApiModal(false);
      return;
    }

    if (!apiKey.trim() || apiKey.trim().length < 20) {
      setError('API Key deve ter no mínimo 20 caracteres');
      return;
    }
    if (!apiSecret.trim() || apiSecret.trim().length < 20) {
      setError('API Secret deve ter no mínimo 20 caracteres');
      return;
    }
    if (mode === 'live' && !liveConfirmed) {
      setError('Confirme que entende o risco de usar conta REAL');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post<{
        success: boolean; mode: string; maskedKey: string; account: AccountInfo;
      }>('/api/config/keys', {
        apiKey:    apiKey.trim(),
        apiSecret: apiSecret.trim(),
        testnet:   mode === 'testnet',
        liveMode:  mode === 'live',
      });

      setAccount(res.data.account ?? null);
      setSuccess(`Chaves validadas — Modo: ${res.data.mode}`);
      setStatus(prev => prev ? { ...prev, hasKeys: true, maskedKey: res.data.maskedKey, mode: mode as Mode } : null);
      setApiKeySet(true);
      addAlert({ level: 'success', message: `API Binance configurada — ${res.data.mode}` });
      // Close modal after 1.5s
      setTimeout(() => setShowApiModal(false), 1500);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Erro ao validar credenciais. Verifique sua API Key e Secret.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      await axios.post('/api/config/keys/delete');
      setStatus(prev => prev ? { ...prev, hasKeys: false, maskedKey: null, mode: 'paper' } : null);
      setAccount(null);
      setMode('paper');
      setApiKey('');
      setApiSecret('');
      setApiKeySet(false);
      setSuccess('Chaves removidas — Modo Paper Trading ativado');
      addAlert({ level: 'info', message: 'Chaves API removidas — retornando ao modo paper' });
    } catch {
      setError('Erro ao remover chaves');
    } finally {
      setDeleting(false);
    }
  }

  const modeConfig = {
    paper: {
      label: 'Paper Trading',
      desc: 'Preços reais da Binance, ordens 100% simuladas. Sem risco de perda real.',
      color: 'text-neon-green',
      border: 'border-neon-green/40',
      bg: 'bg-neon-green/5',
      icon: '◎',
    },
    testnet: {
      label: 'Testnet',
      desc: 'Ambiente de teste oficial da Binance. Use chaves da Testnet.',
      color: 'text-neon-amber',
      border: 'border-neon-amber/40',
      bg: 'bg-neon-amber/5',
      icon: '◈',
    },
    live: {
      label: 'Live — Conta Real',
      desc: 'ORDENS REAIS na Binance Futures. Capital real em risco.',
      color: 'text-neon-red',
      border: 'border-neon-red/40',
      bg: 'bg-neon-red/5',
      icon: '◉',
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowApiModal(false)} />

      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="cyber-panel corner-tl relative z-10 w-[480px] max-h-[90vh] overflow-y-auto p-6 space-y-5"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-sm font-bold tracking-[0.18em] text-neon-cyan uppercase">
              Configuração de API
            </h2>
            <p className="font-mono text-[10px] text-cyber-muted mt-0.5">
              Conecte sua conta Binance Futuros
            </p>
          </div>
          {status?.hasKeys && (
            <div className="flex items-center gap-1.5 border border-neon-green/30 bg-neon-green/5 px-2 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
              <span className="font-mono text-[9px] text-neon-green uppercase tracking-wider">
                {status.maskedKey ?? 'Configurado'}
              </span>
            </div>
          )}
        </div>

        {/* Mode Selector */}
        <div>
          <div className="font-mono text-[9px] text-cyber-muted uppercase tracking-wider mb-2">Modo de Operação</div>
          <div className="grid grid-cols-3 gap-2">
            {(['paper', 'testnet', 'live'] as Mode[]).map(m => {
              const cfg = modeConfig[m];
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(''); setSuccess(''); }}
                  className={`border p-2.5 text-left transition-all ${active ? `${cfg.border} ${cfg.bg}` : 'border-cyber-border bg-black/20 hover:border-cyber-border/80'}`}
                >
                  <div className={`font-mono text-[10px] font-bold uppercase tracking-wider mb-1 ${active ? cfg.color : 'text-cyber-muted'}`}>
                    <span className="mr-1">{cfg.icon}</span>{cfg.label}
                  </div>
                  <div className="font-mono text-[8px] text-cyber-dim leading-relaxed">{cfg.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Credentials — only when testnet or live */}
        <AnimatePresence>
          {mode !== 'paper' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 overflow-hidden"
            >
              <div>
                <label className="font-mono text-[9px] text-cyber-muted uppercase tracking-wider block mb-1.5">
                  Chave API <span className="text-cyber-dim">(mín. 20 caracteres)</span>
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Cole sua API Key aqui"
                  className="w-full bg-black/40 border border-cyber-border text-cyber-bright font-mono text-xs px-3 py-2 outline-none focus:border-cyber-cyan/60 transition-all placeholder:text-cyber-muted/30"
                />
                {apiKey.length > 0 && apiKey.length < 20 && (
                  <div className="font-mono text-[9px] text-neon-amber mt-1">{apiKey.length}/20 caracteres</div>
                )}
              </div>

              <div>
                <label className="font-mono text-[9px] text-cyber-muted uppercase tracking-wider block mb-1.5">
                  API Secret <span className="text-cyber-dim">(mín. 20 caracteres)</span>
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={apiSecret}
                    onChange={e => setApiSecret(e.target.value)}
                    placeholder="Cole seu API Secret aqui"
                    className="w-full bg-black/40 border border-cyber-border text-cyber-bright font-mono text-xs px-3 py-2 pr-10 outline-none focus:border-cyber-cyan/60 transition-all placeholder:text-cyber-muted/30"
                  />
                  <button
                    onClick={() => setShowSecret(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cyber-muted hover:text-cyber-bright transition-colors font-mono text-[9px] uppercase"
                  >
                    {showSecret ? 'ocultar' : 'mostrar'}
                  </button>
                </div>
              </div>

              {/* Live warning */}
              <AnimatePresence>
                {mode === 'live' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="border border-neon-red/60 bg-neon-red/8 p-3 space-y-2"
                    style={{ background: 'rgba(255,23,68,0.06)' }}
                  >
                    <div className="font-mono text-[10px] text-neon-red font-bold uppercase tracking-wider flex items-center gap-2">
                      <span className="animate-pulse">⚠</span>
                      ATENÇÃO — MODO CONTA REAL
                    </div>
                    <div className="font-mono text-[9px] text-cyber-dim leading-relaxed">
                      As ordens serão executadas NA SUA CONTA REAL da Binance com dinheiro real.
                      O sistema pode executar trades automaticamente. Risco de perda total do capital investido.
                    </div>
                    <label className="flex items-start gap-2 cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        checked={liveConfirmed}
                        onChange={e => setLiveConfirmed(e.target.checked)}
                        className="mt-0.5 accent-red-500"
                      />
                      <span className="font-mono text-[9px] text-neon-red leading-relaxed">
                        Eu entendo que operações REAIS serão executadas e aceito o risco de perda financeira.
                      </span>
                    </label>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Account Info */}
        <AnimatePresence>
          {account && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-neon-green/30 bg-neon-green/5 p-3"
            >
              <div className="font-mono text-[9px] text-neon-green uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green" />
                Conta Validada
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {[
                  { label: 'Saldo Total',    val: account.totalWalletBalance },
                  { label: 'Disponível',     val: account.availableBalance },
                  { label: 'Margin Total',   val: account.totalMarginBalance },
                  { label: 'P&L Não Real.',  val: account.totalUnrealizedProfit },
                ].map(({ label, val }) => val !== undefined && (
                  <div key={label}>
                    <span className="font-mono text-[8px] text-cyber-muted">{label}: </span>
                    <span className="font-mono text-[9px] text-cyber-bright">
                      ${parseFloat(val ?? '0').toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feedback */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border border-cyber-red/40 bg-cyber-red/5 px-3 py-2"
            >
              <span className="font-mono text-[10px] text-neon-red">✕ {error}</span>
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border border-neon-green/40 bg-neon-green/5 px-3 py-2"
            >
              <span className="font-mono text-[10px] text-neon-green">✓ {success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Security note */}
        <div className="border border-cyber-border/40 bg-black/20 p-3">
          <div className="font-mono text-[8px] text-cyber-muted uppercase tracking-wider mb-1">Segurança</div>
          <div className="font-mono text-[8px] text-cyber-dim leading-relaxed">
            Chaves armazenadas localmente no servidor backend com obfuscação XOR. Nunca trafegam para serviços externos.
            Recomendamos restringir IP e habilitar apenas Futures Trading na chave API.
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {status?.hasKeys && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="border border-neon-red/40 bg-neon-red/5 text-neon-red font-mono text-[9px] px-3 py-2 hover:bg-neon-red/10 transition-all uppercase tracking-wider disabled:opacity-50"
            >
              {deleting ? '...' : 'Remover'}
            </button>
          )}
          <button
            onClick={() => setShowApiModal(false)}
            className="border border-cyber-border text-cyber-muted font-mono text-[10px] px-4 py-2 hover:border-cyber-border/80 transition-all uppercase tracking-wider"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading || (mode === 'live' && !liveConfirmed)}
            className={`flex-1 border font-mono text-[10px] py-2 transition-all uppercase tracking-wider disabled:opacity-40
              ${mode === 'live'
                ? 'border-neon-red/50 bg-neon-red/8 text-neon-red hover:bg-neon-red/15'
                : mode === 'testnet'
                ? 'border-neon-amber/50 bg-neon-amber/5 text-neon-amber hover:bg-neon-amber/10'
                : 'border-neon-green/50 bg-neon-green/5 text-neon-green hover:bg-neon-green/10'
              }`}
            style={mode === 'live' ? { background: 'rgba(255,23,68,0.06)' } : undefined}
          >
            {loading
              ? 'Validando...'
              : mode === 'paper'
              ? 'Usar Paper Trading'
              : 'Validar & Salvar'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
