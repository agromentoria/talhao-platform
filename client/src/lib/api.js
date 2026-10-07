import { tokenStorage } from "./storage";

// Endereço da API. Em produção (web e apps nativos) defina VITE_API_URL no
// build com a URL completa em https, ex: https://api.meutalhao.com.br/api
const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/$/, "");
// O plano gratuito do Render "dorme" e leva até ~1 minuto para acordar;
// 20 s não era suficiente na primeira visita do dia.
const TIMEOUT_MS = 75000;

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// avisado pelo AuthContext: quando a sessão expira, o app desloga sozinho
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = tokenStorage.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    throw new ApiError(
      offline
        ? "Você está sem internet. Verifique a conexão e tente de novo."
        : err.name === "AbortError"
          ? "O servidor demorou para responder. Tente de novo em instantes."
          : "Não foi possível falar com o servidor. Tente de novo em instantes.",
      0
    );
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // resposta sem corpo
  }

  if (!res.ok) {
    if (res.status === 401 && auth && token && onUnauthorized) onUnauthorized();
    throw new ApiError((data && data.error) || "Algo deu errado. Tente novamente.", res.status, data);
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
  getLegalInfo: () => request("/auth/legal-info"),
  updateLegalInfo: (payload) => request("/auth/legal-info", { method: "PATCH", body: payload }),
  getFarmLegalInfo: (id) => request(`/farms/${id}/legal-info`),
  updateFarmLegalInfo: (id, payload) => request(`/farms/${id}/legal-info`, { method: "PATCH", body: payload }),
  getFarmProfile: (id) => request(`/farms/${id}/profile`, { auth: false }),
  updateFarmProfile: (id, payload) => request(`/farms/${id}/profile`, { method: "PATCH", body: payload }),
  addFarmPhoto: (id, data) => request(`/farms/${id}/photos`, { method: "POST", body: { data } }),
  deleteFarmPhoto: (id, photoId) => request(`/farms/${id}/photos/${photoId}`, { method: "DELETE" }),
  farmCharacteristicsCatalog: () => request("/farm-characteristics", { auth: false }),
  updateFarmCharacteristicPoints: (key, pontos) => request(`/farm-characteristics/${key}`, { method: "PUT", body: { pontos } }),
  pendingFarms: () => request("/farms/status/pendentes"),
  setFarmStatus: (id, status) => request(`/farms/${id}/status`, { method: "PATCH", body: { status } }),
  setCommission: (id, commission_pct) => request(`/farms/${id}/commission`, { method: "PATCH", body: { commission_pct } }),

  // plots
  listPlots: (grao) => request(`/plots${grao ? `?grao=${encodeURIComponent(grao)}` : ""}`, { auth: false }),
  getPlot: (id) => request(`/plots/${id}`, { auth: false }),
  createPlot: (payload) => request("/plots", { method: "POST", body: payload }),
  addPlotPhoto: (id, data) => request(`/plots/${id}/photos`, { method: "POST", body: { data } }),
  deletePlotPhoto: (id, photoId) => request(`/plots/${id}/photos/${photoId}`, { method: "DELETE" }),
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
  finalizeHarvest: (id, retorno_final, comprovante_texto, comprovante_imagem) =>
    request(`/plots/${id}/finalize`, { method: "POST", body: { retorno_final, comprovante_texto, comprovante_imagem } }),
  pendingHarvestRequests: (status) => request(`/admin/harvest-requests${status ? `?status=${status}` : ""}`),
  approveHarvestRequest: (id) => request(`/admin/harvest-requests/${id}/approve`, { method: "POST" }),
  rejectHarvestRequest: (id, motivo) => request(`/admin/harvest-requests/${id}/reject`, { method: "POST", body: { motivo } }),
  farmTrackRecord: (farmId) => request(`/farms/track-record/${farmId}`, { auth: false }),

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

  culturas: () => request("/culturas", { auth: false }),
  plotApprovals: () => request("/admin/plot-approvals"),
  approvePlot: (id) => request(`/admin/plot-approvals/${id}/approve`, { method: "POST" }),
  rejectPlot: (id, motivo) => request(`/admin/plot-approvals/${id}/reject`, { method: "POST", body: { motivo } }),
  warehouseCatalog: () => request("/warehouses/characteristics/catalog", { auth: false }),
  updateWarehouseCharacteristicPoints: (key, pontos) => request(`/warehouses/characteristics/${key}`, { method: "PUT", body: { pontos } }),
  setMyWarehouseCharacteristics: (keys) => request("/warehouses/mine/characteristics", { method: "PUT", body: { keys } }),

  // armazém garantidor (custódia e validações)
  approvedWarehouses: () => request("/warehouses/approved"),
  myWarehouse: () => request("/warehouses/mine"),
  updateMyWarehouse: (payload) => request("/warehouses/mine", { method: "PATCH", body: payload }),
  decideCustody: (plotId, decisao, motivo) => request(`/warehouses/plots/${plotId}/custody`, { method: "POST", body: { decisao, motivo } }),
  validatePlot: (plotId, payload) => request(`/warehouses/plots/${plotId}/validations`, { method: "POST", body: payload }),
  setPlotStorage: (plotId, payload) => request(`/plots/${plotId}/armazenagem`, { method: "PATCH", body: payload }),
  setPlotWarehouse: (plotId, warehouse_id) => request(`/plots/${plotId}/warehouse`, { method: "PATCH", body: { warehouse_id } }),
  adminWarehouses: () => request("/warehouses"),
  setWarehouseStatus: (id, status) => request(`/warehouses/${id}/status`, { method: "PATCH", body: { status } }),

  // conta (exigido pelas lojas: o usuário precisa poder excluir a conta pelo app)
  deleteAccount: (password) => request("/auth/me", { method: "DELETE", body: { password } }),
};

export function saveToken(token) {
  tokenStorage.set(token);
}
export function clearToken() {
  tokenStorage.clear();
}
