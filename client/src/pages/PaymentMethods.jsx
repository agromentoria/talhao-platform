import { useEffect, useState } from "react";
import { CreditCard, Trash2, Star, Plus, ShieldCheck } from "lucide-react";
import { COLORS } from "../theme";
import { ErrorBanner } from "../components/Shared";
import { api } from "../api";

const BRAND_COLORS = {
  Visa: "#1A1F71",
  Mastercard: "#EB001B",
  "American Express": "#2E77BC",
  Elo: "#000000",
  Cartão: COLORS.clay,
};

export default function PaymentMethods() {
  const [methods, setMethods] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    api.paymentMethods()
      .then((data) => setMethods(data.methods))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleRemove(id) {
    if (!confirm("Remover este cartão?")) return;
    try {
      await api.removePaymentMethod(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSetDefault(id) {
    try {
      await api.setDefaultPaymentMethod(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, color: COLORS.soil, margin: "0 0 4px" }}>Formas de pagamento</h1>
      <p style={{ fontSize: 13.5, color: COLORS.soilLight, margin: "0 0 20px" }}>Cartões salvos para suas compras de cotas.</p>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#FBF3E1", border: "1px solid #E8C97A", borderRadius: 10, padding: "10px 14px", marginBottom: 20 }}>
        <ShieldCheck size={15} color={COLORS.orangeDark} style={{ marginTop: 1, flexShrink: 0 }} />
        <p style={{ fontSize: 11.5, color: COLORS.soil, margin: 0, lineHeight: 1.5 }}>
          Guardamos apenas os últimos 4 dígitos, a bandeira e a validade do seu cartão. O número completo e o código de segurança nunca ficam salvos.
        </p>
      </div>

      <ErrorBanner message={error} />

      {loading && <p style={{ fontSize: 13, color: COLORS.soilLight }}>Carregando...</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {methods.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 14, background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ width: 44, height: 30, borderRadius: 6, background: BRAND_COLORS[m.brand] || COLORS.clay, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CreditCard size={16} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.soil, margin: 0 }}>
                {m.brand} •••• {m.last4} {m.is_default && <span style={{ fontSize: 10.5, color: COLORS.orange, fontWeight: 700 }}>· PADRÃO</span>}
              </p>
              <p style={{ fontSize: 12, color: COLORS.soilLight, margin: "2px 0 0" }}>
                {m.type === "credito" ? "Crédito" : "Débito"} · {m.holder_name} · válido até {String(m.exp_month).padStart(2, "0")}/{m.exp_year}
              </p>
            </div>
            {!m.is_default && (
              <button onClick={() => handleSetDefault(m.id)} title="Tornar padrão" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.soilLight, display: "flex" }}>
                <Star size={16} />
              </button>
            )}
            <button onClick={() => handleRemove(m.id)} title="Remover cartão" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.danger, display: "flex" }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {!loading && methods.length === 0 && (
          <p style={{ fontSize: 13, color: COLORS.soilLight }}>Nenhum cartão salvo ainda.</p>
        )}
      </div>

      {showForm ? (
        <AddCardForm onDone={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />
      ) : (
        <button onClick={() => setShowForm(true)} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
          padding: "12px 0", borderRadius: 12, border: `1.5px dashed ${COLORS.line}`, background: "none",
          color: COLORS.orange, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
        }}>
          <Plus size={16} /> Adicionar cartão
        </button>
      )}
    </div>
  );
}

function AddCardForm({ onDone, onCancel }) {
  const [type, setType] = useState("credito");
  const [number, setNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.addPaymentMethod({
        type, number, holder_name: holderName,
        exp_month: Number(expMonth), exp_year: Number(expYear), cvv,
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <ErrorBanner message={error} />

      <div style={{ display: "flex", gap: 8 }}>
        {[{ id: "credito", label: "Crédito" }, { id: "debito", label: "Débito" }].map((opt) => (
          <button key={opt.id} type="button" onClick={() => setType(opt.id)} style={{
            flex: 1, padding: "8px 0", borderRadius: 9, fontSize: 13, cursor: "pointer", fontWeight: 600,
            border: `1px solid ${type === opt.id ? COLORS.orange : COLORS.line}`,
            background: type === opt.id ? COLORS.orange : "#fff",
            color: type === opt.id ? "#fff" : COLORS.soilLight,
          }}>{opt.label}</button>
        ))}
      </div>

      <Field label="Número do cartão" value={number} onChange={setNumber} placeholder="0000 0000 0000 0000" required />
      <Field label="Nome impresso no cartão" value={holderName} onChange={setHolderName} required />
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Mês" value={expMonth} onChange={setExpMonth} placeholder="MM" required style={{ width: 70 }} />
        <Field label="Ano" value={expYear} onChange={setExpYear} placeholder="AAAA" required style={{ width: 90 }} />
        <Field label="CVV" value={cvv} onChange={setCvv} placeholder="123" required type="password" style={{ width: 80 }} />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${COLORS.line}`, background: "#fff", color: COLORS.soilLight, fontSize: 13.5, cursor: "pointer" }}>
          Cancelar
        </button>
        <button type="submit" disabled={saving} style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: COLORS.orange, color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Salvando..." : "Salvar cartão"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, value, onChange, type = "text", required, placeholder, style }) {
  return (
    <div style={style}>
      <label style={{ fontSize: 11.5, color: COLORS.soilLight }}>{label}</label>
      <input
        type={type} required={required} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 13.5, background: "#fff" }}
      />
    </div>
  );
}
