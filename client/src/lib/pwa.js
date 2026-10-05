// Registro do service worker (PWA): o app abre mesmo com internet ruim e pode
// ser instalado na tela inicial. Dados financeiros NUNCA são guardados em
// cache — só a "casca" do app (HTML, JS, CSS, fontes e ilustrações).
import { isNative } from "./native";

export function registerServiceWorker() {
  if (isNative || !("serviceWorker" in navigator) || import.meta.env.DEV) return;
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          // versão nova publicada: atualiza na próxima vez que o app ficar em segundo plano
          const onHidden = () => {
            if (document.visibilityState === "hidden") {
              document.removeEventListener("visibilitychange", onHidden);
              updateSW(true);
            }
          };
          document.addEventListener("visibilitychange", onHidden);
        },
      });
    })
    .catch(() => {});
}
