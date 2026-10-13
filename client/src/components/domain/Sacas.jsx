import { fmtNumber } from "../../lib/format";
import { unidadeNome, iconeUnidade } from "../../config/culturas";

// Uma unidade da commodity: a saca da cultura, o animal ou a saca do logo
export function SacaIcon({ size = 28, grao }) {
  return <img src={iconeUnidade(grao)} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: "contain" }} />;
}

// Pilha visual: até 10 unidades uma a uma; acima disso, montes com o número
export function PilhaDeSacas({ quantidade, unidade = "saca", grao, size = 30 }) {
  const n = Math.max(0, Math.floor(Number(quantidade) || 0));
  const rotulo = `${fmtNumber(n)} ${unidadeNome(unidade, n)}`;
  if (n === 0) return null;
  if (n <= 10) {
    return (
      <div className="pilha" role="img" aria-label={rotulo}>
        {Array.from({ length: n }, (_, i) => <span key={i} className="pilha-saca" style={{ animationDelay: `${i * 40}ms` }}><SacaIcon size={size} grao={grao} /></span>)}
      </div>
    );
  }
  const montes = Math.min(5, Math.ceil(Math.log10(n)) + 1);
  return (
    <div className="pilha pilha--montes" role="img" aria-label={rotulo}>
      {Array.from({ length: montes }, (_, i) => (
        <span key={i} className="pilha-monte">
          <SacaIcon size={size} grao={grao} /><SacaIcon size={size} grao={grao} /><SacaIcon size={size} grao={grao} />
        </span>
      ))}
      <strong className="pilha-total">{rotulo}</strong>
    </div>
  );
}
