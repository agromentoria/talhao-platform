import { fmtNumber, fmtBRL } from "./format";
import { unidadeNome, iconeUnidade } from "../config/culturas";

function carregar(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function quebrar(ctx, texto, x, y, larg, linha) {
  const palavras = texto.split(" "); let atual = ""; let yy = y;
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(teste).width > larg && atual) { ctx.fillText(atual, x, yy); atual = p; yy += linha; } else atual = teste;
  }
  if (atual) ctx.fillText(atual, x, yy);
  return yy;
}

// Gera a imagem do certificado de participação (1080×1350, bom para WhatsApp e Instagram)
export async function gerarCertificado({ nome, inv }) {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  await document.fonts?.ready;
  const bg = await carregar("/bg-farm-green.svg");
  ctx.fillStyle = "#5F8229"; ctx.fillRect(0, 0, W, H);
  if (bg) ctx.drawImage(bg, 0, 0, W, H);
  ctx.fillStyle = "rgba(255,253,249,0.96)";
  const r = 48, x0 = 70, y0 = 230, w = W - 140, h = H - 330;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y0, w, h, r) : ctx.rect(x0, y0, w, h); ctx.fill();
  const logo = await carregar("/logo-header.svg");
  if (logo) ctx.drawImage(logo, W / 2 - 150, 50, 300, 300 * (logo.height / logo.width || 0.45));
  const icone = await carregar(iconeUnidade(inv.grao));
  if (icone) ctx.drawImage(icone, W / 2 - 90, y0 + 50, 180, 180);
  ctx.textAlign = "center";
  ctx.fillStyle = "#B26000"; ctx.font = "700 40px 'Baloo 2', sans-serif";
  ctx.fillText("CERTIFICADO DE PARTICIPAÇÃO", W / 2, y0 + 290);
  ctx.fillStyle = "#342525"; ctx.font = "700 64px 'Baloo 2', sans-serif";
  ctx.fillText(`${fmtNumber(inv.cotas)} ${unidadeNome(inv.unidade, inv.cotas)} de ${inv.grao.toLowerCase()}`, W / 2, y0 + 380);
  ctx.font = "500 34px Inter, sans-serif"; ctx.fillStyle = "#584A3C";
  let y = quebrar(ctx, `${nome} é dono(a) de parte da produção do talhão ${inv.plot_nome}, na ${inv.farm_name}.`, W / 2, y0 + 460, w - 120, 46);
  y = quebrar(ctx, `Safra ${inv.safra}${inv.variedade ? ` · ${inv.variedade}` : ""}`, W / 2, y + 70, w - 120, 46);
  ctx.font = "600 30px Inter, sans-serif"; ctx.fillStyle = "#4E6E20";
  ctx.fillText(`Investido: ${fmtBRL(inv.valor_investido)} · ${new Date(inv.created_at).toLocaleDateString("pt-BR")}`, W / 2, y + 80);
  ctx.font = "500 26px Inter, sans-serif"; ctx.fillStyle = "#7A6A58";
  ctx.fillText("Guardado no meu armazém Meu Talhão · meutalhao.com.br", W / 2, y0 + h - 60);
  return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}

export async function compartilharCertificado({ nome, inv }) {
  const blob = await gerarCertificado({ nome, inv });
  const arquivo = new File([blob], `certificado-${inv.plot_nome.replace(/\W+/g, "-").toLowerCase()}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo], title: "Meu certificado Meu Talhão", text: `Sou dono(a) de ${inv.cotas} ${unidadeNome(inv.unidade, inv.cotas)} de ${inv.grao.toLowerCase()} na ${inv.farm_name}!` }); return; } catch { /* cancelado */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = arquivo.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
