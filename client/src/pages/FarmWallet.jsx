import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Coins, TrendingUp, Warehouse, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { COLORS, GRAIN_ICONS, unitPlural, fmtBRL } from "../theme";
import { ErrorBanner } from "../components/Shared";
import { api } from "../api";

function timeShort(dateStr) {
  return new Date(dateStr).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function FarmWallet() {
  const [transactions, setTransactions] = useState([]);
  const [totalVendido, setTotalVendido] = useState(0);
  const [totalRecebido, setTotalRecebido] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todos");

  useEffect(() => {
    api.farmTransactions()
      .then((data) => {
        setTransactions(data.transactions);
        setTotalVendido(data.totalVendido);
        setTotalRecebido(data.totalRecebido);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const talhõesVendendo = new Set(transactions.filter((t) => t.type === "compra_cota").map((t) => t.plot_nome)).size;

  const filtered = transactions.filter((t) => {
    if (filter === "vendas") return t.type === "compra_cota";
    if (filter === "recebimentos") return t.type === "repasse_fazenda";
    return true;
  });

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, color: COLORS.soil, margin: "0 0 4px" }}>Carteira da fazenda</h1>
      <p style={{ fontSize: 13.5, color: COLORS.soilLight, margin: "0 0 20px" }}>Acompanhe as vendas de cotas dos seus talhões e os repasses de comissão recebidos.</p>

      <ErrorBanner message={error} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        <Stat label="Total vendido" value={fmtBRL(totalVendido)} icon={Coins} />
        <Stat label="Total recebido (comissão)" value={fmtBRL(totalRecebido)} icon={TrendingUp} />
        <Stat label="Talhões com vendas" value={talhõesVendendo} icon={Warehouse} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { id: "todos", label: "Tudo" },
          { id: "vendas", label: "Vendas de cotas" },
          { id: "recebimentos", label: "Recebimentos" },
        ].map((opt) => (
          <button key={opt.id} onClick={() => setFilter(opt.id)} style={{
            padding: "7px 14px", borderRadius: 20, fontSize: 12.5, cursor: "pointer", fontWeight: 600,
            border: `1px solid ${filter === opt.id ? COLORS.leaf : COLORS.line}`,
            background: filter === opt.id ? COLORS.leaf : "#fff",
            color: filter === opt.id ? "#fff" : COLORS.soilLight,
          }}>{opt.label}</button>
        ))}
      </div>

      {loading && <p style={{ fontSize: 13, color: COLORS.soilLight }}>Carregando...</p>}
      {!loading && filtered.length === 0 && (
        <p style={{ fontSize: 13, color: COLORS.soilLight }}>Nenhuma movimentação por aqui ainda.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((t) => {
          const isVenda = t.type === "compra_cota";
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "14px 16px", flexWrap: "wrap" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 6px rgba(58,46,34,0.08)" }}>
                {t.grao ? (
                  <img src={GRAIN_ICONS[t.grao]} alt={t.grao} style={{ width: 26, height: 26, objectFit: "contain" }} />
                ) : isVenda ? (
                  <ArrowDownCircle size={18} color={COLORS.leaf} />
                ) : (
                  <ArrowUpCircle size={18} color={COLORS.orange} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.soil, margin: 0 }}>
                  {isVenda ? `Venda de ${unitPlural(t.unidade, 1)} · ${t.plot_nome}` : `Repasse de comissão · ${t.plot_nome}`}
                </p>
                <p style={{ fontSize: 12, color: COLORS.soilLight, margin: "2px 0 0" }}>
                  {isVenda && t.investidor_nome ? `Comprado por ${t.investidor_nome} · ` : ""}{timeShort(t.created_at)}
                </p>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: isVenda ? COLORS.leaf : COLORS.orange, margin: 0, whiteSpace: "nowrap" }}>
                +{fmtBRL(t.amount)}
              </p>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11.5, color: COLORS.soilLight, marginTop: 20, textAlign: "center" }}>
        Precisa configurar onde recebe? <Link to="/perfil" style={{ color: COLORS.orange, fontWeight: 600 }}>Atualize seus dados de recebimento no perfil</Link>
      </p>
    </div>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.soilLight, marginBottom: 8 }}>
        <Icon size={15} /><span style={{ fontSize: 12 }}>{label}</span>
      </div>
      <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 600, color: COLORS.soil, margin: 0 }}>{value}</p>
    </div>
  );
}
