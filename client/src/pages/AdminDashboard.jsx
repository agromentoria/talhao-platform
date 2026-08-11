import { useEffect, useState } from "react";
import { Coins, Percent, Warehouse, Building2, Users, Clock } from "lucide-react";
import { COLORS, fmtBRL } from "../theme";
import { ErrorBanner } from "../components/Shared";
import { api } from "../api";

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [farms, setFarms] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function load() {
    api.overview().then(setOverview).catch((err) => setError(err.message));
    api.adminFarms().then((data) => setFarms(data.farms)).catch((err) => setError(err.message));
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id, status) {
    try {
      await api.setFarmStatus(id, status);
      setNotice(status === "aprovada" ? "Fazenda aprovada." : "Fazenda suspensa.");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, color: COLORS.soil, margin: "0 0 4px" }}>Administração do Talhão</h1>
      <p style={{ fontSize: 13.5, color: COLORS.soilLight, margin: "0 0 20px" }}>Visão geral da plataforma e aprovação de fazendas.</p>

      <ErrorBanner message={error} />
      {notice && <p style={{ fontSize: 12.5, color: COLORS.leaf, marginBottom: 14 }}>{notice}</p>}

      {overview && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 26 }}>
          <Stat label="Total captado" value={fmtBRL(overview.totalCaptado)} icon={Coins} />
          <Stat label="Comissão do app acumulada" value={fmtBRL(overview.comissaoAppAcumulada)} icon={Percent} />
          <Stat label="Talhões ativos" value={overview.talhoesAtivos} icon={Warehouse} />
          <Stat label="Fazendas aprovadas" value={overview.fazendasAtivas} icon={Building2} />
          <Stat label="Fazendas pendentes" value={overview.fazendasPendentes} icon={Clock} />
          <Stat label="Investidores" value={overview.investidores} icon={Users} />
        </div>
      )}

      <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.soil, margin: "0 0 12px" }}>Fazendas cadastradas</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {farms.map((f) => (
          <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "14px 18px", flexWrap: "wrap", gap: 10 }}>
            <div>
              <p style={{ fontWeight: 500, fontSize: 14, color: COLORS.soil, margin: 0 }}>{f.name}</p>
              <p style={{ fontSize: 12, color: COLORS.soilLight, margin: "2px 0 0" }}>{f.location} · comissão {f.commission_pct}%</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StatusBadge status={f.status} />
              {f.status !== "aprovada" && (
                <button onClick={() => setStatus(f.id, "aprovada")} style={btnStyle(COLORS.leaf)}>Aprovar</button>
              )}
              {f.status !== "suspensa" && (
                <button onClick={() => setStatus(f.id, "suspensa")} style={btnStyle(COLORS.clay)}>Suspender</button>
              )}
            </div>
          </div>
        ))}
        {farms.length === 0 && <p style={{ fontSize: 13, color: COLORS.soilLight }}>Nenhuma fazenda cadastrada ainda.</p>}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.soilLight, marginBottom: 6 }}>
        <Icon size={13} /><span style={{ fontSize: 11 }}>{label}</span>
      </div>
      <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: 19, fontWeight: 600, color: COLORS.soil, margin: 0 }}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    aprovada: { bg: "#E1F0DE", fg: COLORS.leafDark, label: "aprovada" },
    pendente: { bg: "#FBF3E1", fg: "#7A5C10", label: "pendente" },
    suspensa: { bg: "#FBEAEA", fg: COLORS.danger, label: "suspensa" },
  };
  const s = map[status] || map.pendente;
  return <span style={{ fontSize: 11.5, padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.fg, fontWeight: 500 }}>{s.label}</span>;
}

function btnStyle(bg) {
  return { padding: "7px 12px", borderRadius: 8, border: "none", background: bg, color: "#fff", fontSize: 12.5, fontWeight: 500, cursor: "pointer" };
}
