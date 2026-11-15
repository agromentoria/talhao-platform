// abre um documento em base64 (data URL) numa nova aba
export function abrirDataUrl(conteudo) {
  const [meta, b64] = String(conteudo).split(",");
  const tipo = meta.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  window.open(URL.createObjectURL(new Blob([bytes], { type: tipo })), "_blank", "noopener");
}
// lê um arquivo escolhido como data URL (limite em bytes)
export function lerArquivo(file, limite = 1_500_000) {
  return new Promise((ok, falha) => {
    if (file.size > limite) { falha(new Error("Arquivo muito grande: até 1,5 MB.")); return; }
    const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => falha(new Error("Não foi possível ler o arquivo.")); r.readAsDataURL(file);
  });
}
