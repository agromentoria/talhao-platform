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
