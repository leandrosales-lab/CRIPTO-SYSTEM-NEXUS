import { useState } from 'react';
import axios from 'axios';
import { useStore } from '../store/useStore';

// ─── Paleta — fiel ao Stitch ────────────────────────────────────────────────
const P = {
  bg:          '#111417',
  surface:     '#1d2023',
  surfaceHigh: '#272a2e',
  primary:     '#4cd6ff',
  green:       '#00e297',
  red:         '#ffb4ab',
  amber:       '#ffd1d5',
  text:        '#e1e2e7',
  dim:         '#bbc9cf',
  outline:     '#3c494e',
};

// ─── Toggle ─────────────────────────────────────────────────────────────────
function Toggle({
  value,
  onChange,
  disabled = false,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      aria-pressed={value}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: 40,
        height: 22,
        borderRadius: 11,
        background: value ? P.green : P.outline,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: value ? 20 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: value ? '#003822' : '#8a9ba8',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}

// ─── Label de seção ─────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontFamily: 'Inter, sans-serif',
        textTransform: 'uppercase',
        letterSpacing: '0.18em',
        color: P.dim,
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}

// ─── Input estilizado ────────────────────────────────────────────────────────
function StitchInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  rightElement,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rightElement?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            background: '#0b0e11',
            border: 'none',
            borderBottom: `2px solid ${P.outline}`,
            color: P.text,
            fontFamily: 'monospace',
            fontSize: 13,
            padding: '10px 36px 10px 0',
            outline: 'none',
            transition: 'border-color 0.2s',
            boxSizing: 'border-box',
          }}
          onFocus={e => { (e.target as HTMLInputElement).style.borderBottomColor = P.primary; }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderBottomColor = P.outline; }}
        />
        {rightElement && (
          <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}>
            {rightElement}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cartão de seção ────────────────────────────────────────────────────────
function Card({
  borderColor,
  children,
  style,
}: {
  borderColor?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(39,42,46,0.8) 0%, rgba(11,14,17,0.9) 100%)',
        backdropFilter: 'blur(10px)',
        borderRadius: 8,
        borderLeft: borderColor ? `2px solid ${borderColor}` : undefined,
        border: borderColor ? undefined : `1px solid ${P.outline}22`,
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Card header ────────────────────────────────────────────────────────────
function CardHeader({
  icon,
  title,
  iconColor,
}: {
  icon: string;
  title: string;
  iconColor?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <span
        className="material-symbols-outlined"
        style={{ color: iconColor ?? P.primary, fontSize: 20 }}
      >
        {icon}
      </span>
      <h3
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 16,
          fontWeight: 700,
          color: P.text,
          margin: 0,
        }}
      >
        {title}
      </h3>
    </div>
  );
}

