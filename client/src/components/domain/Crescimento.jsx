import { useCallback, useEffect, useState } from "react";
import { BellRing, Gift, Copy, Share2 } from "lucide-react";
import { api } from "../../lib/api";
import { fmtBRL, fmtNumber, unitPlural } from "../../lib/format";
import { Button, TextField, useToast } from "../ui";

// Lista de espera de um talhão esgotado: avisa quando abrir outro da mesma
// fazenda ou da mesma cultura.
export function ListaDeEspera({ plot, user }) {
  const toast = useToast();
  const [r, setR] = useState(null);
  const [cotas, setCotas] = useState("10");
  const [salvando, setSalvando] = useState(false);
  const carregar = useCallback(() => { if (user) api.listaEspera(plot.id).then(setR).catch(() => {}); }, [plot.id, user]);
  useEffect(() => { carregar(); }, [carregar]);
  const u = (n) => unitPlural(plot.unidade, n);

  async function entrar() {
    setSalvando(true);
    try { setR(await api.entrarListaEspera(plot.id, Number(cotas) || 1)); toast("Você está na lista de espera"); }
    catch (e) { toast(e.message, { tone: "error" }); } finally { setSalvando(false); }
  }
  async function sair() {
    try { setR(await api.sairListaEspera(plot.id)); toast("Você saiu da lista"); } catch (e) { toast(e.message, { tone: "error" }); }
  }

  return (
    <div className="lista-espera">
      <p style={{ fontWeight: 700, display: "flex", gap: 6, alignItems: "center" }}><BellRing size={16} aria-hidden /> Esgotou! Quer ser avisado?</p>
      <p className="text-sm text-2">Quando {plot.farm_name} ou outra fazenda abrir um talhão de {plot.grao.toLowerCase()}, você recebe o aviso primeiro.</p>
      {r && r.pessoas > 0 && <p className="text-sm">{fmtNumber(r.pessoas)} {r.pessoas === 1 ? "pessoa espera" : "pessoas esperam"} {fmtNumber(r.cotas)} {u(r.cotas)}.</p>}
      {!user ? (
        <Button block to="/login">Entrar para entrar na lista</Button>
      ) : user.role !== "investidor" ? null : r?.na_lista ? (
        <>
          <p className="text-sm" style={{ fontWeight: 600 }}>Você é o nº {r.posicao} da fila ({fmtNumber(r.minhas_cotas)} {u(r.minhas_cotas)}).</p>
          <Button variant="ghost" size="sm" onClick={sair}>Sair da lista</Button>
        </>
      ) : (
        <div className="row" style={{ alignItems: "flex-end" }}>
          <TextField label={`Quantas ${u(2)} você quer`} type="number" inputMode="numeric" min={1} value={cotas} onChange={setCotas} />
          <Button onClick={entrar} loading={salvando} icon={BellRing}>Entrar na lista</Button>
        </div>
      )}
    </div>
  );
}

// Indique e ganhe: código, link e o que já foi conquistado
export function IndiqueEGanhe() {
  const toast = useToast();
  const [r, setR] = useState(null);
  useEffect(() => { api.indicacaoMe().then(setR).catch(() => {}); }, []);
  if (!r?.codigo_indicacao) return null;
  const link = `${window.location.origin}/cadastro?indicacao=${r.codigo_indicacao}`;
  const texto = `Estou comprando sacas direto da fazenda no Meu Talhão. Cadastre-se com meu código ${r.codigo_indicacao} e ganhe ${fmtBRL(r.bonus_indicado)} na primeira compra: ${link}`;
  async function compartilhar() {
    if (navigator.share) { try { await navigator.share({ title: "Meu Talhão", text: texto }); return; } catch { /* cancelado */ } }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(link); toast("Link copiado"); } catch { toast(link); }
  }
  return (
    <section className="card indique" aria-labelledby="indique-t">
      <p id="indique-t" className="card-title" style={{ display: "flex", gap: 6, alignItems: "center" }}><Gift size={16} aria-hidden /> Indique e ganhe</p>
      <p className="text-sm text-2" style={{ margin: "4px 0 10px" }}>
        Quem você indicar ganha {fmtBRL(r.bonus_indicado)} na primeira compra, e você ganha {fmtBRL(r.bonus_indicador)} em crédito quando essa pessoa comprar.
      </p>
      <div className="indique-codigo"><span className="label-xs">Seu código</span><strong>{r.codigo_indicacao}</strong></div>
      <div className="row" style={{ marginTop: 10 }}>
        <Button icon={Share2} onClick={compartilhar}>Convidar no WhatsApp</Button>
        <Button variant="secondary" icon={Copy} onClick={copiar}>Copiar link</Button>
      </div>
      <p className="text-xs text-3" style={{ marginTop: 10 }}>
        {fmtNumber(r.indicados)} {r.indicados === 1 ? "pessoa cadastrada" : "pessoas cadastradas"} com seu código · {fmtNumber(r.compraram)} já {r.compraram === 1 ? "comprou" : "compraram"} · crédito acumulado {fmtBRL(r.credito)} (usado nas próximas compras quando o pagamento real entrar)
      </p>
    </section>
  );
}
