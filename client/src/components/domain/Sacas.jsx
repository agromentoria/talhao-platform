import { fmtNumber } from "../../lib/format";
import { unidadeNome } from "../../config/culturas";

// Desenho de uma saca (SVG próprio, na paleta da marca)
export function SacaIcon({ size = 28, cor = "#C9A46A" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M10 6c0-1.5 2-2.5 6-2.5s6 1 6 2.5l-1.5 2.5c3.5 2.5 6 7 6 12.5 0 5-4.5 7.5-10.5 7.5S5.5 26 5.5 21c0-5.5 2.5-10 6-12.5L10 6z" fill={cor} stroke="#7A5A2E" strokeWidth="1.2" />
      <path d="M11.5 8.5h9" stroke="#7A5A2E" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 16c1.5 1 6.5 1 8 0" stroke="#7A5A2E" strokeWidth="1" strokeLinecap="round" opacity=".6" />
      <circle cx="16" cy="21" r="2.4" fill="#668C2D" opacity=".85" />
    </svg>
  );
}

// Pilha visual: até 10 sacas uma a uma; acima disso, montes com o número
export function PilhaDeSacas({ quantidade, unidade = "saca", size = 26 }) {
  const n = Math.max(0, Math.floor(Number(quantidade) || 0));
  const rotulo = `${fmtNumber(n)} ${unidadeNome(unidade, n)}`;
  if (n === 0) return null;
  if (n <= 10) {
    return (
      <div className="pilha" role="img" aria-label={rotulo}>
        {Array.from({ length: n }, (_, i) => <span key={i} className="pilha-saca" style={{ animationDelay: `${i * 40}ms` }}><SacaIcon size={size} /></span>)}
      </div>
    );
  }
  const montes = Math.min(5, Math.ceil(Math.log10(n)) + 1);
  return (
    <div className="pilha pilha--montes" role="img" aria-label={rotulo}>
      {Array.from({ length: montes }, (_, i) => (
        <span key={i} className="pilha-monte">
          <SacaIcon size={size} /><SacaIcon size={size} /><SacaIcon size={size} />
        </span>
      ))}
      <strong className="pilha-total">{rotulo}</strong>
    </div>
  );
}
