import { useEffect, useState } from "react";

// Dados da empresa nas páginas legais. Os valores reais são editados pela
// administração (Painel › Dados da empresa) e guardados no servidor; aqui ficam
// só os marcadores mostrados enquanto um campo não for preenchido.
export const EMPRESA_PADRAO = {
  razaoSocial: "[Razão social da empresa]",
  cnpj: "[CNPJ]",
  endereco: "[Endereço da sede]",
  encarregado: "[Nome do encarregado de dados (DPO)]",
  emailPrivacidade: "privacidade@meutalhao.com.br",
  emailCompliance: "compliance@meutalhao.com.br",
  emailOuvidoria: "ouvidoria@meutalhao.com.br",
  plataformaCvm: "[Nome da plataforma de investimento participativo registrada na CVM, parceira]",
  foro: "[Cidade/UF do foro]",
};
export const EMPRESA = EMPRESA_PADRAO; // compatibilidade
export const LEGAL_VERSAO = "2026-10";
export const LEGAL_ATUALIZADO = "23 de outubro de 2026";

const API = import.meta.env.VITE_API_URL || "/api";
let cache = null;
let pedido = null;
const mesclar = (d) => Object.fromEntries(Object.entries(EMPRESA_PADRAO).map(([k, v]) => [k, (d?.[k] || "").trim() || v]));
export const empresaPendente = (e) => Object.values(e).some((v) => String(v).startsWith("["));
export function limparCacheEmpresa() { cache = null; pedido = null; }

export function useEmpresa() {
  const [empresa, setEmpresa] = useState(cache || EMPRESA_PADRAO);
  useEffect(() => {
    if (cache) return;
    pedido ||= fetch(`${API}/legal/empresa`).then((r) => r.json()).then((d) => (cache = mesclar(d.empresa))).catch(() => EMPRESA_PADRAO);
    let vivo = true;
    pedido.then((e) => vivo && setEmpresa(e));
    return () => { vivo = false; };
  }, []);
  return empresa;
}
