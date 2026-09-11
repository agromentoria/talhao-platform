import { useEffect, useState } from "react";
import { COLORS } from "../theme";

// as 27 unidades federativas do Brasil — lista fixa, não muda
export const ESTADOS_BR = [
  { uf: "AC", nome: "Acre" }, { uf: "AL", nome: "Alagoas" }, { uf: "AP", nome: "Amapá" },
  { uf: "AM", nome: "Amazonas" }, { uf: "BA", nome: "Bahia" }, { uf: "CE", nome: "Ceará" },
  { uf: "DF", nome: "Distrito Federal" }, { uf: "ES", nome: "Espírito Santo" }, { uf: "GO", nome: "Goiás" },
  { uf: "MA", nome: "Maranhão" }, { uf: "MT", nome: "Mato Grosso" }, { uf: "MS", nome: "Mato Grosso do Sul" },
  { uf: "MG", nome: "Minas Gerais" }, { uf: "PA", nome: "Pará" }, { uf: "PB", nome: "Paraíba" },
  { uf: "PR", nome: "Paraná" }, { uf: "PE", nome: "Pernambuco" }, { uf: "PI", nome: "Piauí" },
  { uf: "RJ", nome: "Rio de Janeiro" }, { uf: "RN", nome: "Rio Grande do Norte" }, { uf: "RS", nome: "Rio Grande do Sul" },
  { uf: "RO", nome: "Rondônia" }, { uf: "RR", nome: "Roraima" }, { uf: "SC", nome: "Santa Catarina" },
  { uf: "SP", nome: "São Paulo" }, { uf: "SE", nome: "Sergipe" }, { uf: "TO", nome: "Tocantins" },
];

// cache simples em memória — evita rebuscar cidades do mesmo estado
// toda vez que o usuário troca de UF e volta
const cidadesCache = {};

async function fetchCidades(uf) {
  if (cidadesCache[uf]) return cidadesCache[uf];
  const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
  if (!res.ok) throw new Error("Não foi possível carregar as cidades. Tente novamente.");
  const data = await res.json();
  const nomes = data.map((c) => c.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
  cidadesCache[uf] = nomes;
  return nomes;
}

// value/onChange trabalham com a string combinada "Cidade, UF", pra ficar
// compatível com o que o resto do app já espera exibir.
// labelStyle/selectStyle permitem adaptar a aparência ao fundo onde o
// componente for usado (ex: painel escuro do cadastro vs. formulário
// claro comum).
export default function CityStateSelect({ value, onChange, required, labelStyle, selectStyle: selectStyleOverride }) {
  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");
  const [cidades, setCidades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // se já vier um valor pré-existente ("Cidade, UF"), tenta separar
  useEffect(() => {
    if (value && !uf && !cidade) {
      const match = value.match(/^(.*),\s*([A-Z]{2})$/);
      if (match) {
        setCidade(match[1].trim());
        setUf(match[2].trim());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!uf) { setCidades([]); return; }
    setLoading(true);
    setError("");
    fetchCidades(uf)
      .then(setCidades)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [uf]);

  function handleUfChange(newUf) {
    setUf(newUf);
    setCidade("");
    onChange("");
  }

  function handleCidadeChange(newCidade) {
    setCidade(newCidade);
    onChange(newCidade && uf ? `${newCidade}, ${uf}` : "");
  }

  const finalLabelStyle = { fontSize: 12, color: COLORS.soilLight, ...labelStyle };
  const finalSelectStyle = { ...defaultSelectStyle, ...selectStyleOverride };

  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ width: 110 }}>
        <label style={finalLabelStyle}>Estado</label>
        <select
          required={required}
          value={uf}
          onChange={(e) => handleUfChange(e.target.value)}
          style={finalSelectStyle}
        >
          <option value="">UF</option>
          {ESTADOS_BR.map((e) => (
            <option key={e.uf} value={e.uf}>{e.uf}</option>
          ))}
        </select>
      </div>
      <div style={{ flex: 1 }}>
        <label style={finalLabelStyle}>Cidade</label>
        <select
          required={required}
          value={cidade}
          disabled={!uf || loading}
          onChange={(e) => handleCidadeChange(e.target.value)}
          style={{ ...finalSelectStyle, opacity: !uf || loading ? 0.6 : 1 }}
        >
          <option value="">{loading ? "Carregando..." : uf ? "Selecione a cidade" : "Escolha o estado primeiro"}</option>
          {cidades.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {error && <p style={{ fontSize: 11, color: COLORS.danger, margin: "4px 0 0" }}>{error}</p>}
      </div>
    </div>
  );
}

const defaultSelectStyle = {
  width: "100%", marginTop: 4, padding: "9px 10px", borderRadius: 9,
  border: `1px solid ${COLORS.line}`, fontSize: 13.5, background: "#fff", fontFamily: "inherit",
};
