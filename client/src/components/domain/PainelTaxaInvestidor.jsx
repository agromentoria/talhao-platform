import { useEffect, useState } from "react";
import { Percent } from "lucide-react";
import { api } from "../../lib/api";
import { fmtPct, fmtNumber } from "../../lib/format";
import { Button, TextField, useToast } from "../ui";

// Painel da administração: degrau vigente da taxa de entrada do investidor
// (plano v9), marcos medidos e as confirmações que só a administração faz.
export default function PainelTaxaInvestidor({ editavel = true }) {
  const toast = useToast();
  const [t, setT] = useState(null);
  const [erro, setErro] = useState("");
  const [ret, setRet] = useState("");
  const [margem, setMargem] = useState(false);
  const [forcada, setForcada] = useState("");
  const [salvando, setSalvando] = useState(false);

  const aplicar = (d) => {
    setT(d);
    setRet(d.retencaoManualPct ?? "");
    setMargem(!!d.margemPositiva);
    setForcada(d.forcadaPct ?? "");
  };
  useEffect(() => { api.taxaInvestidor().then(aplicar).catch((e) => setErro(e.message)); }, []);

  async function salvar() {
    setSalvando(true); setErro("");
    try {
      const d = await api.updateTaxaInvestidor({ retencao_pct_manual: ret === "" ? null : Number(ret), margem_positiva_medida: margem, taxa_investidor_forcada_pct: forcada === "" ? null : Number(forcada) });
      aplicar(d);
      toast(`Taxa do investidor agora: ${fmtPct(d.pct, 2)}. Só vale para compras novas; as antigas ficam congeladas.`);
    } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  }

  if (!t) return erro ? <p className="text-sm text-danger">{erro}</p> : null;
  const D = t.degraus;
  return (
    <section className="card" style={{ marginBottom: 22 }} aria-labelledby="taxa-inv-t">
      <p id="taxa-inv-t" className="card-title" style={{ display: "flex", gap: 6, alignItems: "center" }}><Percent size={16} aria-hidden /> Taxa de entrada do investidor</p>
      <p className="card-desc" style={{ marginBottom: 12 }}>
        Hoje: <strong>{fmtPct(t.pct, 2)}</strong> (degrau {t.degrau || "fixado"}) · {t.motivo}. Cada compra congela a taxa do dia.
      </p>
      <dl className="kv" style={{ margin: "0 0 12px" }}>
        <div><dt>Hectares contratados (talhões com compra)</dt><dd>{fmtNumber(Math.round(t.haContratados))} ha</dd></div>
        <div><dt>Retenção de investidores (usada no cálculo)</dt><dd>{fmtPct(t.retencaoPct, 1)} <span className="text-3">(automática: {fmtPct(t.retencaoAutomaticaPct, 1)})</span></dd></div>
        <div><dt>Degraus</dt><dd>{fmtPct(D.degrau1_pct, 2)} até {fmtNumber(D.marco1_ha)} ha e retenção &gt; {D.marco1_retencao_pct}% · {fmtPct(D.degrau2_pct, 2)} até {fmtNumber(D.marco2_ha)} ha · {fmtPct(D.degrau3_pct, 2)} depois, com margem positiva medida</dd></div>
      </dl>
      {editavel && (
        <>
          <div className="form-grid">
            <TextField label="Retenção medida (%) — vazio usa a automática" type="number" inputMode="decimal" min={0} max={100} value={ret} onChange={setRet} />
            <TextField label="Fixar a taxa (%) — vazio segue os degraus" type="number" inputMode="decimal" min={0} max={5} step={0.05} value={forcada} onChange={setForcada} hint="Use só em exceção; vale para compras novas." />
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0", fontSize: 14 }}>
            <input type="checkbox" checked={margem} onChange={(e) => setMargem(e.target.checked)} />
            Margem positiva medida por talhão confirmada (libera o degrau de {fmtPct(D.degrau3_pct, 2)})
          </label>
          {erro && <p className="text-sm text-danger" role="alert">{erro}</p>}
          <Button onClick={salvar} loading={salvando}>Salvar</Button>
        </>
      )}
    </section>
  );
}
