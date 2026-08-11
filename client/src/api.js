// Endereço da API. Em produção, defina VITE_API_URL no ambiente do build
// (ex: https://api.meutalhao.com.br) — veja o README na raiz do projeto.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getToken() {
  return localStorage.getItem("talhao_token");
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // resposta sem corpo
  }

  if (!res.ok) {
    throw new Error((data && data.error) || "Algo deu errado. Tente novamente.");
  }
  return data;
}

export const api = {
  // auth
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password }, auth: false }),
  register: (payload) => request("/auth/register", { method: "POST", body: payload, auth: false }),
  me: () => request("/auth/me"),
  updateAvatar: (avatar) => request("/auth/avatar", { method: "PATCH", body: { avatar } }),
  updateProfile: (payload) => request("/auth/profile", { method: "PATCH", body: payload }),
  updatePassword: (currentPassword, newPassword) => request("/auth/password", { method: "PATCH", body: { currentPassword, newPassword } }),

  // farms
  listFarms: () => request("/farms", { auth: false }),
  getFarm: (id) => request(`/farms/${id}`),
  pendingFarms: () => request("/farms/status/pendentes"),
  setFarmStatus: (id, status) => request(`/farms/${id}/status`, { method: "PATCH", body: { status } }),
  setCommission: (id, commission_pct) => request(`/farms/${id}/commission`, { method: "PATCH", body: { commission_pct } }),

  // plots
  listPlots: (grao) => request(`/plots${grao ? `?grao=${encodeURIComponent(grao)}` : ""}`, { auth: false }),
  getPlot: (id) => request(`/plots/${id}`, { auth: false }),
  createPlot: (payload) => request("/plots", { method: "POST", body: payload }),
  commodityReferences: () => request("/commodities", { auth: false }),
  updateCommodityReference: (grao, payload) => request(`/commodities/${encodeURIComponent(grao)}`, { method: "PUT", body: payload }),
  platformSettings: () => request("/admin/settings"),
  updatePlatformSettings: (app_commission_pct) => request("/admin/settings", { method: "PUT", body: { app_commission_pct } }),
  fasePricing: () => request("/fase-pricing", { auth: false }),
  updateFasePricing: (fase, multiplicador) => request(`/fase-pricing/${fase}`, { method: "PUT", body: { multiplicador } }),
  myFarmPlots: () => request("/plots/farm/mine"),
  deletePlot: (id) => request(`/plots/${id}`, { method: "DELETE" }),
  restartPlot: (id, payload) => request(`/plots/${id}/restart`, { method: "PATCH", body: payload }),
  editPlot: (id, payload) => request(`/plots/${id}`, { method: "PATCH", body: payload }),
  updateProgress: (id, payload) => request(`/plots/${id}/progress`, { method: "PATCH", body: payload }),
  finalizeHarvest: (id, retorno_final) => request(`/plots/${id}/finalize`, { method: "POST", body: { retorno_final } }),

  // investments
  invest: (plot_id, cotas, payment_method_type, payment_method_id) =>
    request("/investments", { method: "POST", body: { plot_id, cotas, payment_method_type, payment_method_id } }),
  myInvestments: () => request("/investments/me"),
  plotInvestors: (plotId) => request(`/investments/plot/${plotId}`),

  // admin
  overview: () => request("/admin/overview"),
  adminFarms: () => request("/admin/farms"),
  adminPlots: () => request("/admin/plots"),

  // notifications
  myNotifications: () => request("/notifications/me"),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => request("/notifications/read-all", { method: "PATCH" }),
  farmBroadcast: (payload) => request("/notifications/farm-broadcast", { method: "POST", body: payload }),
  adminBroadcast: (payload) => request("/notifications/admin-broadcast", { method: "POST", body: payload }),

  // payments
  paymentMethods: () => request("/payments/methods"),
  addPaymentMethod: (payload) => request("/payments/methods", { method: "POST", body: payload }),
  removePaymentMethod: (id) => request(`/payments/methods/${id}`, { method: "DELETE" }),
  setDefaultPaymentMethod: (id) => request(`/payments/methods/${id}/default`, { method: "PATCH" }),
  getPayoutAccount: () => request("/payments/payout-account"),
  savePayoutAccount: (payload) => request("/payments/payout-account", { method: "PUT", body: payload }),
  myTransactions: () => request("/payments/transactions/me"),
  farmTransactions: () => request("/payments/transactions/farm"),
  adminTransactions: (type) => request(`/admin/transactions${type ? `?type=${type}` : ""}`),
  myConversations: () => request("/conversations/me"),
  startConversation: (user_id) => request("/conversations", { method: "POST", body: { user_id } }),
  conversationMessages: (id) => request(`/conversations/${id}/messages`),
  sendMessage: (id, body) => request(`/conversations/${id}/messages`, { method: "POST", body: { body } }),
  unreadMessagesCount: () => request("/conversations/unread-count"),
};

export function saveToken(token) {
  localStorage.setItem("talhao_token", token);
}
export function clearToken() {
  localStorage.removeItem("talhao_token");
}
