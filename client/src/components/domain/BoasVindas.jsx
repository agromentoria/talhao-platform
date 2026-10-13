import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, Button } from "../ui";
import { SacaIcon } from "./Sacas";
import { useAuth } from "../../context/AuthContext";

const CHAVE = "talhao_boas_vindas_v1";
const PASSOS = [
  { emoji: "🌾", titulo: "Uma saca de verdade", texto: "Cada saca que você compra aqui é parte da produção de uma fazenda de verdade. Dá para começar com 1 saca, pelo preço de um almoço de família." },
  { emoji: "👀", titulo: "Você acompanha a roça", texto: "A fazenda conta como está a lavoura e um armazém de confiança confirma o plantio, a colheita e quanto foi guardado. Tudo aparece no Diário da roça." },
  { emoji: "💰", titulo: "Na colheita, você recebe", texto: "A fazenda vende a produção e a sua parte cai na sua conta. O preço do grão e o clima podem mudar o resultado, para mais ou para menos." },
];

// Boas-vindas em 3 telas para quem está chegando (aparece uma vez)
export default function BoasVindas() {
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState(0);
  useEffect(() => {
    if (user && user.role !== "investidor") return;
    try { if (!localStorage.getItem(CHAVE)) setAberto(true); } catch { /* sem armazenamento */ }
  }, [user]);
  function fechar() {
    try { localStorage.setItem(CHAVE, "1"); } catch { /* sem armazenamento */ }
    setAberto(false);
  }
  if (!aberto) return null;
  const p = PASSOS[passo];
  const ultimo = passo === PASSOS.length - 1;
  return (
    <Dialog open onClose={fechar} title="Bem-vindo ao Meu Talhão" width={460}
      actions={<>
        {passo > 0 ? <Button variant="secondary" onClick={() => setPasso(passo - 1)}>Voltar</Button> : <Button variant="secondary" onClick={fechar}>Pular</Button>}
        <Button onClick={() => (ultimo ? fechar() : setPasso(passo + 1))}>{ultimo ? "Começar" : "Próximo"}</Button>
      </>}>
      <div style={{ textAlign: "center", padding: "6px 4px" }}>
        <div style={{ fontSize: 56, lineHeight: 1 }} aria-hidden>{p.emoji}</div>
        {passo === 0 && <div style={{ display: "flex", justifyContent: "center", gap: 2, margin: "10px 0 0" }} aria-hidden><SacaIcon size={30} /><SacaIcon size={30} /><SacaIcon size={30} /></div>}
        <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-xl)", color: "var(--text)", margin: "12px 0 6px" }}>{p.titulo}</p>
        <p>{p.texto}</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16 }} aria-label={`Passo ${passo + 1} de ${PASSOS.length}`}>
          {PASSOS.map((_, i) => <span key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i === passo ? "var(--primary)" : "var(--border-strong)" }} />)}
        </div>
        {ultimo && <p className="text-sm" style={{ marginTop: 12 }}><Link to="/como-funciona" onClick={fechar}>Ver como funcionam os ganhos</Link></p>}
      </div>
    </Dialog>
  );
}