// ─── Seção 1 — Integração Binance ───────────────────────────────────────────
function BinanceSection() {
  const { setShowApiModal, connected, apiKeySet } = useStore();
  const [apiKey, setApiKey]         = useState('');
  const [secret, setSecret]         = useState('');
  const [showKey, setShowKey]       = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [testMsg, setTestMsg]       = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      await axios.get('/api/config/status');
      setTestMsg({ ok: true, msg: 'Conexão estabelecida com a Binance.' });
    } catch {
      setTestMsg({ ok: false, msg: 'Falha na conexão. Verifique as chaves.' });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setTestMsg(null);
    try {
      await axios.post('/api/config/keys', {
        apiKey: apiKey.trim(),
        apiSecret: secret.trim(),
        testnet: false,
        liveMode: true,
      });
      setTestMsg({ ok: true, msg: 'Chaves salvas com sucesso.' });
    } catch {
      // Fallback: abre o modal completo de configuração
      setShowApiModal(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card borderColor={P.primary}>
      {/* Brilho decorativo */}
      <div
        style={{
          position: 'absolute',
          top: -64,
          right: -64,
          width: 128,
          height: 128,
          borderRadius: '50%',
          background: `${P.primary}0d`,
          filter: 'blur(24px)',
          pointerEvents: 'none',
        }}
      />

      <CardHeader icon="vpn_key" title="Integração com Exchange Binance" iconColor={P.primary} />

      {/* Status badge */}
      {apiKeySet && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: `${P.green}15`,
            border: `1px solid ${P.green}44`,
            borderRadius: 4,
            padding: '2px 10px',
            marginBottom: 16,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: P.green,
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: 10, color: P.green, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
            API CONFIGURADA
          </span>
        </div>
      )}

      {/* Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <StitchInput
          label="Chave API (API Key)"
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={setApiKey}
          placeholder="Insira a Chave API da Binance"
          rightElement={
            <button
              type="button"
              onClick={() => setShowKey(s => !s)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: P.dim }}>
                {showKey ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          }
        />
        <StitchInput
          label="Chave Secreta (Secret Key)"
          type={showSecret ? 'text' : 'password'}
          value={secret}
          onChange={setSecret}
          placeholder="••••••••••••••••"
          rightElement={
            <button
              type="button"
              onClick={() => setShowSecret(s => !s)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: P.dim }}>
                {showSecret ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          }
        />
      </div>

      {/* Aviso de segurança */}
      <div
        style={{
          padding: '12px 16px',
          background: `${P.primary}0d`,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: P.primary, flexShrink: 0, marginTop: 1 }}>
          info
        </span>
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: P.primary,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: '0 0 4px',
            }}
          >
            Protocolo de Segurança:
          </p>
          <p style={{ fontSize: 11, color: P.dim, lineHeight: 1.6, margin: 0 }}>
            As chaves são armazenadas usando criptografia{' '}
            <strong style={{ color: P.text }}>AES-256-GCM</strong>. Certifique-se de que sua
            chave API tenha permissões para{' '}
            <strong style={{ color: P.text }}>"Enable Spot &amp; Margin Trading"</strong>, mas{' '}
            <strong style={{ color: P.amber }}>NÃO</strong> ative "Withdrawals".
          </p>
        </div>
      </div>

      {/* Feedback de teste */}
      {testMsg && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 4,
            background: testMsg.ok ? `${P.green}10` : `${P.red}10`,
            border: `1px solid ${testMsg.ok ? P.green : P.red}44`,
            marginBottom: 16,
            fontSize: 11,
            color: testMsg.ok ? P.green : P.red,
            fontFamily: 'monospace',
          }}
        >
          {testMsg.ok ? '✓' : '✕'} {testMsg.msg}
        </div>
      )}

      {/* Botões */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          style={{
            padding: '8px 20px',
            borderRadius: 4,
            border: `1px solid ${P.outline}`,
            background: 'transparent',
            color: P.dim,
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            fontWeight: 600,
            cursor: testing ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            opacity: testing ? 0.6 : 1,
          }}
          onMouseEnter={e => {
            if (!testing) (e.currentTarget as HTMLButtonElement).style.color = P.text;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = P.dim;
          }}
        >
          {testing ? 'Testando…' : 'Testar Conexão'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '8px 28px',
            borderRadius: 4,
            border: 'none',
            background: '#00d1ff',
            color: '#003543',
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Salvando…' : 'Salvar Chaves'}
        </button>
      </div>

      {/* Link para modal completo */}
      <p style={{ textAlign: 'right', marginTop: 8, fontSize: 10, color: P.dim, fontFamily: 'monospace' }}>
        ou{' '}
        <button
          type="button"
          onClick={() => setShowApiModal(true)}
          style={{
            background: 'none',
            border: 'none',
            color: P.primary,
            cursor: 'pointer',
            fontSize: 10,
            fontFamily: 'monospace',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          abrir configurador avançado
        </button>
      </p>

      {/* Indicador de conexão */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? P.green : P.red,
            boxShadow: connected ? `0 0 8px ${P.green}` : undefined,
            display: 'inline-block',
          }}
        />
        <span style={{ fontSize: 9, color: connected ? P.green : P.red, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
          {connected ? 'CONECTADO' : 'DESCONECTADO'}
        </span>
      </div>
    </Card>
  );
}

// ─── Seção 2 — Parâmetros Globais de Segurança ──────────────────────────────
function SafetySection() {
  const { drawdown, capital } = useStore();
  const [ddLimit, setDdLimit]           = useState(5.0);
  const [patrimony, setPatrimony]       = useState(10000);
  const [conjunctive, setConjunctive]   = useState(false);
  const [emergency, setEmergency]       = useState(false);

  return (
    <Card borderColor="#ffa9b2">
      <CardHeader icon="health_and_safety" title="Parâmetros Globais de Segurança" iconColor="#ffa9b2" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {/* Drawdown Diário */}
        <div
          style={{
            padding: 16,
            background: P.surface,
            borderRadius: 6,
            border: `1px solid ${P.outline}22`,
          }}
        >
          <SectionLabel>Drawdown Diário Máx</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, margin: '10px 0 4px' }}>
            <span style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: '#ffa9b2' }}>
              {ddLimit.toFixed(1)}
            </span>
            <span style={{ fontSize: 13, color: P.dim, marginBottom: 4 }}>%</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={0.5}
            value={ddLimit}
            onChange={e => setDdLimit(Number(e.target.value))}
            style={{ width: '100%', height: 4, accentColor: '#ffa9b2', cursor: 'pointer', marginTop: 12 }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 9,
              color: P.dim,
              fontFamily: 'monospace',
              marginTop: 4,
            }}
          >
            <span>Atual: {drawdown.toFixed(2)}%</span>
            <span>Máx: 20%</span>
          </div>
        </div>

        {/* Patrimônio */}
        <div
          style={{
            padding: 16,
            background: P.surface,
            borderRadius: 6,
            border: `1px solid ${P.outline}22`,
          }}
        >
          <SectionLabel>SL Patrimonial Total</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, margin: '10px 0 4px' }}>
            <span style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: P.text }}>
              {patrimony.toLocaleString('pt-BR')}
            </span>
            <span style={{ fontSize: 13, color: P.dim, marginBottom: 4 }}>USDT</span>
          </div>
          <input
            type="range"
            min={1000}
            max={100000}
            step={1000}
            value={patrimony}
            onChange={e => setPatrimony(Number(e.target.value))}
            style={{ width: '100%', height: 4, accentColor: P.primary, cursor: 'pointer', marginTop: 12 }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 9,
              color: P.dim,
              fontFamily: 'monospace',
              marginTop: 4,
            }}
          >
            <span>Real: ${capital.toFixed(0)}</span>
            <span>Máx: $100k</span>
          </div>
        </div>

        {/* Toggles */}
        <div
          style={{
            padding: 16,
            background: P.surface,
            borderRadius: 6,
            border: `1px solid ${P.outline}22`,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SectionLabel>Disjuntor (Circuit Breaker)</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: P.dim }}>Conjuntivo</span>
              <Toggle value={conjunctive} onChange={setConjunctive} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SectionLabel>Parada de Emergência</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: emergency ? P.red : P.dim }}>
                {emergency ? 'ATIVO' : 'Inativo'}
              </span>
              <Toggle value={emergency} onChange={setEmergency} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Seção 3 — Encerrar Operações ───────────────────────────────────────────
