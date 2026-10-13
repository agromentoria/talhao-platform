import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownCircle, Receipt, Coins, TrendingUp, Warehouse, Wallet, ChevronRight } from "lucide-react";
import { fmtBRL, fmtDateTime } from "../lib/format";
import { culturaTexto } from "../config/culturas";
import { api } from "../lib/api";
import { Page, PageHeader } from "../components/layout/Page";
import { ErrorBanner, EmptyState, FilterChips, Loading, Badge } from "../components/ui";
import { GrainThumb } from "../components/domain";
import { Stat } from "./Portfolio";

const STATUS = { captacao: ["info", "Em captação"], em_andamento: ["info", "Em andamento"], aguardando_aprovacao: ["warning", "Aguardando pagamento"], pago: ["success", "Pago"], arquivado: [undefined, "Arquivado"] };

// Carteira da fazenda: quanto entrou dos investidores, quanto foi gasto na
// operação, o que a fazenda recebeu na colheita e o resultado de cada talhão.
export default function FarmWallet() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("todos");

  useEffect(() => {
    api.farmTransactions().then(setData).catch((err) => setError(err.message));
  }, []);

  if (!data) return <Page title="Carteira da fazenda" width="medium">{error ? <ErrorBanner message={error} /> : <Loading />}</Page>;

  const talhoes = data.talhoes || [];
  const captado = talhoes.reduce((s, t) => s + t.captado, 0);
  const resultado = talhoes.reduce((s, t) => s + t.resultado, 0);
  const transactions = data.transactions.filter((t) => {
    if (filter === "vendas") return t.type === "compra_cota";
    if (filter === "recebimentos") return t.type === "repasse_fazenda" || t.type === "performance_fazenda";
    if (filter === "armazenagem") return t.type === "tarifa_armazem";
    return true;
  });

  return (
    <Page title="Carteira da fazenda" width="medium">
      <PageHeader title="Carteira da fazenda" subtitle="O dinheiro dos investidores, os custos de cada safra e o que a fazenda recebeu na colheita." />
      <ErrorBanner message={error} />

      <div className="grid-stats" style={{ marginBottom: 12 }}>
        <Stat label="Recebido dos investidores" value={fmtBRL(captado)} icon={ArrowDownCircle} tone="success" />
        <Stat label="Custos lançados" value={fmtBRL(data.totalCustos || 0)} icon={Receipt} />
        <Stat label="Comissão até a meta" value={fmtBRL(data.totalRecebido)} icon={Coins} tone="success" />
        <Stat label="Performance acima da meta" value={fmtBRL(data.totalPerformance || 0)} icon={TrendingUp} tone="success" />
      </div>
      <div className="grid-stats" style={{ marginBottom: 24 }}>
        {data.totalArmazenagem > 0 && <Stat label="Armazenagem paga pela fazenda" value={fmtBRL(data.totalArmazenagem)} icon={Warehouse} />}
        <Stat label="Resultado nos talhões" value={fmtBRL(resultado)} icon={Wallet} tone="success" />
      </div>

      <h2 className="section-title" style={{ marginBottom: 6 }}>Por talhão</h2>
      <p className="text-sm text-2" style={{ marginBottom: 12 }}>
        Resultado = recebido dos investidores − custos lançados + comissão + performance − armazenagem paga pela fazenda. Toque para ver o demonstrativo e lançar custos.
      </p>
      {talhoes.length === 0 ? (
        <EmptyState image="/icons/icon_talhao_meu_talhao.svg" title="Nenhum talhão ainda">Publique um talhão para começar.</EmptyState>
      ) : (
        <ul className="list" style={{ listStyle: "none", margin: "0 0 28px", padding: 0 }}>
          {talhoes.map((t) => {
            const [tone, label] = STATUS[t.status] || [undefined, t.status];
            return (
              <li key={t.id}>
                <Link to={`/talhao/${t.id}/demonstrativo`} className="list-item" style={{ alignItems: "flex-start" }}>
                  <GrainThumb grao={t.grao} />
                  <div className="list-item-body">
                    <p className="list-item-title" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{t.nome} <Badge tone={tone}>{label}</Badge></p>
                    <p className="list-item-sub">{culturaTexto(t)} · {t.safra}</p>
                    <dl className="entity-metrics">
                      <div><dt>recebido</dt><dd>{fmtBRL(t.captado)}</dd></div>
                      <div><dt>custos{t.orcamento ? ` (de ${fmtBRL(t.orcamento)})` : ""}</dt><dd>{fmtBRL(t.custos)}</dd></div>
                      <div><dt>comissão + performance</dt><dd>{fmtBRL(t.comissao + t.performance)}</dd></div>
                      <div><dt>resultado</dt><dd className={t.resultado >= 0 ? "text-success" : "text-danger"}>{fmtBRL(t.resultado)}</dd></div>
                    </dl>
                  </div>
                  <ChevronRight size={18} aria-hidden style={{ color: "var(--text-3)", marginTop: 4 }} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="section-title" style={{ marginBottom: 12 }}>Movimentações</h2>
      <div style={{ marginBottom: 14 }}>
        <FilterChips label="Filtrar movimentações" value={filter} onChange={setFilter}
          options={[{ id: "todos", label: "Tudo" }, { id: "vendas", label: "Vendas" }, { id: "recebimentos", label: "Comissão e performance" }, { id: "armazenagem", label: "Armazenagem" }]} />
      </div>
      {transactions.length === 0 ? (
        <EmptyState image="/icons/icon_fazendas.png" title="Nenhuma movimentação ainda">As vendas aparecem aqui assim que um investidor comprar parte de um talhão seu.</EmptyState>
      ) : (
        <ul className="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {transactions.map((t) => {
            if (t.type === "tarifa_armazem") {
              const parteFazenda = Number(t.parte_fazenda_valor || 0);
              const dividido = t.arm_pagador === "dividido";
              return (
                <li key={t.id} className="list-item">
                  <GrainThumb grao={t.grao} />
                  <div className="list-item-body">
                    <p className="list-item-title truncate">Armazenagem · {t.plot_nome}</p>
                    <p className="list-item-sub">
                      {t.arm_pagador === "fazenda" ? "Paga pela fazenda" : dividido ? `Dividida: fazenda ${fmtBRL(parteFazenda)} de ${fmtBRL(t.amount)}` : "Descontada dos investidores"} · {fmtDateTime(t.created_at)}
                    </p>
                  </div>
                  <p className={`money ${parteFazenda > 0 ? "text-danger" : "text-2"}`} style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{parteFazenda > 0 ? `−${fmtBRL(parteFazenda)}` : fmtBRL(t.amount)}</p>
                </li>
              );
            }
            const titulo = t.type === "compra_cota" ? "Venda antecipada" : t.type === "performance_fazenda" ? "Performance acima da meta" : "Comissão até a meta";
            return (
              <li key={t.id} className="list-item">
                <GrainThumb grao={t.grao} />
                <div className="list-item-body">
                  <p className="list-item-title truncate">{titulo} · {t.plot_nome}</p>
                  <p className="list-item-sub">{t.type === "compra_cota" && t.investidor_nome ? `${t.investidor_nome} · ` : ""}{fmtDateTime(t.created_at)}</p>
                </div>
                <p className={`money ${t.type === "compra_cota" ? "text-success" : "text-primary"}`} style={{ fontWeight: 700, whiteSpace: "nowrap" }}>+{fmtBRL(t.amount)}</p>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-sm text-2" style={{ marginTop: 24, textAlign: "center" }}>
        Os repasses vão para a conta cadastrada em <Link to="/perfil?aba=recebimento" style={{ fontWeight: 700 }}>Perfil › Dados para recebimento</Link>.
      </p>
    </Page>
  );
}
