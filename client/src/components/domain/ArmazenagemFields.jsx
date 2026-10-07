import { Warehouse } from "lucide-react";
import { Segmented, SelectField } from "../ui";
import { fmtBRL, fmtNumber } from "../../lib/format";
import { unidadeNome } from "../../config/culturas";
import { despesaPorUnidade, tarifasTexto, quinzenasTexto, OPCOES_QUINZENAS } from "../../lib/armazenagem";

// Despesa de armazém no cadastro do talhão: tabela do armazém escolhido,
// quem paga e quanto tempo a produção deve ficar guardada.
export default function ArmazenagemFields({ warehouse, value, onChange, precoVenda, unidade = "saca", quantidade }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const u = unidadeNome(unidade, 1);
  const d = despesaPorUnidade(warehouse, { quinzenas: Number(value.quinzenas), precoVenda: Number(precoVenda) || 0 });
  const semTabela = warehouse && !Number(warehouse.tarifa_recepcao) && !Number(warehouse.tarifa_quinzena) && !Number(warehouse.quebra_quinzena_pct);

  return (
    <div className="span-all card card--well" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <p className="card-title" style={{ display: "flex", gap: 6, alignItems: "center" }}><Warehouse size={16} aria-hidden /> Despesa de armazenagem</p>
      {!warehouse ? (
        <p className="text-sm text-2">Escolha o armazém para ver a tabela de tarifas.</p>
      ) : semTabela ? (
        <p className="text-sm text-2">{warehouse.name} ainda não informou a tabela de tarifas. A despesa fica zerada até ele preencher, e o valor vale a partir do aceite da custódia.</p>
      ) : (
        <p className="text-sm text-2">Tabela de {warehouse.name}: {tarifasTexto(warehouse, unidade)}.</p>
      )}

      <div className="form-grid">
        <div className="field">
          <span className="field-label" id="arm-pagador">Quem paga a armazenagem</span>
          <Segmented label="Quem paga a armazenagem" value={value.pagador} onChange={(v) => set({ pagador: v })}
            options={[{ id: "investidores", label: "Investidores" }, { id: "fazenda", label: "Fazenda" }]} />
          <span className="field-hint">
            {value.pagador === "investidores"
              ? "Descontada do resultado de cada investidor, antes das comissões."
              : "A fazenda assume; o investidor recebe sem esse desconto."}
          </span>
        </div>
        <SelectField label="Tempo previsto no armazém" value={String(value.quinzenas)} onChange={(v) => set({ quinzenas: Number(v) })}
          hint="Da entrega no armazém até a venda. A cobrança real conta o tempo efetivo."
          options={OPCOES_QUINZENAS.map((q) => ({ value: String(q), label: quinzenasTexto(q) }))} />
      </div>

      {warehouse && !semTabela && (
        <p className="text-sm">
          Estimativa: <strong>{fmtBRL(d.total)}</strong> por {u}
          {" "}(recepção {fmtBRL(d.recepcao)} + {d.cobradas} quinzena(s) cobrada(s) {fmtBRL(d.armazenagem)}{d.quebra > 0 ? ` + quebra ${fmtBRL(d.quebra)}` : ""})
          {quantidade > 0 && <> · <strong>{fmtBRL(d.total * quantidade)}</strong> sobre {fmtNumber(quantidade)} {unidadeNome(unidade, quantidade)}</>}
        </p>
      )}
    </div>
  );
}