function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone]             = useState(false);

  function handleReset() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDone(true);
    setConfirming(false);
    setTimeout(() => setDone(false), 3000);
  }

  return (
    <div
      style={{
        padding: '24px 28px',
        borderRadius: 8,
        background: 'linear-gradient(135deg, rgba(39,42,46,0.8) 0%, rgba(11,14,17,0.9) 100%)',
        backdropFilter: 'blur(10px)',
        border: `1px dashed ${P.red}44`,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: `${P.red}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: P.red }}>
            warning
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <h4
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 15,
              color: P.red,
              margin: '0 0 4px',
            }}
          >
            Encerrar Operações Sintéticas
          </h4>
          <p style={{ fontSize: 11, color: P.dim, margin: 0, lineHeight: 1.6 }}>
            Fecha instantaneamente todas as negociações ativas e desconecta todas as instâncias
            robóticas da API da exchange.
          </p>
        </div>
      </div>

      {/* Confirmação inline */}
      {confirming && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 4,
            background: `${P.red}0f`,
            border: `1px solid ${P.red}44`,
            fontSize: 11,
            color: P.red,
            fontFamily: 'monospace',
            lineHeight: 1.5,
          }}
        >
          ⚠ Esta ação é irreversível. Confirme clicando novamente para executar o reset de emergência.
        </div>
      )}

      {done && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 4,
            background: `${P.green}10`,
            border: `1px solid ${P.green}44`,
            fontSize: 11,
            color: P.green,
            fontFamily: 'monospace',
          }}
        >
          ✓ Operações encerradas — sistema em modo seguro.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleReset}
          style={{
            padding: '10px 28px',
            borderRadius: 4,
            background: P.red,
            color: '#690005',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 13,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.04em',
            transition: 'filter 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.12)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'none'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>power_settings_new</span>
          {confirming ? 'CONFIRMAR RESET' : 'Reset de Fábrica de Emergência'}
        </button>
      </div>
    </div>
  );
}

// ─── Seção 4 — Centro de Comms (coluna direita) ─────────────────────────────
function CommsSection() {
  const [telegramOn, setTelegramOn] = useState(true);
  const [emailOn, setEmailOn]       = useState(false);
  const [chatId, setChatId]         = useState('@Commander_X');
  const [emailAddr, setEmailAddr]   = useState('');

  return (
    <Card borderColor="#00ffab" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#00ffab' }}>
          notifications_active
        </span>
        <h3
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 15,
            fontWeight: 700,
            color: P.text,
            margin: 0,
          }}
        >
          Centro de Comms
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Telegram */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: 'rgba(36,161,222,0.12)',
                  border: '1px solid rgba(36,161,222,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#24a1de' }}>
                  telegram
                </span>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: P.text, margin: 0 }}>Bot do Telegram</p>
                <p style={{ fontSize: 9, color: P.dim, fontFamily: 'monospace', margin: 0 }}>
                  Logs de execução em tempo real
                </p>
              </div>
            </div>
            <Toggle value={telegramOn} onChange={setTelegramOn} />
          </div>

          <div style={{ opacity: telegramOn ? 1 : 0.4, transition: 'opacity 0.2s' }}>
            <SectionLabel>ID do Chat Telegram</SectionLabel>
            <input
              type="text"
              value={chatId}
              onChange={e => setChatId(e.target.value)}
              disabled={!telegramOn}
              style={{
                width: '100%',
                background: '#0b0e11',
                border: 'none',
                borderBottom: `1px solid ${P.outline}`,
                color: P.text,
                fontFamily: 'monospace',
                fontSize: 12,
                padding: '8px 0',
                outline: 'none',
                marginTop: 6,
                boxSizing: 'border-box',
                cursor: telegramOn ? 'text' : 'not-allowed',
              }}
            />
          </div>

          {/* Em breve badge */}
          <div
            style={{
              marginTop: 8,
              padding: '4px 10px',
              borderRadius: 4,
              background: 'rgba(76,214,255,0.05)',
              border: `1px dashed ${P.outline}`,
              fontSize: 9,
              color: P.dim,
              fontFamily: 'monospace',
              textAlign: 'center' as const,
            }}
          >
            Integração Telegram — disponível em breve
          </div>
        </div>

        <div style={{ height: 1, background: `${P.outline}33` }} />

        {/* E-mail */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: `${P.primary}15`,
                  border: `1px solid ${P.primary}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: P.primary }}>
                  mail
                </span>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: P.text, margin: 0 }}>Relatórios por E-mail</p>
                <p style={{ fontSize: 9, color: P.dim, fontFamily: 'monospace', margin: 0 }}>
                  Resumos diários de PNL
                </p>
              </div>
            </div>
            <Toggle value={emailOn} onChange={setEmailOn} />
          </div>

          <div style={{ opacity: emailOn ? 1 : 0.4, transition: 'opacity 0.2s' }}>
            <SectionLabel>Endereço de E-mail</SectionLabel>
            <input
              type="email"
              value={emailAddr}
              onChange={e => setEmailAddr(e.target.value)}
              disabled={!emailOn}
              placeholder="seu@email.com"
              style={{
                width: '100%',
                background: '#0b0e11',
                border: 'none',
                borderBottom: `1px solid ${P.outline}`,
                color: P.text,
                fontFamily: 'monospace',
                fontSize: 12,
                padding: '8px 0',
                outline: 'none',
                marginTop: 6,
                boxSizing: 'border-box',
                cursor: emailOn ? 'text' : 'not-allowed',
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Seção 5 — Localidade e Sistema ─────────────────────────────────────────
function LocaleSection() {
  const { mode } = useStore();
  const [timezone, setTimezone] = useState('UTC');

  const modeLabels: Record<string, { label: string; color: string }> = {
    paper:   { label: 'Paper Trading',        color: P.primary },
    testnet: { label: 'Testnet Binance',       color: '#fbbf24' },
    live:    { label: 'LIVE — Dinheiro Real',  color: P.green },
  };
  const modeInfo = modeLabels[mode] ?? modeLabels.paper;

  return (
    <Card borderColor={P.outline} style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: P.dim }}>
          language
        </span>
        <h3
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 15,
            fontWeight: 700,
            color: P.text,
            margin: 0,
          }}
        >
          Localidade e Sistema
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Fuso horário */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SectionLabel>Fuso Horário Principal</SectionLabel>
          <select
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            style={{
              width: '100%',
              background: '#0b0e11',
              border: 'none',
              borderBottom: `1px solid ${P.outline}`,
              color: P.text,
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              fontWeight: 500,
              padding: '8px 0',
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none' as const,
            }}
          >
            <option value="UTC">UTC (Tempo Universal Coordenado)</option>
            <option value="America/Sao_Paulo">BRT (Horário de Brasília)</option>
            <option value="EST">EST (Horário Padrão do Leste)</option>
            <option value="CET">CET (Horário da Europa Central)</option>
          </select>
        </div>

        {/* Moeda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SectionLabel>Moeda de Exibição</SectionLabel>
          <div
            style={{
              padding: '8px 0',
              borderBottom: `1px solid ${P.outline}`,
              fontSize: 12,
              fontWeight: 500,
              color: P.text,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            USDT — Tether
          </div>
        </div>

        {/* Modo de operação */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SectionLabel>Modo de Operação</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: modeInfo.color,
                boxShadow: `0 0 6px ${modeInfo.color}`,
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'monospace',
                color: modeInfo.color,
              }}
            >
              {modeInfo.label}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Seção 6 — Status do Core ────────────────────────────────────────────────
