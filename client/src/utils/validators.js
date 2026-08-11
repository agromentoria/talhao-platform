export function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

// ---------- cartão ----------

export function maskCardNumber(value, brand) {
  const digits = onlyDigits(value);
  const maxDigits = brand === "American Express" ? 15 : 16;
  const trimmed = digits.slice(0, maxDigits);
  if (brand === "American Express") {
    // formato 4-6-5
    return trimmed.replace(/^(\d{4})(\d{0,6})(\d{0,5}).*/, (_, a, b, c) => [a, b, c].filter(Boolean).join(" "));
  }
  // formato 4-4-4-4
  return trimmed.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function detectCardBrand(value) {
  const digits = onlyDigits(value);
  if (/^4/.test(digits)) return "Visa";
  if (/^5[1-5]/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  if (/^6(?:011|5)/.test(digits)) return "Elo";
  return null;
}

export function maskExpMonth(value) {
  return onlyDigits(value).slice(0, 2);
}

export function maskExpYear(value) {
  return onlyDigits(value).slice(0, 4);
}

export function maskCVV(value) {
  return onlyDigits(value).slice(0, 3);
}

// ---------- CPF ----------

export function maskCPF(value) {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function isValidCPF(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let check1 = (sum * 10) % 11;
  if (check1 === 10) check1 = 0;
  if (check1 !== parseInt(cpf[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let check2 = (sum * 10) % 11;
  if (check2 === 10) check2 = 0;
  return check2 === parseInt(cpf[10], 10);
}

// ---------- CNPJ ----------

export function maskCNPJ(value) {
  const d = onlyDigits(value).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function isValidCNPJ(value) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (base) => {
    let weight = base.length - 7;
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i], 10) * weight;
      weight--;
      if (weight < 2) weight = 9;
    }
    const result = sum % 11;
    return result < 2 ? 0 : 11 - result;
  };

  const digit1 = calc(cnpj.slice(0, 12));
  if (digit1 !== parseInt(cnpj[12], 10)) return false;
  const digit2 = calc(cnpj.slice(0, 13));
  return digit2 === parseInt(cnpj[13], 10);
}

// ---------- telefone ----------

export function maskPhone(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, (_, a, b, c) => [`(${a})`, b, c].filter(Boolean).join(" ").replace(/ (\d{4})$/, "-$1"));
  }
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, (_, a, b, c) => `(${a}) ${b}${c ? "-" + c : ""}`);
}

export function isValidPhone(value) {
  const d = onlyDigits(value);
  return d.length === 10 || d.length === 11;
}

// ---------- e-mail ----------

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

// ---------- chave aleatória (Pix) ----------
// formato padrão: UUID v4 (32 caracteres hexadecimais com hífens)

export function isValidRandomKey(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

// ---------- conta bancária ----------

export const BRAZILIAN_BANKS = [
  { code: "001", name: "Banco do Brasil" },
  { code: "033", name: "Santander" },
  { code: "041", name: "Banrisul" },
  { code: "070", name: "BRB - Banco de Brasília" },
  { code: "077", name: "Banco Inter" },
  { code: "085", name: "Sicoob" },
  { code: "104", name: "Caixa Econômica Federal" },
  { code: "212", name: "Banco Original" },
  { code: "218", name: "Banco BS2" },
  { code: "237", name: "Bradesco" },
  { code: "260", name: "Nu Pagamentos (Nubank)" },
  { code: "290", name: "PagBank (PagSeguro)" },
  { code: "336", name: "C6 Bank" },
  { code: "341", name: "Itaú Unibanco" },
  { code: "380", name: "PicPay" },
  { code: "403", name: "Cora" },
  { code: "422", name: "Banco Safra" },
  { code: "637", name: "Banco Sofisa" },
  { code: "735", name: "Banco Neon" },
  { code: "748", name: "Sicredi" },
  { code: "756", name: "Sicoob (Bancoob)" },
  { code: "999", name: "Outro banco" },
];

export function maskAgencia(value) {
  const d = onlyDigits(value).slice(0, 5);
  if (d.length === 5) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return d;
}

export function isValidAgencia(value) {
  const d = onlyDigits(value);
  return d.length >= 3 && d.length <= 5;
}

export function maskConta(value) {
  const d = onlyDigits(value).slice(0, 13);
  if (d.length > 1) return `${d.slice(0, -1)}-${d.slice(-1)}`;
  return d;
}

export function isValidConta(value) {
  const d = onlyDigits(value);
  return d.length >= 4 && d.length <= 13;
}

// ---------- validade do cartão ----------
// segue o padrão das bandeiras: validade máxima de até ~12 anos a partir de hoje

export function cardExpiryYearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 13 }, (_, i) => currentYear + i);
}

export const CARD_EXPIRY_MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
