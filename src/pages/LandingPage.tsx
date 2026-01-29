import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  Calendar,
  Check,
  Clock,
  Cpu,
  Github,
  Heart,
  Mic,
  Monitor,
  Puzzle,
  Search,
  Server,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Wrench,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useTranslation } from "react-i18next";

export function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* Background gradients */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500/20 via-cyan-500/10 to-violet-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[600px] rounded-full bg-gradient-to-l from-violet-500/15 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-cyan-400 to-violet-500 text-lg shadow-lg shadow-emerald-500/25">
              🧠
            </div>
            <div>
              <p className="font-display text-lg font-bold leading-none tracking-tight">
                {t("landing.brandName")}
              </p>
              <p className="text-xs text-slate-400 tracking-wide">
                {t("landing.brandTagline")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/thibautrey/second-brain-ai-syst"
              target="_blank"
              rel="noreferrer"
              className="group hidden md:inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
            >
              <Github className="h-4 w-4" />
              <span>{t("landing.github")}</span>
            </a>
            <Link
              to="/docs"
              className="hidden text-sm text-slate-400 hover:text-white md:inline"
            >
              {t("landing.docs")}
            </Link>
            <a
              href="https://github.com/thibautrey/second-brain-ai-syst"
              target="_blank"
              rel="noreferrer"
            >
              <Button className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-semibold hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/25">
                <Github className="mr-2 h-4 w-4" />
                {t("landing.hero.viewSource")}
              </Button>
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="mx-auto max-w-5xl px-6 pt-20 pb-24 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {t("landing.hero.pill")}
          </div>

          <h1 className="font-display text-5xl font-bold leading-[1.1] tracking-tight text-white sm:text-6xl md:text-7xl">
            {t("landing.hero.titleLine1")}
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
              {t("landing.hero.titleLine2")}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300 leading-relaxed">
            {t("landing.hero.subtitle")}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="https://github.com/thibautrey/second-brain-ai-syst"
              target="_blank"
              rel="noreferrer"
            >
              <Button
                size="lg"
                className="bg-white text-slate-950 hover:bg-slate-100 font-semibold px-8 shadow-xl shadow-white/10"
              >
                <Github className="mr-2 h-4 w-4" />
                {t("landing.hero.viewSource")}
                <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
              </Button>
            </a>
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm text-slate-300 transition hover:border-white/30 hover:bg-white/5"
            >
              {t("landing.docs")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Quick highlights */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              {t("landing.hero.highlights.privacy")}
            </div>
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-cyan-400" />
              {t("landing.hero.highlights.local")}
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-violet-400" />
              {t("landing.hero.highlights.proactive")}
            </div>
          </div>
        </section>

        {/* What It Does Section */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="mb-12 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
              {t("landing.whatItDoes.kicker")}
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
              {t("landing.whatItDoes.title")}
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1: Continuous Memory */}
            <div className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-emerald-400/50 hover:bg-white/10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-400">
                <Brain className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-semibold text-white">
                {t("landing.whatItDoes.features.memory.title")}
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                {t("landing.whatItDoes.features.memory.description")}
              </p>
            </div>

            {/* Feature 2: AI Model Flexibility */}
            <div className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-blue-400/50 hover:bg-white/10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 text-blue-400">
                <Cpu className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-semibold text-white">
                {t("landing.whatItDoes.features.aiModels.title")}
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                {t("landing.whatItDoes.features.aiModels.description")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300">
                  <Server className="h-3 w-3" /> OpenAI
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300">
                  <Server className="h-3 w-3" /> Anthropic
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300">
                  <Server className="h-3 w-3" /> Gemini
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300">
                  <Monitor className="h-3 w-3" />{" "}
                  {t("landing.whatItDoes.features.aiModels.local")}
                </span>
              </div>
            </div>

            {/* Feature 3: Tools & Skills */}
            <div className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-orange-400/50 hover:bg-white/10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-500/5 text-orange-400">
                <Wrench className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-semibold text-white">
                {t("landing.whatItDoes.features.tools.title")}
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                {t("landing.whatItDoes.features.tools.description")}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                <Puzzle className="h-4 w-4 text-orange-400" />
                {t("landing.whatItDoes.features.tools.examples")}
              </div>
            </div>

            {/* Feature 4: Semantic Search */}
            <div className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-violet-400/50 hover:bg-white/10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 text-violet-400">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-semibold text-white">
                {t("landing.whatItDoes.features.search.title")}
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                {t("landing.whatItDoes.features.search.description")}
              </p>
            </div>

            {/* Feature 5: Voice Recognition */}
            <div className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-cyan-400/50 hover:bg-white/10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 text-cyan-400">
                <Mic className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-semibold text-white">
                {t("landing.whatItDoes.features.voice.title")}
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                {t("landing.whatItDoes.features.voice.description")}
              </p>
            </div>

            {/* Feature 6: Proactive Coach */}
            <div className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-pink-400/50 hover:bg-white/10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/20 to-pink-500/5 text-pink-400">
                <Heart className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-semibold text-white">
                {t("landing.whatItDoes.features.proactive.title")}
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                {t("landing.whatItDoes.features.proactive.description")}
              </p>
            </div>

            {/* Feature 7: Time-Scale Summaries */}
            <div className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-amber-400/50 hover:bg-white/10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-400">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-semibold text-white">
                {t("landing.whatItDoes.features.summaries.title")}
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                {t("landing.whatItDoes.features.summaries.description")}
              </p>
            </div>

            {/* Feature 8: Privacy First */}
            <div className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-emerald-400/50 hover:bg-white/10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-400">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-semibold text-white">
                {t("landing.whatItDoes.features.privacy.title")}
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                {t("landing.whatItDoes.features.privacy.description")}
              </p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="border-y border-white/5 bg-slate-900/50 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-12 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
                {t("landing.howItWorks.kicker")}
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
                {t("landing.howItWorks.title")}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-slate-400">
                {t("landing.howItWorks.subtitle")}
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-4">
              {/* Step 1 */}
              <div className="relative text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-2xl font-bold text-emerald-400">
                  1
                </div>
                <h3 className="font-display text-lg font-semibold text-white">
                  {t("landing.howItWorks.steps.capture.title")}
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  {t("landing.howItWorks.steps.capture.description")}
                </p>
                <div className="absolute right-0 top-8 hidden h-0.5 w-full bg-gradient-to-r from-emerald-400/50 to-transparent md:block md:w-1/2" />
              </div>

              {/* Step 2 */}
              <div className="relative text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-2xl font-bold text-cyan-400">
                  2
                </div>
                <h3 className="font-display text-lg font-semibold text-white">
                  {t("landing.howItWorks.steps.understand.title")}
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  {t("landing.howItWorks.steps.understand.description")}
                </p>
                <div className="absolute right-0 top-8 hidden h-0.5 w-full bg-gradient-to-r from-cyan-400/50 to-transparent md:block md:w-1/2" />
                <div className="absolute left-0 top-8 hidden h-0.5 w-1/2 bg-gradient-to-l from-cyan-400/50 to-transparent md:block" />
              </div>

              {/* Step 3 */}
              <div className="relative text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-violet-400/30 bg-violet-400/10 text-2xl font-bold text-violet-400">
                  3
                </div>
                <h3 className="font-display text-lg font-semibold text-white">
                  {t("landing.howItWorks.steps.remember.title")}
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  {t("landing.howItWorks.steps.remember.description")}
                </p>
                <div className="absolute right-0 top-8 hidden h-0.5 w-full bg-gradient-to-r from-violet-400/50 to-transparent md:block md:w-1/2" />
                <div className="absolute left-0 top-8 hidden h-0.5 w-1/2 bg-gradient-to-l from-violet-400/50 to-transparent md:block" />
              </div>

              {/* Step 4 */}
              <div className="relative text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-pink-400/30 bg-pink-400/10 text-2xl font-bold text-pink-400">
                  4
                </div>
                <h3 className="font-display text-lg font-semibold text-white">
                  {t("landing.howItWorks.steps.assist.title")}
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  {t("landing.howItWorks.steps.assist.description")}
                </p>
                <div className="absolute left-0 top-8 hidden h-0.5 w-1/2 bg-gradient-to-l from-pink-400/50 to-transparent md:block" />
              </div>
            </div>
          </div>
        </section>

        {/* Proactive Agent Highlight */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-900/20">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="p-8 md:p-12">
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-sm text-violet-300">
                  <Sparkles className="h-4 w-4" />
                  {t("landing.proactive.badge")}
                </div>
                <h2 className="mt-6 font-display text-3xl font-bold text-white">
                  {t("landing.proactive.title")}
                </h2>
                <p className="mt-4 text-slate-400 leading-relaxed">
                  {t("landing.proactive.description")}
                </p>

                <ul className="mt-8 space-y-4">
                  {[
                    {
                      icon: Heart,
                      label: t("landing.proactive.features.health"),
                    },
                    {
                      icon: Target,
                      label: t("landing.proactive.features.goals"),
                    },
                    {
                      icon: TrendingUp,
                      label: t("landing.proactive.features.habits"),
                    },
                    {
                      icon: Calendar,
                      label: t("landing.proactive.features.schedule"),
                    },
                  ].map(({ icon: Icon, label }) => (
                    <li
                      key={label}
                      className="flex items-center gap-3 text-slate-300"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
                        <Icon className="h-4 w-4 text-violet-400" />
                      </div>
                      {label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative hidden md:block">
                <div className="absolute inset-0 bg-gradient-to-l from-violet-500/10 to-transparent" />
                <div className="absolute right-8 top-1/2 -translate-y-1/2">
                  <div className="w-80 space-y-4">
                    {/* Sample notification cards */}
                    <div className="rounded-2xl border border-white/10 bg-slate-800/80 p-4 backdrop-blur">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-500/20 text-pink-400">
                          <Heart className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {t("landing.proactive.sample1.title")}
                          </p>
                          <p className="text-xs text-slate-400">
                            {t("landing.proactive.sample1.desc")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-800/80 p-4 backdrop-blur">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                          <Target className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {t("landing.proactive.sample2.title")}
                          </p>
                          <p className="text-xs text-slate-400">
                            {t("landing.proactive.sample2.desc")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-800/80 p-4 backdrop-blur">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                          <TrendingUp className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {t("landing.proactive.sample3.title")}
                          </p>
                          <p className="text-xs text-slate-400">
                            {t("landing.proactive.sample3.desc")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Time-Scale Summaries Section */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="mb-12 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
              {t("landing.timeline.kicker")}
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
              {t("landing.timeline.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              {t("landing.timeline.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {["daily", "weekly", "monthly", "quarterly", "yearly"].map(
              (key, i) => {
                const colors = ["emerald", "cyan", "violet", "pink", "amber"];
                return (
                  <div
                    key={key}
                    className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 transition hover:bg-white/10"
                  >
                    <p
                      className={`text-sm font-semibold text-${colors[i]}-400`}
                    >
                      {t(`landing.timeline.items.${key}.label`)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {t(`landing.timeline.items.${key}.detail`)}
                    </p>
                  </div>
                );
              },
            )}
          </div>
        </section>

        {/* Quick Start Section */}
        <section className="border-t border-white/5 bg-slate-900/50 py-24">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
              {t("landing.quickStart.kicker")}
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
              {t("landing.quickStart.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              {t("landing.quickStart.subtitle")}
            </p>

            <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-left">
              <div className="flex items-center gap-2 border-b border-white/10 bg-slate-800/50 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-red-500/60" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                <div className="h-3 w-3 rounded-full bg-green-500/60" />
                <span className="ml-2 text-xs text-slate-500">terminal</span>
              </div>
              <pre className="overflow-x-auto p-6 text-sm">
                <code className="text-slate-300">
                  <span className="text-slate-500"># Clone and start</span>
                  {"\n"}
                  <span className="text-emerald-400">$</span> git clone
                  https://github.com/thibautrey/second-brain-ai-syst
                  {"\n"}
                  <span className="text-emerald-400">$</span> cd
                  second-brain-ai-syst
                  {"\n"}
                  <span className="text-emerald-400">$</span> ./start.sh
                  {"\n\n"}
                  <span className="text-slate-500">
                    # Open http://localhost:5173
                  </span>
                </code>
              </pre>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="https://github.com/thibautrey/second-brain-ai-syst"
                target="_blank"
                rel="noreferrer"
              >
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-semibold hover:from-emerald-400 hover:to-cyan-400"
                >
                  <Github className="mr-2 h-4 w-4" />
                  {t("landing.quickStart.starRepo")}
                </Button>
              </a>
              <Link
                to="/docs"
                className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
              >
                {t("landing.docs")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Features Checklist */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-bold text-white">
                {t("landing.features.title")}
              </h2>
              <p className="mt-4 text-slate-400">
                {t("landing.features.subtitle")}
              </p>
            </div>

            <div className="grid gap-3">
              {[
                "voiceProfiles",
                "semanticSearch",
                "multiScaleSummaries",
                "proactiveCoaching",
                "noiseFilter",
                "toolExecution",
                "aiModelsFlexible",
                "customTools",
                "encryptedStorage",
                "localFirst",
              ].map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 px-4 py-3"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-400">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-sm text-slate-300">
                    {t(`landing.features.list.${feature}`)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-cyan-400 to-violet-500">
                🧠
              </div>
              <div>
                <p className="font-display font-bold text-white">
                  {t("landing.brandName")}
                </p>
                <p className="text-xs text-slate-400">
                  {t("landing.footer.tagline")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm text-slate-400">
              <a
                href="https://github.com/thibautrey/second-brain-ai-syst"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 transition hover:text-white"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
              <Link to="/docs" className="transition hover:text-white">
                {t("landing.docs")}
              </Link>
            </div>
          </div>

          <div className="mt-8 border-t border-white/5 pt-8 text-center text-sm text-slate-500">
            <p>{t("landing.footer.copyright")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
