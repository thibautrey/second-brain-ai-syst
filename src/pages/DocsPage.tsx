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
  {
    label: "Clone the repository",
    code: "git clone https://github.com/thibautrey/second-brain-ai-syst && cd second-brain-ai-syst",
  },
  {
    label: "Run the interactive setup (checks deps, configures env, launches)",
    code: "./start.sh",
  },
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
    return navItems.filter((item) => item.label.toLowerCase().includes(query));
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
      },
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
              {navOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
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
                  A local-first memory system with a React UI and an Express
                  API. It captures chat (SSE), audio ingestion/continuous
                  listening, and tool activity, stores memories in Postgres, and
                  indexes embeddings in Weaviate when available.
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
                    title: "Capture & Ingest",
                    description:
                      "Chat via /api/chat (SSE), audio uploads and streams via /api/audio + WebSocket, and tool results stored in memory metadata when valuable.",
                  },
                  {
                    icon: Layers,
                    title: "Recall & Summarize",
                    description:
                      "Semantic search in Weaviate with Postgres text fallback, plus LLM-backed summaries with caching and time-scale support.",
                  },
                  {
                    icon: Shield,
                    title: "Automate & Assist",
                    description:
                      "Built-in tools (todos, notifications, tasks) and scheduled agents for reflections, proactive coaching, and memory cleanup.",
                  },
                ].map(({ icon: Icon, title, description }) => (
                  <div
                    key={title}
                    className="rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                      <Icon className="h-5 w-5 text-violet-600" />
                    </div>
                    <h3 className="mt-4 font-semibold text-zinc-900">
                      {title}
                    </h3>
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
                Configure your environment and run the backend + frontend
                locally. For the full local stack (Postgres, Weaviate, embedding
                service, code executor, backend, frontend), use Docker Compose.
              </p>

              <div className="mt-8 space-y-4">
                {quickstartCommands.map((cmd, i) => (
                  <div
                    key={cmd.label}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-zinc-700">
                        {cmd.label}
                      </span>
                    </div>
                    <CodeBlock code={cmd.code} />
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900">💡 Pro tip</p>
                <p className="mt-1 text-sm text-blue-700">
                  The{" "}
                  <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs">
                    start.sh
                  </code>{" "}
                  script checks dependencies, generates secrets, and offers
                  Docker or local mode. For manual control, run{" "}
                  <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs">
                    npm run backend:dev
                  </code>{" "}
                  and{" "}
                  <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs">
                    npm run dev
                  </code>{" "}
                  in separate terminals.
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
                The backend is an Express API with SSE chat streaming, a context
                builder for skills + memory retrieval, WebSockets for audio and
                notifications, and a cron-based scheduler for summaries and
                background agents.
              </p>

              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 p-6">
                  <h3 className="font-semibold text-zinc-900">Request Flow</h3>
                  <ol className="mt-4 space-y-3">
                    {[
                      "API receives chat or ingestion requests (REST + SSE)",
                      "Context builder loads skills, user profile, and memory search results",
                      "LLM Router selects provider/model and streams the response",
                      "Tool Executor runs built-in or generated tools when invoked",
                      "Intent Router stores valuable exchanges and the embedding scheduler indexes them (if embeddings are configured)",
                    ].map((step, i) => (
                      <li
                        key={step}
                        className="flex items-start gap-3 text-sm text-zinc-600"
                      >
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
                    <h3 className="text-sm font-semibold text-zinc-900">
                      Storage Layers
                    </h3>
                    <div className="mt-3 space-y-2">
                      {[
                        {
                          name: "PostgreSQL",
                          role: "Users, memories, summaries, todos, notifications, tools",
                        },
                        {
                          name: "Weaviate",
                          role: "Vector embeddings for semantic search (manual vectors)",
                        },
                        {
                          name: "Local filesystem",
                          role: "Audio samples, temp chunks, and model caches",
                        },
                      ].map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-zinc-700">
                            {item.name}
                          </span>
                          <span className="text-zinc-500">{item.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-zinc-900 p-5">
                    <p className="text-xs font-medium text-zinc-400">
                      API Example
                    </p>
                    <pre className="mt-3 overflow-x-auto font-mono text-xs text-zinc-300">
                      <code>{`GET /api/memories/search/semantic?query=decisions%20last%20week&limit=5`}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </section>

            {/* Agents Section */}
            <section id="agents" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-zinc-900">Agents</h2>
              <p className="mt-2 text-zinc-600">
                In this codebase an “agent” is usually a service plus a
                scheduler job (or an on-demand endpoint) that reads memories and
                writes results back to storage or notifications.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    title: "Intent Router",
                    description:
                      "Classifies exchanges, scores importance, and decides storage",
                  },
                  {
                    title: "Memory Manager",
                    description:
                      "Stores memories, handles pin/archive, and promotes long-term",
                  },
                  {
                    title: "Memory Retrieval",
                    description:
                      "Optimized Weaviate search with Postgres fallback",
                  },
                  {
                    title: "Summarization & Scheduler",
                    description:
                      "Cron jobs for summaries, embedding processing, and cleanup",
                  },
                  {
                    title: "Proactive Agent",
                    description:
                      "Twice-daily coaching + Mon/Thu health checks (notifications + AI instructions)",
                  },
                  {
                    title: "Continuous Listening",
                    description:
                      "WebSocket audio, VAD filtering, speaker ID, transcription",
                  },
                  {
                    title: "Tool Executor",
                    description:
                      "Runs built-in tools and generated tools through one runner",
                  },
                ].map((agent) => (
                  <div
                    key={agent.title}
                    className="rounded-lg border border-zinc-200 p-4 transition-colors hover:border-violet-200 hover:bg-violet-50/50"
                  >
                    <h3 className="font-medium text-zinc-900">{agent.title}</h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      {agent.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Memory Section */}
            <section id="memory" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-zinc-900">Memory</h2>
              <p className="mt-2 text-zinc-600">
                Memories live in Postgres with embeddings in Weaviate (when
                configured). Summaries are generated by the LLM and cached,
                while cleanup jobs prune low-value short-term data. If Weaviate
                or embeddings are unavailable, search falls back to Postgres
                text queries.
              </p>

              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 p-6">
                  <h3 className="font-semibold text-zinc-900">
                    Time-Scale Cascade
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      "Daily",
                      "3-day",
                      "Weekly",
                      "Bi-weekly",
                      "Monthly",
                      "Quarterly",
                      "6-month",
                      "Yearly",
                      "Multi-year",
                    ].map((scale) => (
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
                  <h3 className="font-semibold text-zinc-900">
                    Memory Metadata
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      "Tags",
                      "Entities",
                      "Importance",
                      "Pinned",
                      "Archived",
                    ].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-violet-100 px-3 py-1 text-sm font-medium text-violet-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-zinc-600">
                    Memories support tags, entities, importance scores, and
                    pin/archive status. Summaries link back to source memories.
                  </p>
                </div>
              </div>
            </section>

            {/* Tools Section */}
            <section id="tools" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-zinc-900">Tools</h2>
              <p className="mt-2 text-zinc-600">
                Centralized tool execution with schemas, validation, and
                persisted results for built-in and generated tools.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    title: "Productivity Tools",
                    description:
                      "Todos, goals, achievements, scheduled tasks, notifications",
                  },
                  {
                    title: "Web & Data",
                    description:
                      "HTTP requests (curl) and Brave Search integration",
                  },
                  {
                    title: "Execution Sandbox",
                    description:
                      "Python code executor service (network off by default)",
                  },
                  {
                    title: "Extensibility",
                    description:
                      "Dynamic tool generation; MCP and browser automation are stubs",
                  },
                ].map((tool) => (
                  <div
                    key={tool.title}
                    className="rounded-lg border border-zinc-200 p-4"
                  >
                    <h3 className="font-medium text-zinc-900">{tool.title}</h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      {tool.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Security Section */}
            <section id="security" className="scroll-mt-24">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-zinc-900">Security</h2>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Local-first
                </span>
              </div>
              <p className="mt-2 text-zinc-600">
                JWT-authenticated access, encrypted secrets, and local-first
                deployment with optional external LLM providers.
              </p>

              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 p-6">
                  <h3 className="font-semibold text-zinc-900">
                    Privacy Principles
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {[
                      "JWT auth for API + WebSocket connections",
                      "Per-user scoping via auth middleware",
                      "Secrets encrypted at rest (AES-256-GCM)",
                      "Audio stored on local filesystem (Docker volume)",
                    ].map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm text-zinc-600"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-zinc-900 p-6 text-white">
                  <h3 className="font-semibold">Operational Controls</h3>
                  <ul className="mt-4 space-y-3">
                    {[
                      "Configurable LLM providers/models per task",
                      "User-specific tool configs, secrets, and MCP entries",
                      "CRUD endpoints for memories, summaries, todos, notifications",
                    ].map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm text-zinc-300"
                      >
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
                This is a planning view. See agents.md and implementation notes
                for detailed milestones.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  {
                    phase: "Now",
                    title: "Core Platform",
                    items: [
                      "Auth + user profiles",
                      "Memory CRUD + summaries",
                      "Tool execution + notifications",
                    ],
                    status: "current",
                  },
                  {
                    phase: "Next",
                    title: "Memory Intelligence",
                    items: [
                      "Hybrid search improvements",
                      "Summarization quality",
                      "Smarter retrieval ranking",
                    ],
                    status: "upcoming",
                  },
                  {
                    phase: "After",
                    title: "Autonomy",
                    items: [
                      "Expanded background agents",
                      "Goal + habit depth",
                      "Proactive coaching refinement",
                    ],
                    status: "upcoming",
                  },
                  {
                    phase: "Later",
                    title: "Integrations",
                    items: [
                      "Marketplace tools",
                      "MCP execution layer",
                      "External provider catalog",
                    ],
                    status: "upcoming",
                  },
                  {
                    phase: "Ongoing",
                    title: "Polish & Deployment",
                    items: [
                      "Performance tuning",
                      "UI refinement",
                      "Dockerization",
                    ],
                    status: "upcoming",
                  },
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
                      <span className="text-xs font-medium text-zinc-500">
                        {phase.phase}
                      </span>
                      {phase.status === "current" && (
                        <span className="rounded-full bg-violet-200 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                          Current
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 font-semibold text-zinc-900">
                      {phase.title}
                    </h3>
                    <ul className="mt-3 space-y-1">
                      {phase.items.map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-2 text-sm text-zinc-600"
                        >
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
              <p className="mt-2 text-zinc-600">Common questions answered.</p>

              <div className="mt-8 space-y-3">
                {[
                  {
                    q: "Does it run fully locally?",
                    a: "Docker Compose runs Postgres, Weaviate, the embedding service, the code executor, backend, and frontend locally. LLM calls go to the provider you configure (including OpenAI-compatible local endpoints).",
                  },
                  {
                    q: "How are summaries and agents triggered?",
                    a: "The scheduler runs cron jobs for daily/weekly/monthly summaries, reflections, embedding processing, memory cleanup, and proactive checks. You can also call /api/summaries and /api/proactive manually.",
                  },
                  {
                    q: "Can I edit, archive, or delete memories?",
                    a: "Yes. /api/memories supports CRUD plus pin/archive, and /api/summaries supports create/update/delete.",
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
              <Link
                to="/"
                className="text-sm text-zinc-500 hover:text-zinc-700"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