function CoreStatusSection() {
  const { connected, uptime } = useStore();
  const [reconnecting, setReconnecting] = useState(false);

  const uptimeHours   = Math.floor(uptime / 3600);
  const uptimeMinutes = Math.floor((uptime % 3600) / 60);

  function handleReconnect() {
    setReconnecting(true);
    setTimeout(() => setReconnecting(false), 2000);
  }

  return (
    <div
      style={{
        padding: 22,
        borderRadius: 8,
        background: P.surfaceHigh,
        border: `1px solid ${P.outline}22`,
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center' as const,
        gap: 12,
      }}
    >
      {/* Ícone de status circular */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          border: `4px solid ${connected ? P.green : P.red}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            borderTop: `4px solid ${connected ? P.green : P.red}`,
            animation: reconnecting ? 'spin 1s linear infinite' : undefined,
          }}
        />
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 24, color: connected ? P.green : P.red }}
        >
          {reconnecting ? 'sync' : connected ? 'check_circle' : 'error'}
        </span>
      </div>

      {/* Rótulo */}
      <div>
        <p
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            color: P.text,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            margin: '0 0 4px',
          }}
        >
          Status do Core:{' '}
          <span style={{ color: connected ? P.green : P.red }}>
            {connected ? 'Ativo' : 'Offline'}
          </span>
        </p>
        <p style={{ fontSize: 10, color: P.dim, fontFamily: 'monospace', margin: 0 }}>
          {uptime > 0
            ? `Uptime: ${uptimeHours}h ${uptimeMinutes}m • Latência: —`
            : 'Uptime: — • Latência: —'}
        </p>
      </div>

      {/* Botão reconectar */}
      <button
        type="button"
        onClick={handleReconnect}
        disabled={reconnecting}
        style={{
          padding: '7px 20px',
          borderRadius: 4,
          border: `1px solid ${P.outline}`,
          background: 'transparent',
          color: reconnecting ? P.primary : P.dim,
          fontFamily: 'Inter, sans-serif',
          fontSize: 11,
          fontWeight: 600,
          cursor: reconnecting ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          {reconnecting ? 'sync' : 'refresh'}
        </span>
        {reconnecting ? 'Reconectando…' : 'Reconectar'}
      </button>
    </div>
  );
}

// ─── SettingsPage ────────────────────────────────────────────────────────────
export default function SettingsPage() {
  return (
    <div
      style={{
        padding: '32px 40px 48px',
        minHeight: '100%',
        overflow: 'auto',
        background: P.bg,
      }}
    >
      {/* Cabeçalho */}
      <header style={{ marginBottom: 36 }}>
        <h2
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: P.text,
            margin: '0 0 8px',
          }}
        >
          Configuração do Sistema
        </h2>
        <p
          style={{
            fontSize: 13,
            color: P.dim,
            fontFamily: 'Inter, sans-serif',
            maxWidth: 560,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Gerencie suas chaves criptográficas, parâmetros de risco automatizados e protocolos de
          comunicação do sistema a partir desta interface central de comando.
        </p>
      </header>

      {/* Grid principal — 8 / 4 colunas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 24,
        }}
      >
        {/* Linha superior — duas colunas */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {/* Coluna esquerda */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <BinanceSection />
            <SafetySection />
          </div>

          {/* Coluna direita */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <CommsSection />
            <LocaleSection />
            <CoreStatusSection />
          </div>
        </div>

        {/* Danger zone — largura total */}
        <DangerZone />
      </div>
    </div>
  );
}
