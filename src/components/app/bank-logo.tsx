import { findBank } from "../../lib/banks";

type BankLogoProps = {
  /** Slug da instituição; quando não houver, cai no monograma. */
  institution: string | null | undefined;
  /** Nome da conta — origem da inicial do fallback. */
  name: string;
  /** Cor da conta, usada pelo fallback. */
  color: string;
  size?: "sm" | "md" | "lg";
};

const BOX = { sm: "size-7", md: "size-9", lg: "size-11" } as const;
const TEXT = { sm: "text-[11px]", md: "text-xs", lg: "text-sm" } as const;

export function BankLogo({ institution, name, color, size = "md" }: BankLogoProps) {
  const bank = findBank(institution);

  if (!bank) {
    return (
      <span
        className={`${BOX[size]} ${TEXT[size]} grid shrink-0 place-items-center rounded-full font-semibold`}
        style={{ backgroundColor: `${color}26`, color }}
        aria-hidden="true"
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }

  return (
    <span
      // Fundo branco porque vários logos são escuros (XP, C6, BTG) e sumiriam
      // contra o tema escuro do app.
      className={`${BOX[size]} grid shrink-0 place-items-center overflow-hidden rounded-full bg-white`}
      title={bank.name}
    >
      <img
        src={bank.logo}
        alt={bank.name}
        // Logos de baixa resolução ficam menores: ampliar um 16px até encher o
        // círculo deixaria a borda serrilhada.
        className={bank.lowRes ? "size-[55%] object-contain" : "size-[72%] object-contain"}
        loading="lazy"
      />
    </span>
  );
}
