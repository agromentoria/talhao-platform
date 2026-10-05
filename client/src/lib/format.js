import { UNIT_LABEL } from "../config/theme";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("pt-BR");

export function fmtBRL(n) {
  return brl.format(Number(n || 0));
}

export function fmtNumber(n) {
  return num.format(Number(n || 0));
}

export function unitPlural(unidade, n) {
  const label = UNIT_LABEL[unidade] || "cota";
  return n === 1 ? label : `${label}s`;
}

export function fmtDateTime(dateStr, { withYear = true } = {}) {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", ...(withYear ? { year: "numeric" } : {}), hour: "2-digit", minute: "2-digit",
  });
}

export function fmtTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDayLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

export function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "agora há pouco";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  const dias = Math.floor(diff / 86400);
  return dias === 1 ? "ontem" : `há ${dias} dias`;
}

export function firstName(name = "") {
  return String(name).trim().split(/\s+/)[0] || "";
}
