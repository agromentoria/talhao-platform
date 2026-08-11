function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidCPF(value) {
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

function isValidCNPJ(value) {
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

function isValidPhone(value) {
  const d = onlyDigits(value);
  return d.length === 10 || d.length === 11;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isValidRandomKey(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

// valida a chave conforme o tipo declarado; retorna null se ok, ou uma mensagem de erro
function validatePixKey(tipo, chave) {
  if (!chave) return "Informe a chave Pix.";
  if (tipo === "cpf" && !isValidCPF(chave)) return "CPF inválido.";
  if (tipo === "cnpj" && !isValidCNPJ(chave)) return "CNPJ inválido.";
  if (tipo === "telefone" && !isValidPhone(chave)) return "Telefone inválido.";
  if (tipo === "email" && !isValidEmail(chave)) return "E-mail inválido.";
  if (tipo === "aleatoria" && !isValidRandomKey(chave)) return "Chave aleatória em formato inválido.";
  return null;
}

module.exports = {
  onlyDigits, isValidCPF, isValidCNPJ, isValidPhone, isValidEmail, isValidRandomKey, validatePixKey,
};
