import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Coins, TrendingUp, Warehouse } from "lucide-react";
import { fmtBRL, fmtDateTime } from "../lib/format";
import { api } from "../lib/api";
import { Page, PageHeader } from "../components/layout/Page";
import { ErrorBanner, EmptyState, FilterChips, Loading } from "../components/ui";
import { GrainThumb } from "../components/domain";
import { Stat } from "./Portfolio";

export default function FarmWallet() {
  const [transactions, setTransactions] = useState([]);
  const [totalVendido, setTotalVendido] = useState(0);
  const [totalRecebido, setTotalRecebido] = useState(0);
  const [totalArmazenagem, setTotalArmazenagem] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todos");

  useEffect(() => {
    api.farmTransactions()
      .then((data) => {
        setTransactions(data.transactions);
        setTotalVendido(data.totalVendido);
        setTotalRecebido(data.totalRecebido);
        setTotalArmazenagem(data.totalArmazenagem || 0);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const talhoesComVenda = new Set(transactions.filter((t) => t.type === "compra_cota").map((t) => t.plot_nome)).size;
  const filtered = transactions.filter((t) => {
    if (filter === "vendas") return t.type === "compra_cota";
    if (filter === "recebimentos") return t.type === "repasse_fazenda";
    if (filter === "armazenagem") return t.type === "tarifa_armazem";
    return true;
  });

  return (
    <Page title="Carteira da fazenda" width="medium">
      <PageHeader title="Carteira da fazenda" subtitle="Vendas dos seus talhões e repasses de comissão recebidos." />
      <ErrorBanner message={error} />

      <div className="grid-stats" style={{ marginBottom: 24 }}>
        <Stat label="Total vendido" value={fmtBRL(totalVendido)} icon={Coins} />
        <Stat label="Comissão recebida" value={fmtBRL(totalRecebido)} icon={TrendingUp} tone="success" />
        <Stat label="Talhões com vendas" value={talhoesComVenda} icon={Warehouse} />
        {totalArmazenagem > 0 && <Stat label="Armazenagem paga pela fazenda" value={fmtBRL(totalArmazenagem)} icon={Warehouse} />}
      </div>

      <div style={{ marginBottom: 14 }}>
        <FilterChips label="Filtrar movimentações" value={filter} onChange={setFilter}
          options={[{ id: "todos", label: "Tudo" }, { id: "vendas", label: "Vendas" }, { id: "recebimentos", label: "Recebimentos" }, { id: "armazenagem", label: "Armazenagem" }]} />
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState image="/icons/icon_fazendas.svg" title="Nenhuma movimentação ainda">
          As vendas aparecem aqui assim que um investidor comprar parte de um talhão seu.
        </EmptyState>
      ) : (
        <ul className="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {filtered.map((t) => {
            const isVenda = t.type === "compra_cota";
            if (t.type === "tarifa_armazem") {
              const fazendaPaga = t.arm_pagador === "fazenda";
              return (
                <li key={t.id} className="list-item">
                  <GrainThumb grao={t.grao} />
                  <div className="list-item-body">
                    <p className="list-item-title truncate">Armazenagem · {t.plot_nome}</p>
                    <p className="list-item-sub">{fazendaPaga ? "Paga pela fazenda" : "Descontada dos investidores"} · {fmtDateTime(t.created_at)}</p>
                  </div>
                  <p className={`money ${fazendaPaga ? "text-danger" : "text-2"}`} style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{fazendaPaga ? "−" : ""}{fmtBRL(t.amount)}</p>
                </li>
              );
            }
            return (
              <li key={t.id} className="list-item">
                <GrainThumb grao={t.grao} />
                <div className="list-item-body">
                  <p className="list-item-title truncate">{isVenda ? `Venda · ${t.plot_nome}` : `Comissão · ${t.plot_nome}`}</p>
                  <p className="list-item-sub">
                    {isVenda && t.investidor_nome ? `${t.investidor_nome} · ` : ""}{fmtDateTime(t.created_at)}
                  </p>
                </div>
                <p className={`money ${isVenda ? "text-success" : "text-primary"}`} style={{ fontWeight: 700, whiteSpace: "nowrap" }}>+{fmtBRL(t.amount)}</p>
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
