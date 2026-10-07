import { useEffect } from "react";
import { Info } from "lucide-react";
import { TIPOS, UNIDADES, unidadeNome } from "../../config/culturas";
import { fmtBRL, fmtNumber } from "../../lib/format";
import { useCatalog } from "../../lib/catalog";
import { SelectField, TextField, Button, Banner } from "../ui";

const OUTRA = "__outra";

export function emptyCultivo(plot) {
  return {
    cultura: plot?.grao || "",
    culturaOutra: "",
    variedade: plot?.variedade || "",
    variedadeOutra: "",
    tipo_producao: plot?.tipo_producao || "lavoura",
    unidade: plot?.unidade || "",
    plantio_ate: "",
    colheita_prevista: "",
    preco: plot?.preco_venda_estimado ? String(plot.preco_venda_estimado) : "",
    cotas: plot?.cotas_totais ? String(plot.cotas_totais) : "",
    manual: false,
  };
}

export function cultivoPayload(v) {
  const outra = v.cultura === OUTRA;
  return {
    grao: outra ? v.culturaOutra.trim() : v.cultura,
    variedade: v.variedade === OUTRA || outra ? v.variedadeOutra.trim() : v.variedade,
    tipo_producao: v.tipo_producao,
    unidade: v.unidade,
    plantio_ate: v.plantio_ate,
    colheita_prevista: v.colheita_prevista,
    preco_venda_estimado: v.preco,
    cotas_totais: v.cotas,
  };
}

