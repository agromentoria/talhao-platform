// Armazenamento da sessão. localStorage funciona tanto no navegador quanto
// dentro do WebView do app nativo (Capacitor). Centralizado aqui para que,
// se um dia a sessão for para o Keychain/Keystore, só este arquivo mude.
const TOKEN_KEY = "talhao_token";

function safe(fn, fallback = null) {
  try { return fn(); } catch { return fallback; }
}

export const tokenStorage = {
  get: () => safe(() => localStorage.getItem(TOKEN_KEY)),
  set: (token) => safe(() => localStorage.setItem(TOKEN_KEY, token)),
  clear: () => safe(() => localStorage.removeItem(TOKEN_KEY)),
};
