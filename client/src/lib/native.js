// Integração com o app nativo (Capacitor). No navegador comum tudo aqui é
// ignorado. Dentro do app de iOS/Android:
//  - botão "voltar" do Android volta uma tela (e só fecha o app na tela inicial),
//    como manda a diretriz de navegação do Google;
//  - barra de status com texto claro sobre o cabeçalho verde;
//  - splash screen some só quando o app já renderizou.
import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // "ios" | "android" | "web"

export async function setupNative({ navigate, getPath }) {
  if (!isNative) return () => {};
  document.documentElement.dataset.platform = platform;

  const [{ App }, { StatusBar, Style }, { SplashScreen }, { Keyboard }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/status-bar"),
    import("@capacitor/splash-screen"),
    import("@capacitor/keyboard"),
  ]);

  try {
    await StatusBar.setStyle({ style: Style.Dark }); // texto claro
    if (platform === "android") {
      await StatusBar.setOverlaysWebView({ overlay: true }); // usa env(safe-area-inset-top)
    }
  } catch { /* plugin indisponível */ }

  try { await Keyboard.setAccessoryBarVisible({ isVisible: true }); } catch { /* só iOS */ }

  const ROOTS = new Set(["/", "/carteira", "/fazenda", "/admin", "/conversas", "/perfil", "/avisos", "/fazenda/carteira", "/login"]);
  const backHandle = await App.addListener("backButton", ({ canGoBack }) => {
    // diálogos abertos fecham primeiro
    const closeBtn = document.querySelector("[data-dialog-close]");
    if (closeBtn) { closeBtn.click(); return; }
    if (ROOTS.has(getPath()) || !canGoBack) {
      if (getPath() !== "/") navigate("/", { replace: true });
      else App.exitApp();
      return;
    }
    navigate(-1);
  });

  // links compartilhados (universal links / app links) abrem a rota certa
  const urlHandle = await App.addListener("appUrlOpen", ({ url }) => {
    try {
      const { pathname, search } = new URL(url);
      if (pathname) navigate(pathname + search);
    } catch { /* url inválida */ }
  });

  try { await SplashScreen.hide(); } catch { /* sem splash */ }

  return () => { backHandle.remove(); urlHandle.remove(); };
}
