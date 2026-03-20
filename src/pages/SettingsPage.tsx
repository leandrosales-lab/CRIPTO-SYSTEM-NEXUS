import { useStore } from '../store/useStore';
import ApiKeyModal from '../components/config/ApiKeyModal';

// ─── Paleta inline ─────────────────────────────────────────────────────────────
const C = {
  bg:       '#111417',
  surface:  '#1d2023',
  surface2: '#252a2e',
  primary:  '#4cd6ff',
  green:    '#00e297',
  text:     '#e1e2e7',
  outline:  '#3c494e',
  dim:      '#8a9ba8',
  red:      '#f87171',
};

// ─── Seção genérica ────────────────────────────────────────────────────────────
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: C.surface, border: `1px solid ${C.outline}` }}
    >
      <div
        className="px-5 py-4 border-b"
        style={{ borderColor: C.outline, background: `${C.surface2}88` }}
      >
        <h2
          className="text-sm font-semibold tracking-wide"
          style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-[11px] font-mono mt-0.5" style={{ color: C.dim }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Placeholder de campo ──────────────────────────────────────────────────────
function FieldPlaceholder({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[9px] font-mono uppercase tracking-[0.18em]" style={{ color: C.dim }}>
        {label}
      </label>
      <div
        className="px-3 py-2.5 rounded-lg text-xs font-mono"
        style={{
          background: C.bg,
          border: `1px solid ${C.outline}`,
          color: value ? C.dim : C.outline,
        }}
      >
        {value ?? `— configurar no modal de API —`}
      </div>
    </div>
  );
}

// ─── Parâmetros de Risco ───────────────────────────────────────────────────────
function RiskParameters() {
  const { capital, drawdown, robots, activeTrades } = useStore();
  const activeRobots   = robots.filter(r => r.status === 'running').length;
  const totalPositions = activeTrades.length;

  return (
    <Section
      title="Parâmetros Globais de Risco"
      subtitle="Limites automáticos de proteção do portfólio — configurados no backend"
    >
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Capital Total',
            value: `$${capital.toFixed(2)} USDT`,
            color: C.text,
          },
          {
            label: 'Drawdown Atual',
            value: `${drawdown.toFixed(2)}%`,
            color: drawdown > 10 ? C.red : drawdown > 5 ? '#fbbf24' : C.green,
          },
          {
            label: 'Posições Abertas',
            value: `${totalPositions} / 20`,
            color: totalPositions > 15 ? '#fbbf24' : C.text,
          },
          {
            label: 'Robôs Ativos',
            value: `${activeRobots} / 3`,
            color: C.primary,
          },
          {
            label: 'Drawdown Máx Diário',
            value: '5.0%',
            color: C.dim,
          },
          {
            label: 'Drawdown Patrimônio',
            value: '10.000 USDT',
            color: C.dim,
          },
        ].map(item => (
          <div
            key={item.label}
            className="rounded-xl p-3"
            style={{ background: C.bg, border: `1px solid ${C.outline}` }}
          >
            <div
              className="text-[8px] font-mono uppercase tracking-widest mb-1"
              style={{ color: C.dim }}
            >
              {item.label}
            </div>
            <div
              className="text-sm font-bold font-mono tabular-nums"
              style={{ color: item.color }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Drawdown bar visual */}
      <div className="mt-4">
        <div
          className="flex justify-between text-[9px] font-mono mb-1.5"
          style={{ color: C.dim }}
        >
          <span>Drawdown — limite: 15%</span>
          <span style={{ color: drawdown > 10 ? C.red : drawdown > 5 ? '#fbbf24' : C.green }}>
            {drawdown.toFixed(2)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.outline }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min((drawdown / 15) * 100, 100)}%`,
              background: drawdown > 10 ? `linear-gradient(90deg, #be123c, ${C.red})` : drawdown > 5 ? 'linear-gradient(90deg, #92400e, #fbbf24)' : `linear-gradient(90deg, #065f46, ${C.green})`,
            }}
          />
        </div>
      </div>
    </Section>
  );
}

