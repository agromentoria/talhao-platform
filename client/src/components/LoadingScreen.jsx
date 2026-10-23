// Tela de carregamento cheia — a arte (fundo de fazenda, ícone do saco de
// grãos, spinner e a assinatura "hadron agro") vem de um único SVG estático,
// desenhado em pé (9:16). O spinner gira porque a animação está dentro do SVG.
// Celular: a arte cobre a tela toda. Tablet e desktop (telas mais largas que
// 9:16): a arte aparece inteira e centralizada, com o fundo da marca dos lados.
export default function LoadingScreen() {
  return (
    <div className="tela-abertura" role="status" aria-live="polite">
      <style>{`
        .tela-abertura { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center;
          background: #EADFCD; overflow: hidden; }
        .tela-abertura img { width: 100%; height: 100%; object-fit: cover; object-position: top center; }
        @media (min-aspect-ratio: 10/16) {
          .tela-abertura { background: #EADFCD radial-gradient(ellipse at center, #F3EADB 0%, #EADFCD 70%); }
          .tela-abertura img { width: auto; height: 100%; max-width: 100%; object-fit: contain; object-position: center;
            -webkit-mask-image: linear-gradient(to right, transparent 0, #000 6%, #000 94%, transparent 100%);
            mask-image: linear-gradient(to right, transparent 0, #000 6%, #000 94%, transparent 100%); }
        }
      `}</style>
      <img src="/loading-screen.svg" alt="Carregando o Meu Talhão..." />
    </div>
  );
}
