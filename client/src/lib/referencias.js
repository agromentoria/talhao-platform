import { useEffect, useState } from "react";
import { api } from "./api";

// Taxas de referência (CDI, LCA, poupança) vindas de /api/regras, para
// comparar o ganho de uma safra com o que o mesmo dinheiro renderia NO MESMO
// PRAZO. Nada aqui é anualizado para o investidor: tudo é por safra.
let cache = null;
let pendente = null;
const PADRAO = { cdi_aa: 13.65, lca_pct_cdi: 90, poupanca_am: 0.67, atualizado_em: "2026-10" };

export function useRegras() {
  const [r, setR] = useState(cache);
  useEffect(() => {
    if (cache) return;
    if (!pendente) pendente = api.regras().then((d) => { cache = d; return d; }).catch(() => null);
    let vivo = true;
    pendente.then((d) => vivo && d && setR(d));
    return () => { vivo = false; };
  }, []);
  return r;
}

// quanto cada alternativa rende em `dias` corridos
export function rendimentoNoPrazo(dias, ref = PADRAO) {
  const d = Math.max(1, Number(dias) || 0);
  const comp = (taxaAA) => (Math.pow(1 + taxaAA / 100, d / 365) - 1) * 100;
  const ir = d <= 180 ? 0.225 : d <= 360 ? 0.2 : d <= 720 ? 0.175 : 0.15; // tabela regressiva
  return {
    dias: d,
    poupanca: (Math.pow(1 + ref.poupanca_am / 100, d / 30.44) - 1) * 100,
    cdb: comp(ref.cdi_aa) * (1 - ir),
    lca: comp(ref.cdi_aa * (ref.lca_pct_cdi / 100)),
  };
}

export const REFERENCIAS_PADRAO = PADRAO;