// ─── Seção Telegram (placeholder) ─────────────────────────────────────────────
function TelegramSection() {
  return (
    <Section
      title="Centro de Comunicações"
      subtitle="Notificações e relatórios automáticos via integrações externas"
    >
      <div className="grid grid-cols-2 gap-4">
        {/* Telegram */}
        <div
          className="rounded-xl p-4"
          style={{ background: C.bg, border: `1px solid ${C.outline}` }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                style={{ background: 'rgba(37,176,245,0.12)', border: '1px solid rgba(37,176,245,0.3)' }}
              >
                ✈
              </div>
              <div>
                <div className="text-xs font-semibold" style={{ color: C.text }}>Bot Telegram</div>
                <div className="text-[9px] font-mono" style={{ color: C.dim }}>Alertas em tempo real</div>
              </div>
            </div>
            {/* Toggle placeholder */}
            <div
              className="w-10 h-5 rounded-full relative cursor-not-allowed opacity-40"
              style={{ background: C.outline }}
              title="Em breve"
            >
              <div
                className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full"
                style={{ background: C.dim }}
              />
            </div>
          </div>
          <FieldPlaceholder label="Token do Bot" />
          <div className="mt-2">
            <FieldPlaceholder label="Chat ID" />
          </div>
          <div
            className="mt-3 text-[9px] font-mono px-2 py-1.5 rounded-lg text-center"
            style={{ background: 'rgba(76,214,255,0.05)', border: `1px dashed ${C.outline}`, color: C.dim }}
          >
            Integração Telegram — disponível em breve
          </div>
        </div>

        {/* E-mail */}
        <div
          className="rounded-xl p-4"
          style={{ background: C.bg, border: `1px solid ${C.outline}` }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}
              >
                ✉
              </div>
              <div>
                <div className="text-xs font-semibold" style={{ color: C.text }}>Relatório por E-mail</div>
                <div className="text-[9px] font-mono" style={{ color: C.dim }}>Resumo diário automático</div>
              </div>
            </div>
            <div
              className="w-10 h-5 rounded-full relative cursor-not-allowed opacity-40"
              style={{ background: C.outline }}
              title="Em breve"
            >
              <div
                className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full"
                style={{ background: C.dim }}
              />
            </div>
          </div>
          <FieldPlaceholder label="Endereço de E-mail" />
          <div
            className="mt-3 text-[9px] font-mono px-2 py-1.5 rounded-lg text-center"
            style={{ background: 'rgba(251,191,36,0.04)', border: `1px dashed ${C.outline}`, color: C.dim }}
          >
            Relatórios por E-mail — disponível em breve
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Seção Localidade ─────────────────────────────────────────────────────────
function LocaleSection() {
  const { mode } = useStore();

  const modeLabels = {
    paper:   { label: 'Paper Trading', color: C.primary },
    testnet: { label: 'Testnet Binance', color: '#fbbf24' },
    live:    { label: 'LIVE — Dinheiro Real', color: C.green },
  };

  const modeInfo = modeLabels[mode] ?? modeLabels.paper;

  return (
    <Section
      title="Localidade e Sistema"
      subtitle="Fuso horário, moeda base e modo de operação ativo"
    >
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-3" style={{ background: C.bg, border: `1px solid ${C.outline}` }}>
          <div className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: C.dim }}>
            Fuso Horário
          </div>
          <div className="text-sm font-mono font-semibold" style={{ color: C.text }}>
            UTC (Tempo Universal)
          </div>
        </div>

        <div className="rounded-xl p-3" style={{ background: C.bg, border: `1px solid ${C.outline}` }}>
          <div className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: C.dim }}>
            Moeda de Exibição
          </div>
          <div className="text-sm font-mono font-semibold" style={{ color: C.text }}>
            USDT — Tether
          </div>
        </div>

        <div className="rounded-xl p-3" style={{ background: C.bg, border: `1px solid ${C.outline}` }}>
          <div className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: C.dim }}>
            Modo de Operação
          </div>
          <div
            className="flex items-center gap-1.5 text-sm font-mono font-bold"
            style={{ color: modeInfo.color }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: modeInfo.color, boxShadow: `0 0 5px ${modeInfo.color}` }}
            />
            {modeInfo.label}
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── SettingsPage ──────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { setShowApiModal } = useStore();

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1
            className="text-xl font-bold tracking-widest mb-0.5"
            style={{ fontFamily: "'Orbitron', sans-serif", color: C.primary }}
          >
            CONFIGURAÇÕES
          </h1>
          <p className="text-xs font-mono" style={{ color: C.dim }}>
            Gerencie suas chaves criptográficas, parâmetros de risco e protocolos de comunicação
          </p>
        </div>
      </div>

      {/* Integração com Exchange Binance — abre modal existente */}
      <Section
        title="Integração com Exchange Binance"
        subtitle="Configure suas chaves de API para conectar ao sistema de trading"
      >
        <div className="flex items-start gap-4">
          <div className="flex-1 grid grid-cols-2 gap-4">
            <FieldPlaceholder label="Chave API (API KEY)" />
            <FieldPlaceholder label="Chave Secreta (SECRET KEY)" />
          </div>
          <div className="flex flex-col gap-2 pt-5 flex-shrink-0">
            <button
              onClick={() => setShowApiModal(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all"
              style={{
                background: `${C.primary}15`,
                border: `1px solid ${C.primary}40`,
                color: C.primary,
              }}
              onMouseEnter={e => {
                (e.target as HTMLButtonElement).style.background = `${C.primary}25`;
              }}
              onMouseLeave={e => {
                (e.target as HTMLButtonElement).style.background = `${C.primary}15`;
              }}
            >
              ⚙ Configurar API
            </button>
            <div
              className="text-[9px] font-mono text-center px-2 py-1 rounded"
              style={{ background: C.bg, color: C.dim, border: `1px solid ${C.outline}` }}
            >
              Clique para abrir o configurador
            </div>
          </div>
        </div>

        <div
          className="mt-4 px-3 py-3 rounded-xl"
          style={{ background: 'rgba(76,214,255,0.04)', border: `1px solid rgba(76,214,255,0.15)` }}
        >
          <div
            className="text-[9px] font-mono uppercase tracking-wider font-bold mb-1"
            style={{ color: C.primary }}
          >
            ⚠ Protocolo de Segurança
          </div>
          <div className="text-[10px] font-mono leading-relaxed" style={{ color: C.dim }}>
            As chaves são armazenadas usando o padrão AES-256-GCM. Configure as permissões
            para <strong style={{ color: C.text }}>"Futuros Spot &amp; Margin Trading"</strong> apenas.
            Nunca ative <strong style={{ color: C.text }}>"Saques"</strong>.
          </div>
        </div>
      </Section>

      {/* Parâmetros de Risco */}
      <RiskParameters />

      {/* Centro de Comunicações */}
      <TelegramSection />

      {/* Localidade */}
      <LocaleSection />

      {/* ApiKeyModal embutido — renderizado pelo App quando setShowApiModal(true) */}
    </div>
  );
}
