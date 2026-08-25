/**
 * Catálogo de instituições. Os arquivos ficam em `public/banks/` — servidos
 * pelo próprio app, sem chamada a serviço externo em runtime: a página não
 * revela a terceiros quais bancos a pessoa usa, e nada quebra se um provedor
 * de logos sair do ar (foi o que aconteceu com a API da Clearbit).
 *
 * `color` é a cor da marca, usada como fallback e como realce.
 * `lowRes` marca logos que só existem em resolução pequena: eles são exibidos
 * menores, onde a perda não aparece.
 */
export type Bank = {
  slug: string;
  name: string;
  logo: string;
  color: string;
  lowRes?: boolean;
};

export const BANKS: Bank[] = [
  { slug: "nubank", name: "Nubank", logo: "/banks/nubank.svg", color: "#820AD1" },
  { slug: "itau", name: "Itaú", logo: "/banks/itau.png", color: "#EC7000" },
  { slug: "bb", name: "Banco do Brasil", logo: "/banks/bb.png", color: "#F5C400" },
  { slug: "bradesco", name: "Bradesco", logo: "/banks/bradesco.png", color: "#CC092F" },
  { slug: "santander", name: "Santander", logo: "/banks/santander.png", color: "#EC0000" },
  { slug: "caixa", name: "Caixa", logo: "/banks/caixa.png", color: "#0070AF", lowRes: true },
  { slug: "inter", name: "Inter", logo: "/banks/inter.png", color: "#FF7A00" },
  { slug: "c6", name: "C6 Bank", logo: "/banks/c6.png", color: "#242424" },
  { slug: "btg", name: "BTG Pactual", logo: "/banks/btg.png", color: "#051A3C" },
  { slug: "sicredi", name: "Sicredi", logo: "/banks/sicredi.png", color: "#3FA110", lowRes: true },
  { slug: "sicoob", name: "Sicoob", logo: "/banks/sicoob.png", color: "#00AE9D" },
  { slug: "safra", name: "Safra", logo: "/banks/safra.png", color: "#003057" },
  { slug: "picpay", name: "PicPay", logo: "/banks/picpay.svg", color: "#21C25E" },
  {
    slug: "mercadopago",
    name: "Mercado Pago",
    logo: "/banks/mercadopago.svg",
    color: "#00B1EA",
  },
  { slug: "pagbank", name: "PagBank", logo: "/banks/pagbank.png", color: "#00AA4F" },
  { slug: "neon", name: "Neon", logo: "/banks/neon.png", color: "#00E5B0" },
  {
    slug: "willbank",
    name: "Will Bank",
    logo: "/banks/willbank.png",
    color: "#FFD400",
    lowRes: true,
  },
  { slug: "xp", name: "XP", logo: "/banks/xp.png", color: "#0F0F0F", lowRes: true },
];

const BY_SLUG = new Map(BANKS.map((bank) => [bank.slug, bank]));

export function findBank(slug: string | null | undefined): Bank | undefined {
  return slug ? BY_SLUG.get(slug) : undefined;
}
