import { formatAmount, maskCurrencyInput, parseCurrencyInput } from "../../lib/format";
import { Input } from "../ui/input";

type CurrencyInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Saldo de cartão e ajustes podem ser negativos; valores de lançamento não. */
  allowNegative?: boolean;
  disabled?: boolean;
};

/**
 * Campo de dinheiro em padrão brasileiro: "R$" fixo à esquerda, milhar
 * separado por ponto e centavos por vírgula.
 *
 * A máscara roda a cada tecla, mas os centavos só são completados no blur —
 * fechar "12" em "12,00" enquanto a pessoa ainda digita jogaria o cursor
 * para o fim e impediria de chegar em "125".
 */
export function CurrencyInput({
  id,
  value,
  onChange,
  placeholder = "0,00",
  allowNegative = false,
  disabled,
}: CurrencyInputProps) {
  const handleBlur = () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "-") return;

    const parsed = parseCurrencyInput(trimmed);
    if (Number.isFinite(parsed)) onChange(formatAmount(parsed));
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className="tabular pl-9"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(maskCurrencyInput(event.target.value, allowNegative))}
        onBlur={handleBlur}
      />
    </div>
  );
}
