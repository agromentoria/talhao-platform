import { ShieldCheck, ShieldAlert, Clock, CheckCircle2, AlertTriangle, Warehouse, Star } from "lucide-react";
import { etapasDe } from "../../config/culturas";
import { fmtNumber, unitPlural, fmtDateTime } from "../../lib/format";
import { Badge } from "../ui";

// Selo exibido ao investidor: o armazém é o garantidor físico da commodity
export function GuaranteeSeal({ name, compact, estrelas }) {
  if (!name) return null;
  return (
    <span className={`seal ${compact ? "seal--compact" : ""}`} title={`Garantido por ${name}`}>
      <ShieldCheck size={compact ? 14 : 16} aria-hidden />
      <span className="truncate">{compact ? name : <>Garantido por <strong>{name}</strong></>}</span>
      {estrelas > 0 && <span aria-label={`nota ${Number(estrelas).toFixed(1)} de 5`} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
        <Star size={compact ? 11 : 13} fill="currentColor" aria-hidden />{Number(estrelas).toFixed(1)}
      </span>}
    </span>
  );
}

// Estrelas de 0 a 5 (fazendas e armazéns)
export function Stars({ value, size = 15, showValue = true }) {
  const v = Number(value) || 0;
  const full = Math.floor(v);
  const half = v - full >= 0.5;
  return (
    <span className="rating" aria-label={`Nota ${v.toFixed(1)} de 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const on = i < full || (i === full && half);
        return <Star key={i} size={size} fill={on ? "var(--brand-orange)" : "none"} color={on ? "var(--brand-orange)" : "var(--border-strong)"} aria-hidden />;
      })}
      {showValue && <span style={{ marginLeft: 3 }}>{v.toFixed(1)}</span>}
    </span>
  );
}

export function CustodyStatusBadge({ status }) {
  if (status === "aceita") return <Badge tone="success"><ShieldCheck size={13} aria-hidden /> Custódia aceita</Badge>;
  if (status === "pendente") return <Badge tone="warning"><Clock size={13} aria-hidden /> Aguardando armazém</Badge>;
  if (status === "recusada") return <Badge tone="danger"><ShieldAlert size={13} aria-hidden /> Custódia recusada</Badge>;
  return <Badge><Warehouse size={13} aria-hidden /> Sem armazém</Badge>;
}

// Linha do tempo das três validações (plantio, colheita, armazenagem).
// declared: quantidade declarada pela fazenda (para comparar com o armazenado)
export function CustodyTimeline({ validacoes = [], unidade, declared, sold, plot }) {
  const byEtapa = Object.fromEntries(validacoes.map((v) => [v.etapa, v]));
  return (
    <ol className="custody" aria-label="Validações do armazém">
      {etapasDe(plot).map((e) => {
        const v = byEtapa[e.id];
        const state = !v ? "todo" : v.resultado === "confirmado" ? "ok" : "warn";
        const Icon = state === "ok" ? CheckCircle2 : state === "warn" ? AlertTriangle : Clock;
        const qtd = v?.quantidade != null ? Number(v.quantidade) : null;
        return (
          <li key={e.id} className={`custody-step is-${state}`}>
            <span className="custody-icon"><Icon size={18} aria-hidden /></span>
            <div className="custody-body">
              <p className="custody-title">
                {e.label}
                <span className="sr-only">: </span>
                <span className="custody-state">{state === "ok" ? "confirmado" : state === "warn" ? "divergência" : "aguardando"}</span>
              </p>
              {v ? (
                <>
                  {qtd != null && (
                    <p className="text-sm">
                      {fmtNumber(qtd)} {unitPlural(unidade, qtd)}
                      {e.id === "armazenagem" && declared ? <span className="text-2"> de {fmtNumber(declared)} declaradas ({Math.round((qtd / declared) * 100)}%)</span> : null}
                    </p>
                  )}
                  {e.id === "armazenagem" && qtd != null && sold > 0 && qtd < sold && (
                    <p className="text-sm text-danger">Abaixo das {fmtNumber(sold)} {unitPlural(unidade, sold)} vendidas aos investidores.</p>
                  )}
                  {v.observacao && <p className="text-sm text-2" style={{ whiteSpace: "pre-wrap" }}>{v.observacao}</p>}
                  <p className="text-xs text-3">{fmtDateTime(v.created_at)}{v.validado_por ? ` · ${v.validado_por}` : ""}</p>
                  {v.foto && <a href={v.foto} target="_blank" rel="noreferrer"><img src={v.foto} alt={`Foto da validação de ${e.label.toLowerCase()}`} className="custody-photo" /></a>}
                </>
              ) : (
                <p className="text-sm text-2">{e.descricao}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
