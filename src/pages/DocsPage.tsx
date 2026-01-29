import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Layers,
  Menu,
  Search,
  Shield,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

type NavItem = { id: string; label: string; icon?: React.ReactNode };

const navItems: NavItem[] = [
  { id: "overview", label: "Overview" },
  { id: "quickstart", label: "Quickstart" },
  { id: "architecture", label: "Architecture" },
  { id: "agents", label: "Agents" },
  { id: "memory", label: "Memory" },
  { id: "tools", label: "Tools" },
  { id: "security", label: "Security" },
  { id: "roadmap", label: "Roadmap" },
  { id: "faq", label: "FAQ" },
];

const quickstartCommands = [
  { label: "Install dependencies", code: "npm install" },
  { label: "Start development", code: "npm run dev" },
  { label: "Build for production", code: "npm run build" },
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const handle = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(handle);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-lg bg-zinc-900 px-4 py-3 font-mono text-sm text-zinc-100">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded-md bg-zinc-800 p-1.5 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-700 hover:text-zinc-200 group-hover:opacity-100"
        aria-label="Copy code"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function DocsPage() {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState(navItems[0].id);
  const [navOpen, setNavOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredNavItems = useMemo(() => {
    if (!search.trim()) return navItems;
    const query = search.toLowerCase();
    return navItems.filter((item) =>
      item.label.toLowerCase().includes(query)
    );
  }, [search]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const elements = navItems
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: [0.1, 0.4, 0.7],
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-purple-600 font-semibold text-white">
                SB
              </div>
              <span className="hidden font-semibold text-zinc-900 sm:block">
                Second Brain
              </span>
            </Link>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
              Docs
            </span>
          </div>

          <div className="hidden flex-1 justify-center px-8 md:flex">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documentation..."
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-10 pr-12 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/thibautrey/second-brain-ai-syst"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 sm:flex"
            >
              GitHub
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Link
              to="/signup"
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Get Started
            </Link>
            <button
              type="button"
              onClick={() => setNavOpen(!navOpen)}
              className="rounded-lg border border-zinc-200 p-2 text-zinc-600 transition-colors hover:bg-zinc-50 lg:hidden"
              aria-label="Toggle menu"
            >
              {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      {navOpen && (
        <div className="fixed inset-0 top-16 z-40 bg-white p-4 lg:hidden">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-10 pr-4 text-sm"
              />
            </div>
          </div>
          <nav className="space-y-1">
            {filteredNavItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setNavOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeSection === item.id
                    ? "bg-violet-50 text-violet-700"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-12 py-8">
          {/* Sidebar */}
          <aside className="hidden w-56 shrink-0 lg:block">
            <nav className="sticky top-24 space-y-1">
              {filteredNavItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeSection === item.id
                      ? "bg-violet-50 text-violet-700"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  {item.label}
                  {activeSection === item.id && (
                    <ChevronRight className="ml-auto h-4 w-4" />
                  )}
                </a>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="min-w-0 flex-1 space-y-24 pb-24">

            {/* Overview Section */}
            <section id="overview" className="scroll-mt-24">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                  <Brain className="h-3.5 w-3.5" />
                  Personal AI Memory System
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
                  Second Brain Documentation
                </h1>
                <p className="max-w-2xl text-lg text-zinc-600">
                  A local-first memory layer that captures, organizes, and summarizes your life.
                  Built for privacy, fast retrieval, and calm autonomy.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="#quickstart"
                    className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                  >
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <a
                    href="#architecture"
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                  >
                    View Architecture
                  </a>
                </div>
              </div>

              <div className="mt-12 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    icon: BookOpen,
                    title: "Capture Everything",
                    description: "Continuous ingestion from conversations, tools, and devices.",
                  },
                  {
                    icon: Layers,
                    title: "Multi-Scale Summaries",
                    description: "Daily to yearly rollups with full traceability.",
                  },
                  {
                    icon: Shield,
                    title: "Privacy First",
                    description: "Local-first architecture. Your data stays yours.",
                  },
                ].map(({ icon: Icon, title, description }) => (
                  <div
                    key={title}
                    className="rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                      <Icon className="h-5 w-5 text-violet-600" />
                    </div>
                    <h3 className="mt-4 font-semibold text-zinc-900">{title}</h3>
                    <p className="mt-1 text-sm text-zinc-600">{description}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Quickstart Section */}
            <section id="quickstart" className="scroll-mt-24">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
                <Terminal className="h-4 w-4" />
                Quickstart
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">
                Get running in minutes
              </h2>
              <p className="mt-2 text-zinc-600">
                Clone the repository and start the development server with these commands.
              </p>

              <div className="mt-8 space-y-4">
                {quickstartCommands.map((cmd, i) => (
                  <div key={cmd.label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-zinc-700">{cmd.label}</span>
                    </div>
                    <CodeBlock code={cmd.code} />
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900">💡 Pro tip</p>
                <p className="mt-1 text-sm text-blue-700">
                  Use <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs">npm run dev:backend</code> and{" "}
                  <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs">npm run dev:frontend</code> in separate terminals for faster iteration.
                </p>
              </div>
            </section>

            {/* Architecture Section */}
            <section id="architecture" className="scroll-mt-24">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
                <Zap className="h-4 w-4" />
                Architecture
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">
                Modular services, fast recall
              </h2>
              <p className="mt-2 text-zinc-600">
                The system is built around a hybrid memory store with intelligent routing.
              </p>

              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 p-6">
                  <h3 className="font-semibold text-zinc-900">Request Flow</h3>
                  <ol className="mt-4 space-y-3">
                    {[
                      "Intent Router classifies input and filters noise",
                      "Memory Retrieval runs hybrid search with filters",
                      "LLM Router selects optimal model",
                      "Tool Execution runs safe external actions",
                      "Memory Manager stores results",
                    ].map((step, i) => (
                      <li key={step} className="flex items-start gap-3 text-sm text-zinc-600">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-700">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-zinc-200 p-5">
                    <h3 className="text-sm font-semibold text-zinc-900">Storage Layers</h3>
                    <div className="mt-3 space-y-2">
                      {[
                        { name: "PostgreSQL", role: "Metadata & audit logs" },
                        { name: "Weaviate", role: "Vector embeddings" },
                        { name: "Summaries", role: "Multi-scale rollups" },
                      ].map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-zinc-700">{item.name}</span>
                          <span className="text-zinc-500">{item.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-zinc-900 p-5">
                    <p className="text-xs font-medium text-zinc-400">API Example</p>
                    <pre className="mt-3 overflow-x-auto font-mono text-xs text-zinc-300">
                      <code>{`POST /api/memory/retrieve
{
  "query": "Decisions from last week",
  "timeRange": "week"
}`}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </section>

            {/* Agents Section */}
            <section id="agents" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-zinc-900">Agents</h2>
              <p className="mt-2 text-zinc-600">
                Specialized roles with a shared memory spine.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { title: "Intent Router", description: "Classifies inputs, identifies noise, routes work" },
                  { title: "Memory Manager", description: "Ingests interactions, runs embeddings, manages retention" },
                  { title: "Memory Retrieval", description: "Hybrid search across semantic + temporal signals" },
                  { title: "Summarization", description: "Daily to yearly rollups with traceability" },
                  { title: "Proactive Agent", description: "Twice-daily insights with health check cadence" },
                  { title: "Tool Execution", description: "Safely orchestrates external operations" },
                ].map((agent) => (
                  <div
                    key={agent.title}
                    className="rounded-lg border border-zinc-200 p-4 transition-colors hover:border-violet-200 hover:bg-violet-50/50"
                  >
                    <h3 className="font-medium text-zinc-900">{agent.title}</h3>
                    <p className="mt-1 text-sm text-zinc-600">{agent.description}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Memory Section */}
            <section id="memory" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-zinc-900">Memory</h2>
              <p className="mt-2 text-zinc-600">
                Summaries at every time scale, from daily to multi-year.
              </p>

              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 p-6">
                  <h3 className="font-semibold text-zinc-900">Time-Scale Cascade</h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["Daily", "3-day", "Weekly", "Bi-weekly", "Monthly", "Quarterly", "6-month", "Yearly"].map((scale) => (
                      <span
                        key={scale}
                        className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm text-zinc-700"
                      >
                        {scale}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 p-6">
                  <h3 className="font-semibold text-zinc-900">Memory Tags</h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["Goals", "Health", "Decisions", "Projects", "Relationships"].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-violet-100 px-3 py-1 text-sm font-medium text-violet-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-zinc-600">
                    Retention policies apply TTL and compression to keep only the most relevant context.
                  </p>
                </div>
              </div>
            </section>

            {/* Tools Section */}
            <section id="tools" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-zinc-900">Tools</h2>
              <p className="mt-2 text-zinc-600">
                Safe automation with traceable results.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  { title: "Sandboxing", description: "Guardrails, capability checks, and logging before execution" },
                  { title: "MCP Integrations", description: "Connect external services with secure adapters" },
                  { title: "Browser Automation", description: "Structured actions with snapshot capture" },
                  { title: "Command Orchestration", description: "Composable actions with strict schemas" },
                ].map((tool) => (
                  <div key={tool.title} className="rounded-lg border border-zinc-200 p-4">
                    <h3 className="font-medium text-zinc-900">{tool.title}</h3>
                    <p className="mt-1 text-sm text-zinc-600">{tool.description}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Security Section */}
            <section id="security" className="scroll-mt-24">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-zinc-900">Security</h2>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Zero telemetry
                </span>
              </div>
              <p className="mt-2 text-zinc-600">
                Local-first with strong privacy guarantees.
              </p>

              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 p-6">
                  <h3 className="font-semibold text-zinc-900">Privacy Principles</h3>
                  <ul className="mt-4 space-y-3">
                    {[
                      "End-to-end encryption for memory payloads",
                      "Audit log for every memory access",
                      "Local mode keeps all data on device",
                      "Role-based access controls for multi-user",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-zinc-600">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-zinc-900 p-6 text-white">
                  <h3 className="font-semibold">Compliance</h3>
                  <ul className="mt-4 space-y-3">
                    {[
                      "Self-hosting by default, no external telemetry",
                      "Granular memory deletion controls",
                      "Configurable tool allow-lists",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-zinc-300">
                        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Roadmap Section */}
            <section id="roadmap" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-zinc-900">Roadmap</h2>
              <p className="mt-2 text-zinc-600">
                What we're building next.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  { phase: "Phase 1", title: "Foundation", items: ["API scaffolding", "CRUD memory", "Basic retrieval"], status: "current" },
                  { phase: "Phase 2", title: "Memory Core", items: ["Embedding pipeline", "Summarization jobs", "Hybrid search"], status: "upcoming" },
                  { phase: "Phase 3", title: "Autonomy", items: ["Daily reflection", "Goal tracking", "Habit analyzer"], status: "upcoming" },
                  { phase: "Phase 4", title: "Tool Integration", items: ["Browser automation", "MCP integrations", "Safety policies"], status: "upcoming" },
                ].map((phase) => (
                  <div
                    key={phase.phase}
                    className={`rounded-xl border p-5 ${
                      phase.status === "current"
                        ? "border-violet-200 bg-violet-50"
                        : "border-zinc-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-zinc-500">{phase.phase}</span>
                      {phase.status === "current" && (
                        <span className="rounded-full bg-violet-200 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                          Current
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 font-semibold text-zinc-900">{phase.title}</h3>
                    <ul className="mt-3 space-y-1">
                      {phase.items.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm text-zinc-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* FAQ Section */}
            <section id="faq" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-zinc-900">FAQ</h2>
              <p className="mt-2 text-zinc-600">
                Common questions answered.
              </p>

              <div className="mt-8 space-y-3">
                {[
                  {
                    q: "Does any data leave my machine?",
                    a: "Not in local mode. You choose which providers run locally or in the cloud.",
                  },
                  {
                    q: "Can I delete or edit memories?",
                    a: "Yes. Every memory is editable and deletable with full audit tracking.",
                  },
                  {
                    q: "How are summaries generated?",
                    a: "Summaries are created on schedule with a traceable chain to source memories.",
                  },
                ].map((item) => (
                  <details
                    key={item.q}
                    className="group rounded-lg border border-zinc-200 bg-white"
                  >
                    <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-zinc-900">
                      {item.q}
                      <ChevronRight className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-90" />
                    </summary>
                    <p className="border-t border-zinc-100 px-4 py-3 text-sm text-zinc-600">
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-zinc-500">
              © 2026 Second Brain AI System. All rights reserved.
            </p>
            <div className="flex gap-4">
              <a
                href="https://github.com/thibautrey/second-brain-ai-syst"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-zinc-500 hover:text-zinc-700"
              >
                GitHub
              </a>
              <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-700">
                Home
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
