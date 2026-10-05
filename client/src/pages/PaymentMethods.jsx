import { useEffect, useState } from "react";
import { CreditCard, Trash2, Star, Plus, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { maskCardNumber, detectCardBrand, maskCVV, cvvLength, onlyDigits, cardExpiryYearOptions, CARD_EXPIRY_MONTHS } from "../lib/validators";
import { Page, PageHeader } from "../components/layout/Page";
import { Button, IconButton, Banner, ErrorBanner, EmptyState, Loading, Segmented, TextField, SelectField, Dialog, Badge, useDialog, useToast } from "../components/ui";

const BRAND_COLORS = { Visa: "#1A1F71", Mastercard: "#C2410C", "American Express": "#2E77BC", Elo: "#111111", Hipercard: "#B3131B" };

export default function PaymentMethods() {
  const dialog = useDialog();
  const toast = useToast();
  const [methods, setMethods] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    return api.paymentMethods()
      .then((data) => setMethods(data.methods))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function handleRemove(m) {
    const ok = await dialog.confirm({ title: "Remover cartão?", message: `${m.brand} final ${m.last4} deixa de aparecer nas suas compras.`, confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    try { await api.removePaymentMethod(m.id); toast("Cartão removido"); load(); } catch (err) { setError(err.message); }
  }

  async function handleSetDefault(m) {
    try { await api.setDefaultPaymentMethod(m.id); toast("Cartão padrão atualizado"); load(); } catch (err) { setError(err.message); }
  }

  return (
    <Page title="Formas de pagamento" back="/perfil" width="narrow">
      <PageHeader
        title="Formas de pagamento"
        subtitle="Cartões salvos para suas compras."
        back="/perfil"
        backLabel="Perfil"
        actions={methods.length > 0 && <Button icon={Plus} onClick={() => setShowForm(true)}>Adicionar cartão</Button>}
      />
      <Banner tone="info" style={{ marginBottom: 20 }}>
        <span style={{ display: "flex", gap: 8 }}><ShieldCheck size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          Guardamos só os 4 últimos dígitos, a bandeira e a validade. O número completo e o código de segurança nunca ficam salvos.</span>
      </Banner>
      <ErrorBanner message={error} />

      {loading ? <Loading /> : methods.length === 0 ? (
        <EmptyState title="Nenhum cartão salvo" action={<Button icon={Plus} onClick={() => setShowForm(true)}>Adicionar cartão</Button>}>
          Você também pode pagar com Pix, sem cadastrar cartão.
        </EmptyState>
      ) : (
        <ul className="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {methods.map((m) => (
            <li key={m.id} className="list-item">
              <span style={{ width: 48, height: 32, borderRadius: 6, background: BRAND_COLORS[m.brand] || "var(--text-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CreditCard size={18} color="#fff" aria-hidden />
              </span>
              <div className="list-item-body">
                <p className="list-item-title" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {m.brand} final {m.last4} {m.is_default && <Badge tone="info">Padrão</Badge>}
                </p>
                <p className="list-item-sub">{m.type === "credito" ? "Crédito" : "Débito"} · validade {String(m.exp_month).padStart(2, "0")}/{m.exp_year}</p>
              </div>
              {!m.is_default && <IconButton label={`Tornar ${m.brand} final ${m.last4} o padrão`} icon={Star} size={18} onClick={() => handleSetDefault(m)} />}
              <IconButton label={`Remover ${m.brand} final ${m.last4}`} icon={Trash2} size={18} onClick={() => handleRemove(m)} style={{ color: "var(--danger)" }} />
            </li>
          ))}
        </ul>
      )}

      <Dialog open={showForm} onClose={() => setShowForm(false)} title="Adicionar cartão">
        <AddCardForm onDone={() => { setShowForm(false); toast("Cartão salvo"); load(); }} onCancel={() => setShowForm(false)} />
      </Dialog>
    </Page>
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
  const brand = detectCardBrand(number);
  const cvvLen = cvvLength(brand);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!expMonth || !expYear) { setError("Escolha o mês e o ano de validade."); return; }
    if (onlyDigits(cvv).length !== cvvLen) { setError(`O código de segurança tem ${cvvLen} dígitos.`); return; }
    setSaving(true);
    try {
      await api.addPaymentMethod({ type, number: onlyDigits(number), holder_name: holderName.trim(), exp_month: Number(expMonth), exp_year: Number(expYear), cvv });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      <ErrorBanner message={error} />
      <Segmented label="Tipo de cartão" value={type} onChange={setType} options={[{ id: "credito", label: "Crédito" }, { id: "debito", label: "Débito" }]} />
      <TextField label={brand ? `Número do cartão (${brand})` : "Número do cartão"} value={number}
        onChange={(v) => setNumber(maskCardNumber(v, detectCardBrand(v)))} placeholder="0000 0000 0000 0000"
        required inputMode="numeric" autoComplete="cc-number" />
      <TextField label="Nome impresso no cartão" value={holderName} onChange={(v) => setHolderName(v.toUpperCase())} required autoComplete="cc-name" autoCapitalize="characters" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <SelectField label="Mês" value={expMonth} onChange={setExpMonth} required autoComplete="cc-exp-month">
          <option value="">MM</option>
          {CARD_EXPIRY_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
        </SelectField>
        <SelectField label="Ano" value={expYear} onChange={setExpYear} required autoComplete="cc-exp-year">
          <option value="">AAAA</option>
          {cardExpiryYearOptions().map((y) => <option key={y} value={y}>{y}</option>)}
        </SelectField>
        <TextField label="CVV" value={cvv} onChange={(v) => setCvv(maskCVV(v, brand))} required inputMode="numeric" autoComplete="cc-csc" placeholder={"0".repeat(cvvLen)} />
      </div>
      <div className="dialog-actions" style={{ marginTop: 4 }}>
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={saving}>Salvar cartão</Button>
      </div>
    </form>
  );
}
