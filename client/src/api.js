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
  updateProgress: (id, payload) => request(`/plots/${id}/progress`, { method: "PATCH", body: payload }),
  finalizeHarvest: (id, retorno_final) => request(`/plots/${id}/finalize`, { method: "POST", body: { retorno_final } }),

  // investments
  invest: (plot_id, cotas) => request("/investments", { method: "POST", body: { plot_id, cotas } }),
  myInvestments: () => request("/investments/me"),
  plotInvestors: (plotId) => request(`/investments/plot/${plotId}`),

  // admin
  overview: () => request("/admin/overview"),
  adminFarms: () => request("/admin/farms"),
  adminPlots: () => request("/admin/plots"),
};

export function saveToken(token) {
  localStorage.setItem("talhao_token", token);
}
export function clearToken() {
  localStorage.removeItem("talhao_token");
}
