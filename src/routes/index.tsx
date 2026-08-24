import { createFileRoute, Link } from "@tanstack/react-router";
import { Home, TrendingUp, Check } from "lucide-react";
import dashboardPreview from "../assets/dashboard-preview.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aureum — Gestão Financeira Pessoal" },
      { name: "description", content: "Acompanhe gastos, metas e investimentos com um app visual e intuitivo. Controle total da sua riqueza em um só lugar." },
      { property: "og:title", content: "Aureum — Gestão Financeira Pessoal" },
      { property: "og:description", content: "Acompanhe gastos, metas e investimentos com um app visual e intuitivo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Navigation */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary" />
          <span className="text-xl font-semibold tracking-tight">Aureum</span>
        </Link>
        <div className="hidden items-center gap-8 text-sm font-medium md:flex">
          <a href="#funcionalidades" className="transition-colors hover:text-primary/70">
            Funcionalidades
          </a>
          <a href="#seguranca" className="transition-colors hover:text-primary/70">
            Segurança
          </a>
          <a href="#precos" className="transition-colors hover:text-primary/70">
            Preços
          </a>
        </div>
        <button className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90">
          Começar agora
        </button>
      </nav>

      {/* Hero Section */}
      <header className="mx-auto grid max-w-7xl items-center gap-16 px-8 pt-16 pb-24 lg:grid-cols-2">
        <div>
          <h1 className="font-serif text-5xl leading-[1.1] md:text-6xl lg:text-7xl">
            Sua riqueza, <br />
            <span className="italic text-primary">sob controle.</span>
          </h1>
          <p className="mb-10 max-w-md pt-8 text-xl leading-relaxed text-muted-foreground">
            Uma experiência visual e intuitiva para gerir seus investimentos, gastos e metas de vida em um só lugar.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button className="rounded-full bg-accent px-8 py-4 font-semibold text-accent-foreground transition-all hover:brightness-105">
              Criar conta gratuita
            </button>
            <button className="rounded-full border border-foreground/10 px-8 py-4 font-semibold transition-all hover:bg-card">
              Ver demonstração
            </button>
          </div>
        </div>
        <div className="relative">
          <div className="rounded-3xl border border-primary/5 bg-card p-6 shadow-2xl shadow-primary/5 sm:p-8">
            {/* Mock UI */}
            <div className="mb-8 flex items-end justify-between">
              <div>
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Saldo Total
                </span>
                <div className="mt-1 font-serif text-3xl sm:text-4xl">R$ 42.850,00</div>
              </div>
              <div className="rounded bg-accent/20 px-2 py-1 text-xs font-bold text-primary">+12.5%</div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-secondary p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-full border border-foreground/5 bg-card">
                    <Home className="size-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Aluguel & Moradia</div>
                    <div className="text-xs text-muted-foreground">12 de Outubro</div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-red-600">- R$ 2.400,00</div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-secondary p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-full border border-foreground/5 bg-card">
                    <TrendingUp className="size-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Dividendos ITUB4</div>
                    <div className="text-xs text-muted-foreground">10 de Outubro</div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-emerald-600">+ R$ 850,40</div>
              </div>
            </div>

            <div className="mt-8 border-t border-foreground/5 pt-8">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium">Meta: Viagem Japão</span>
                <span className="text-sm font-medium">75%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-3/4 bg-primary" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Feature Highlight */}
      <section id="funcionalidades" className="bg-primary py-24 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-8">
          <div className="grid gap-12 md:grid-cols-3">
            <div>
              <div className="mb-4 font-serif text-3xl text-accent">01.</div>
              <h3 className="mb-3 text-xl font-medium">Inteligência Preditiva</h3>
              <p className="text-sm leading-relaxed text-primary-foreground/60">
                Nossa IA analisa seus padrões de consumo para prever gastos futuros e sugerir economias reais.
              </p>
            </div>
            <div>
              <div className="mb-4 font-serif text-3xl text-accent">02.</div>
              <h3 className="mb-3 text-xl font-medium">Multicontas Global</h3>
              <p className="text-sm leading-relaxed text-primary-foreground/60">
                Conecte bancos brasileiros e internacionais. Acompanhe seu patrimônio em qualquer moeda em tempo real.
              </p>
            </div>
            <div>
              <div className="mb-4 font-serif text-3xl text-accent">03.</div>
              <h3 className="mb-3 text-xl font-medium">Privacidade Absoluta</h3>
              <p className="text-sm leading-relaxed text-primary-foreground/60">
                Criptografia de ponta a ponta. Seus dados financeiros pertencem apenas a você, nunca a terceiros.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Preview */}
      <section id="seguranca" className="mx-auto max-w-7xl px-8 py-24">
        <div className="flex flex-col items-center gap-16 md:flex-row">
          <div className="w-full md:w-1/2">
            <img
              src={dashboardPreview}
              alt="Interface do app Aureum mostrando dashboard financeiro em modo escuro com gráficos e categorias de despesa"
              width={1200}
              height={912}
              loading="lazy"
              className="w-full rounded-3xl border border-foreground/5 bg-primary/5 object-cover"
            />
          </div>
          <div className="w-full md:w-1/2">
            <h2 className="mb-6 font-serif text-4xl md:text-5xl">Visualização clara do seu futuro.</h2>
            <p className="mb-8 leading-relaxed text-muted-foreground">
              Gráficos que não precisam de manual. Entenda para onde seu dinheiro está indo com categorização automática e relatórios semanais que fazem sentido.
            </p>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <div className="grid size-5 place-items-center rounded-full bg-accent text-[10px] text-accent-foreground">
                  <Check className="size-3" />
                </div>
                <span className="text-sm font-medium">Alertas de gastos excessivos</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="grid size-5 place-items-center rounded-full bg-accent text-[10px] text-accent-foreground">
                  <Check className="size-3" />
                </div>
                <span className="text-sm font-medium">Planejamento de aposentadoria</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="grid size-5 place-items-center rounded-full bg-accent text-[10px] text-accent-foreground">
                  <Check className="size-3" />
                </div>
                <span className="text-sm font-medium">Exportação para contador (PDF/Excel)</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-7xl border-t border-foreground/5 px-8 pt-16 pb-8">
        <div className="mb-16 flex flex-col items-start justify-between gap-12 md:flex-row">
          <div>
            <div className="mb-6 flex items-center gap-2">
              <div className="size-6 rounded-md bg-primary" />
              <span className="text-lg font-semibold tracking-tight">Aureum</span>
            </div>
            <p className="max-w-xs text-sm text-muted-foreground">
              Redefinindo a relação entre pessoas e dinheiro através de design e tecnologia.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-16 md:grid-cols-3">
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Produto</span>
              <a href="#funcionalidades" className="text-sm transition-colors hover:text-primary">Recursos</a>
              <a href="#seguranca" className="text-sm transition-colors hover:text-primary">Segurança</a>
              <a href="#" className="text-sm transition-colors hover:text-primary">Mobile</a>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Empresa</span>
              <a href="#" className="text-sm transition-colors hover:text-primary">Sobre</a>
              <a href="#" className="text-sm transition-colors hover:text-primary">Blog</a>
              <a href="#" className="text-sm transition-colors hover:text-primary">Carreiras</a>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Social</span>
              <a href="#" className="text-sm transition-colors hover:text-primary">Instagram</a>
              <a href="#" className="text-sm transition-colors hover:text-primary">Twitter</a>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground/60 md:flex-row">
          <span>© 2026 Aureum Finance. Todos os direitos reservados.</span>
          <div className="flex gap-6">
            <a href="#" className="transition-colors hover:text-foreground">Privacidade</a>
            <a href="#" className="transition-colors hover:text-foreground">Termos</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