// Cultura → variedade (listas do catálogo, com opção de digitar), tipo de
// produção, unidade de venda, ciclo (datas) e preço/quantidade previstos.
export default function CultivoFields({ value: v, onChange, area, references = [], fasePricing }) {
  const { catalog, error } = useCatalog();
  const set = (patch) => onChange({ ...v, ...patch });

  const culturas = catalog?.culturas || [];
  const cultura = culturas.find((c) => c.nome === v.cultura) || null;
  const outra = v.cultura === OUTRA;
  // valor salvo que não está no catálogo (ex.: talhão antigo com cultura digitada)
  useEffect(() => {
    if (!catalog || !v.cultura || v.cultura === OUTRA || cultura) return;
    onChange({ ...v, culturaOutra: v.cultura, cultura: OUTRA, variedadeOutra: v.variedade, variedade: OUTRA });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  const tipo = cultura ? cultura.tipo : v.tipo_producao;
  const ciclo = TIPOS[tipo]?.ciclo || TIPOS.lavoura.ciclo;
  const unidade = v.unidade || cultura?.unidade || "saca";
  const ref = references.find((r) => r.grao === v.cultura && r.unidade === unidade);
  const automatico = !!(ref && ref.produtividade_ha > 0 && !v.manual);

  // cálculo automático: referência de mercado × produtividade × área
  useEffect(() => {
    if (!automatico) return;
    const a = Number(area);
    const patch = { preco: String(ref.preco_unidade) };
    if (a > 0) patch.cotas = String(Math.round(a * ref.produtividade_ha));
    if (patch.preco !== v.preco || (patch.cotas && patch.cotas !== v.cotas)) set(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automatico, area, v.cultura, unidade, ref?.preco_unidade]);

  // produção animal: quantidade é manual, mas o preço de referência já vem preenchido
  useEffect(() => {
    if (!ref || automatico || v.manual || v.preco) return;
    set({ preco: String(ref.preco_unidade) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref?.grao, ref?.unidade]);

  function onCultura(nome) {
    const c = culturas.find((x) => x.nome === nome);
    onChange({ ...v, cultura: nome, variedade: "", variedadeOutra: "", culturaOutra: nome === OUTRA ? v.culturaOutra : "",
      unidade: c?.unidade || v.unidade || "saca", tipo_producao: c?.tipo || v.tipo_producao, manual: false, preco: "", cotas: "" });
  }

  const grupos = [...new Set(culturas.map((c) => c.grupo))];
  const multiplicador = fasePricing?.[0] ?? 1;
  const preco = Number(v.preco) || 0;
  const qtd = Number(v.cotas) || 0;
  const uSing = unidadeNome(unidade, 1);
  const uPlural = unidadeNome(unidade, 2);

  return (
    <>
      {error && <Banner tone="error" className="span-all">Não foi possível carregar a lista de culturas: {error}</Banner>}

      <SelectField label="Cultura" value={v.cultura} onChange={onCultura} required disabled={!catalog}>
        <option value="">{catalog ? "Escolha a cultura" : "Carregando…"}</option>
        {grupos.map((g) => (
          <optgroup key={g} label={g}>
            {culturas.filter((c) => c.grupo === g).map((c) => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
          </optgroup>
        ))}
        <option value={OUTRA}>Outra (digitar)</option>
      </SelectField>

      {outra ? (
        <TextField label="Qual cultura?" value={v.culturaOutra} onChange={(x) => set({ culturaOutra: x })} required maxLength={60} placeholder="Ex.: Gergelim, Ovinos, Tilápia" />
      ) : (
        <SelectField label="Variedade" value={v.variedade} onChange={(x) => set({ variedade: x })} required disabled={!cultura}>
          <option value="">{cultura ? "Escolha a variedade" : "Escolha a cultura primeiro"}</option>
          {(cultura?.variedades || []).map((x) => <option key={x} value={x}>{x}</option>)}
          {cultura && <option value={OUTRA}>Outra (digitar)</option>}
        </SelectField>
      )}

      {(outra || v.variedade === OUTRA) && (
        <TextField label={outra ? "Variedade, raça ou tipo" : "Qual variedade?"} value={v.variedadeOutra} onChange={(x) => set({ variedadeOutra: x })} required maxLength={80} />
      )}

      {outra && (
        <SelectField label="Tipo de produção" value={v.tipo_producao} onChange={(x) => set({ tipo_producao: x })} required
          hint="Define os nomes das fases do ciclo e das validações do armazém."
          options={Object.entries(TIPOS).map(([id, t]) => ({ value: id, label: t.label }))} />
      )}

      <SelectField label="Unidade de venda" value={unidade} onChange={(x) => set({ unidade: x, manual: true })} required
        hint={cultura ? `Padrão para ${cultura.nome}: ${unidadeNome(cultura.unidade, 1)}.` : undefined}
        options={Object.keys(UNIDADES).map((u) => ({ value: u, label: unidadeNome(u, 1) }))} />

      <TextField label={ciclo.inicio} type="date" value={v.plantio_ate} onChange={(x) => set({ plantio_ate: x })} required />
      <TextField label={ciclo.fim} type="date" value={v.colheita_prevista} onChange={(x) => set({ colheita_prevista: x })} required
        min={v.plantio_ate || undefined} />

      <div className="span-all card card--well" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <p className="text-sm text-2" style={{ display: "flex", gap: 6, alignItems: "flex-start", flex: "1 1 260px" }}>
            <Info size={14} aria-hidden style={{ flexShrink: 0, marginTop: 3 }} />
            {automatico
              ? "Calculado pela referência de mercado e pela área. Ajuste se souber a produtividade real."
              : ref && ref.produtividade_ha === 0
                ? `Informe quanto pretende vender, em ${uPlural}.`
                : "Informe o preço e a quantidade prevista."}
          </p>
          {ref && ref.produtividade_ha > 0 && (
            <Button variant="ghost" size="sm" onClick={() => set({ manual: !v.manual })}>{v.manual ? "Usar cálculo automático" : "Editar manualmente"}</Button>
          )}
        </div>
        <div className="form-grid">
          <TextField label={`Preço estimado de venda por ${uSing} (R$)`} type="number" inputMode="decimal" step="any" min={0}
            value={v.preco} onChange={(x) => set({ preco: x })} required readOnly={automatico} />
          <TextField label={`Total de ${uPlural} previstos`} type="number" inputMode="numeric" min={1}
            value={v.cotas} onChange={(x) => set({ cotas: x })} required readOnly={automatico} />
        </div>
        {preco > 0 && qtd > 0 && (
          <p className="text-sm">
            Produção prevista: <strong>{fmtNumber(qtd)} {uPlural}</strong> · Preço inicial (1ª fase): <strong>{fmtBRL(preco * multiplicador)}</strong> por {uSing} · Captação inicial: <strong>{fmtBRL(preco * multiplicador * qtd)}</strong>
          </p>
        )}
      </div>
    </>
  );
}
