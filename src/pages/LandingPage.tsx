import {
  ArrowUpRight,
  Github,
  Lock,
  Sparkles,
  Zap,
  Bot,
  Database,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";

const featureCards = [
  {
    key: "intentRouter",
    icon: Bot,
  },
  {
    key: "memoryEngine",
    icon: Database,
  },
  {
    key: "proactiveCoach",
    icon: Sparkles,
  },
  {
    key: "toolExecutor",
    icon: Zap,
  },
  {
    key: "noiseFilter",
    icon: ShieldCheck,
  },
  {
    key: "privacyFirst",
    icon: Lock,
  },
];

const timeline = [
  { key: "daily" },
  { key: "weekly" },
  { key: "monthly" },
  { key: "quarterly" },
  { key: "yearly" },
];

export function LandingPage() {
  const { t } = useTranslation();
  const { isAuthenticated, hasCompletedOnboarding } = useAuth();
  const primaryCta = isAuthenticated
    ? hasCompletedOnboarding
      ? { to: "/dashboard", label: t("landing.cta.openDashboard") }
      : { to: "/onboarding", label: t("landing.cta.continueOnboarding") }
    : { to: "/signup", label: t("landing.cta.getStarted") };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="glow-ring" aria-hidden />

      <header className="relative z-10 border-b border-white/5">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-indigo-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20">
              SB
            </div>
            <div>
              <p className="font-display text-lg font-semibold leading-none">
                {t("landing.brandName")}
              </p>
              <p className="text-sm text-slate-300">
                {t("landing.brandTagline")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/thibautrey/second-brain-ai-syst"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/5"
            >
              <Github className="h-4 w-4" />
              <span>{t("landing.github")}</span>
              <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <Link to="/docs" className="hidden text-sm font-medium text-slate-200 hover:text-white md:inline">
              Docs
            </Link>
            <Link to={primaryCta.to}>
              <Button className="bg-white text-slate-950 hover:bg-slate-200">{primaryCta.label}</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-16 md:grid-cols-2 md:pt-20">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              {t("landing.hero.pill")}
            </div>
            <h1 className="font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
              {t("landing.hero.title")}
            </h1>
            <p className="text-lg text-slate-200">
              {t("landing.hero.subtitle")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to={primaryCta.to}>
                <Button size="lg" className="bg-emerald-400 text-slate-950 hover:bg-emerald-300">
                  {primaryCta.label}
                </Button>
              </Link>
              <a
                href="https://clawd.bot/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30 hover:bg-white/5"
              >
                {t("landing.hero.inspiredBy")}
              </a>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-300">
              <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-2">
                <Sparkles className="h-4 w-4 text-emerald-300" />
                {t("landing.hero.highlights.summaries")}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-2">
                <ShieldCheck className="h-4 w-4 text-indigo-300" />
                {t("landing.hero.highlights.privacy")}
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-10 rounded-3xl bg-gradient-to-br from-emerald-400/20 via-indigo-400/10 to-transparent blur-3xl" aria-hidden />
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-emerald-500/10 backdrop-blur">
              <div className="flex items-center justify-between text-sm text-slate-200">
                <span>{t("landing.metrics.title")}</span>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-200">
                  {t("landing.metrics.badge")}
                </span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 text-slate-100">
                {[
                  t("landing.metrics.cards.memories"),
                  t("landing.metrics.cards.tools"),
                  t("landing.metrics.cards.summaries"),
                  t("landing.metrics.cards.signals"),
                ].map((label, i) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-slate-300">{label}</p>
                    <p className="mt-1 font-display text-2xl font-semibold">
                      {i === 0 && "12.4k"}
                      {i === 1 && "27"}
                      {i === 2 && "342"}
                      {i === 3 && "91%"}
                    </p>
                    <div className="mt-2 h-1 rounded-full bg-gradient-to-r from-emerald-300 to-indigo-400" />
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-200">
                {t("landing.metrics.sampleQuote")}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-emerald-200">
                {t("landing.pillars.kicker")}
              </p>
              <h2 className="font-display text-3xl font-semibold text-white">
                {t("landing.pillars.title")}
              </h2>
            </div>
            <div className="hidden text-sm text-slate-300 md:flex">
              {t("landing.pillars.subline")}
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {featureCards.map(({ key, icon: Icon }) => (
              <div
                key={key}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-emerald-500/5 transition hover:-translate-y-1 hover:border-emerald-300/50 hover:shadow-emerald-500/20"
              >
                <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100" aria-hidden>
                  <div className="h-full w-full bg-gradient-to-br from-emerald-400/5 via-indigo-400/5 to-transparent" />
                </div>
                <div className="relative mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-emerald-100">
                  <Icon className="h-4 w-4" />
                  {t(`landing.features.${key}.pill`)}
                </div>
                <h3 className="relative font-display text-xl font-semibold text-white">
                  {t(`landing.features.${key}.title`)}
                </h3>
                <p className="relative mt-3 text-sm leading-relaxed text-slate-200">
                  {t(`landing.features.${key}.description`)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 px-6 py-8 shadow-2xl shadow-indigo-500/10 md:px-10 md:py-12">
            <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-indigo-200">
                  {t("landing.timeline.kicker")}
                </p>
                <h3 className="font-display text-3xl font-semibold text-white">
                  {t("landing.timeline.title")}
                </h3>
                <p className="mt-3 max-w-2xl text-slate-200">
                  {t("landing.timeline.subtitle")}
                </p>
              </div>
              <div className="grid gap-3 md:w-80">
                {timeline.map((item, idx) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-200 font-semibold">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-display text-base text-white">
                          {t(`landing.timeline.items.${item.key}.label`)}
                        </p>
                        <p className="text-xs text-slate-300">
                          {t(`landing.timeline.items.${item.key}.detail`)}
                        </p>
                      </div>
                    </div>
                    <div className="h-10 w-0.5 bg-gradient-to-b from-emerald-300 to-indigo-300 opacity-50" aria-hidden />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 bg-slate-950/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-white">
              {t("landing.footer.title")}
            </p>
            <p className="text-sm text-slate-300">
              {t("landing.footer.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/thibautrey/second-brain-ai-syst"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30 hover:bg-white/5"
            >
              <Github className="h-4 w-4" /> {t("landing.footer.star")}
            </a>
            <Link to={primaryCta.to}>
              <Button className="bg-emerald-400 text-slate-950 hover:bg-emerald-300">{primaryCta.label}</Button>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
