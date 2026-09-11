// Tela de carregamento cheia — a arte (fundo de fazenda, ícone do saco de
// grãos, spinner e a assinatura "hadron agro") vem toda de um único SVG
// estático. O spinner gira de verdade porque a animação CSS está embutida
// dentro do próprio arquivo SVG (não depende de JavaScript), então uma
// simples tag <img> já é suficiente.
export default function LoadingScreen() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "#EADFCD", overflow: "hidden",
    }}>
      <img
        src="/loading-screen.svg"
        alt="Carregando o Meu Talhão..."
        style={{
          width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "top center",
        }}
      />
    </div>
  );
}
