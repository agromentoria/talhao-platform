import { tokenStorage } from "./storage";
import { isNative } from "./native";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/$/, "");

// Baixa um arquivo autenticado da API (CSV de transações/relatórios).
// No celular usa a folha de compartilhamento do sistema (salvar em Arquivos,
// enviar por e-mail/WhatsApp); no navegador faz o download normal.
export async function downloadFromApi(path, filename) {
  const res = await fetch(API_URL + path, { headers: { Authorization: `Bearer ${tokenStorage.get()}` } });
  if (!res.ok) {
    let msg = "Não foi possível gerar o arquivo.";
    try { msg = (await res.json()).error || msg; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const file = new File([blob], filename, { type: blob.type || "text/csv" });
  const touch = window.matchMedia?.("(pointer: coarse)").matches;
  if ((isNative || touch) && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; } catch { /* cancelado: cai no download */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
