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
import { useEffect, useMemo, useRef, useState } from "react";

import { Link } from "react-router-dom";

type NavItem = { id: string; label: string; icon?: React.ReactNode };

const navItems: NavItem[] = [
  { id: "overview", label: "Overview" },
  { id: "quickstart", label: "Quickstart" },
  { id: "architecture", label: "Architecture" },
  { id: "agents", label: "Agents" },
  { id: "memory", label: "Memory" },
  { id: "tools-skills", label: "Tools & Skills" },
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
    <div className="relative group">
      <pre className="px-4 py-3 overflow-x-auto font-mono text-sm rounded-lg bg-zinc-900 text-zinc-100">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded-md bg-zinc-800 p-1.5 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-700 hover:text-zinc-200 group-hover:opacity-100"
        aria-label="Copy code"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
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
        <div className="flex items-center justify-between h-16 px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/landing" className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 font-semibold text-white rounded-lg bg-linear-to-br from-violet-500 to-purple-600">
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

          <div className="justify-center flex-1 hidden px-8 md:flex">
            <div className="relative w-full max-w-md">
              <Search className="absolute w-4 h-4 -translate-y-1/2 left-3 top-1/2 text-zinc-400" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documentation..."
                className="w-full py-2 pl-10 pr-12 text-sm border rounded-lg border-zinc-200 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400 focus:border-violet-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100"
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
              className="p-2 transition-colors border rounded-lg border-zinc-200 text-zinc-600 hover:bg-zinc-50 lg:hidden"
              aria-label="Toggle menu"
            >
              {navOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      {navOpen && (
        <div className="fixed inset-0 z-40 p-4 bg-white top-16 lg:hidden">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute w-4 h-4 -translate-y-1/2 left-3 top-1/2 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full py-2 pl-10 pr-4 text-sm border rounded-lg border-zinc-200 bg-zinc-50"
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

      <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="flex gap-12 py-8">
          {/* Sidebar */}
          <aside className="hidden w-56 shrink-0 lg:block">
            <nav className="sticky space-y-1 top-24">
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
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </a>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 pb-24 space-y-24">
            {/* Overview Section */}
            <section id="overview" className="scroll-mt-24">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full bg-violet-100 text-violet-700">
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
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors rounded-lg bg-zinc-900 hover:bg-zinc-800"
                  >
                    Get Started
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  <a
                    href="#architecture"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors bg-white border rounded-lg border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  >
                    View Architecture
                  </a>
                </div>
              </div>

              <div className="grid gap-4 mt-12 sm:grid-cols-3">
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
                    className="p-5 transition-shadow bg-white border rounded-xl border-zinc-200 hover:shadow-md"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-100">
                      <Icon className="w-5 h-5 text-violet-600" />
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
                <Terminal className="w-4 h-4" />
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
                    className="p-4 border rounded-xl border-zinc-200 bg-zinc-50"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full bg-violet-100 text-violet-700">
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

              <div className="p-4 mt-6 border border-blue-200 rounded-xl bg-blue-50">
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
                <Zap className="w-4 h-4" />
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

              <div className="grid gap-6 mt-8 lg:grid-cols-2">
                <div className="p-6 border rounded-xl border-zinc-200">
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
                        <span className="flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full shrink-0 bg-zinc-100 text-zinc-700">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="space-y-4">
                  <div className="p-5 border rounded-xl border-zinc-200">
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
                          className="flex items-center justify-between px-3 py-2 text-sm rounded-lg bg-zinc-50"
                        >
                          <span className="font-medium text-zinc-700">
                            {item.name}
                          </span>
                          <span className="text-zinc-500">{item.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-zinc-900">
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

              <div className="grid gap-3 mt-8 sm:grid-cols-2 lg:grid-cols-3">
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
                    className="p-4 transition-colors border rounded-lg border-zinc-200 hover:border-violet-200 hover:bg-violet-50/50"
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

              <div className="grid gap-6 mt-8 lg:grid-cols-2">
                <div className="p-6 border rounded-xl border-zinc-200">
                  <h3 className="font-semibold text-zinc-900">
                    Time-Scale Cascade
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-4">
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
                        className="px-3 py-1 text-sm border rounded-full border-zinc-200 bg-zinc-50 text-zinc-700"
                      >
                        {scale}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-6 border rounded-xl border-zinc-200">
                  <h3 className="font-semibold text-zinc-900">
                    Memory Metadata
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {[
                      "Tags",
                      "Entities",
                      "Importance",
                      "Pinned",
                      "Archived",
                    ].map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 text-sm font-medium rounded-full bg-violet-100 text-violet-700"
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

            {/* Tools & Skills Section */}
            <section id="tools-skills" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-zinc-900">
                Tools & Skills
              </h2>
              <p className="mt-2 text-zinc-600">
                Understanding the difference between <strong>Tools</strong> and{" "}
                <strong>Skills</strong> is fundamental to the system
                architecture. Together, they form a powerful two-layer system:
                Tools provide the atomic capabilities, while Skills orchestrate
                them into intelligent workflows.
              </p>

              {/* Key Insight Box */}
              <div className="p-4 mt-6 border rounded-xl border-amber-200 bg-amber-50">
                <p className="text-sm font-medium text-amber-900">
                  💡 Key Insight
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Think of it like cooking: <strong>Tools</strong> are your
                  kitchen appliances (oven, mixer, knife) — each does one thing
                  well. <strong>Skills</strong> are your recipes — they tell you
                  which appliances to use, in what order, and how to combine
                  them to create a dish.
                </p>
              </div>

              {/* Comparison Table */}
              <div className="mt-8 overflow-hidden border rounded-xl border-zinc-200">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-left text-zinc-900">
                        Aspect
                      </th>
                      <th className="px-4 py-3 font-semibold text-left text-violet-700">
                        🔧 Tools
                      </th>
                      <th className="px-4 py-3 font-semibold text-left text-emerald-700">
                        📚 Skills
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-700">
                        Nature
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        Stateless Python functions
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        Human-readable instructions (Markdown)
                      </td>
                    </tr>
                    <tr className="bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium text-zinc-700">
                        Purpose
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        Execute a single, atomic action
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        Orchestrate complex multi-step workflows
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-700">
                        State
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        Stateless — no memory of previous calls
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        Context-aware — can reference memories & user data
                      </td>
                    </tr>
                    <tr className="bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium text-zinc-700">
                        Execution
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        Direct code execution in Python sandbox (~100ms)
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        AI interprets instructions and decides actions
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-700">
                        Output
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        Structured JSON data
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        AI-generated response + tool results
                      </td>
                    </tr>
                    <tr className="bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium text-zinc-700">
                        Creation
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        Built-in or AI-generated Python code
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        User-written or installed from hub
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-700">
                        Analogy
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        A hammer, a screwdriver, a thermometer
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        A recipe, a checklist, a procedure manual
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ==================== TOOLS DEEP DIVE ==================== */}
              <div className="mt-12">
                <h3 className="flex items-center gap-3 text-xl font-bold text-zinc-900">
                  <span className="flex items-center justify-center w-10 h-10 text-xl rounded-xl bg-violet-100">
                    🔧
                  </span>
                  Tools — Deep Dive
                </h3>
                <p className="mt-3 text-zinc-600">
                  Tools are the foundational layer of the system. Each tool is a
                  self-contained Python function that performs exactly one
                  action. Tools are designed to be:
                </p>

                {/* Tool Characteristics */}
                <div className="grid gap-4 mt-6 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    {
                      title: "Stateless",
                      description:
                        "No memory between calls. Same input always produces same output.",
                      icon: "🔄",
                    },
                    {
                      title: "Atomic",
                      description:
                        "Performs exactly one well-defined operation. No side workflows.",
                      icon: "⚛️",
                    },
                    {
                      title: "Sandboxed",
                      description:
                        "Runs in isolated Python environment for security. Limited modules.",
                      icon: "🔒",
                    },
                    {
                      title: "Fast",
                      description:
                        "Direct code execution, typically completes in 50-500ms.",
                      icon: "⚡",
                    },
                  ].map((char) => (
                    <div
                      key={char.title}
                      className="p-4 border rounded-xl border-violet-100 bg-violet-50/50"
                    >
                      <div className="text-2xl">{char.icon}</div>
                      <h4 className="mt-2 font-semibold text-zinc-900">
                        {char.title}
                      </h4>
                      <p className="mt-1 text-xs text-zinc-600">
                        {char.description}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Built-in Tools */}
                <div className="mt-8">
                  <h4 className="font-semibold text-zinc-900">
                    Built-in Tools
                  </h4>
                  <p className="mt-1 text-sm text-zinc-600">
                    The system ships with these ready-to-use tools:
                  </p>
                  <div className="grid gap-3 mt-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      {
                        name: "todo",
                        emoji: "✅",
                        desc: "Create, update, complete, and list tasks",
                        actions: "create, list, complete, delete, stats",
                      },
                      {
                        name: "notification",
                        emoji: "🔔",
                        desc: "Send alerts via browser or Pushover mobile",
                        actions: "send, schedule, dismiss, mark_read",
                      },
                      {
                        name: "scheduled_task",
                        emoji: "⏰",
                        desc: "Schedule future actions (cron-like)",
                        actions: "create, update, delete, execute_now",
                      },
                      {
                        name: "curl",
                        emoji: "🌐",
                        desc: "Make HTTP requests to any API",
                        actions: "GET, POST, PUT, DELETE, PATCH",
                      },
                      {
                        name: "memory_search",
                        emoji: "🧠",
                        desc: "Query user's stored memories",
                        actions: "search, get_context, get_facts",
                      },
                      {
                        name: "user_profile",
                        emoji: "👤",
                        desc: "Read/update permanent user profile",
                        actions: "get, update, delete_fields",
                      },
                      {
                        name: "goals",
                        emoji: "🎯",
                        desc: "Track long-term goals and progress",
                        actions: "create, update, get, list",
                      },
                      {
                        name: "achievements",
                        emoji: "🏆",
                        desc: "Track user achievements and milestones",
                        actions: "get, list, unlock",
                      },
                    ].map((tool) => (
                      <div
                        key={tool.name}
                        className="p-3 border rounded-lg border-zinc-200"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{tool.emoji}</span>
                          <code className="font-mono text-sm font-semibold text-violet-700">
                            {tool.name}
                          </code>
                        </div>
                        <p className="mt-1 text-xs text-zinc-600">
                          {tool.desc}
                        </p>
                        <p className="mt-2 text-[10px] text-zinc-400">
                          Actions: {tool.actions}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tool Execution Flow */}
                <div className="p-6 mt-8 border rounded-xl border-zinc-200">
                  <h4 className="font-semibold text-zinc-900">
                    Tool Execution Flow
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 mt-4 text-sm">
                    <span className="rounded-lg bg-blue-100 px-3 py-1.5 font-medium text-blue-700">
                      AI identifies need
                    </span>
                    <span className="text-zinc-400">→</span>
                    <span className="rounded-lg bg-violet-100 px-3 py-1.5 font-medium text-violet-700">
                      Tool Executor validates
                    </span>
                    <span className="text-zinc-400">→</span>
                    <span className="rounded-lg bg-amber-100 px-3 py-1.5 font-medium text-amber-700">
                      Python Sandbox runs code
                    </span>
                    <span className="text-zinc-400">→</span>
                    <span className="rounded-lg bg-emerald-100 px-3 py-1.5 font-medium text-emerald-700">
                      JSON result returned
                    </span>
                  </div>
                  <p className="mt-4 text-xs text-zinc-500">
                    The Code Executor Service runs Python in an isolated Docker
                    container with network disabled by default. Only whitelisted
                    modules (requests, json, datetime, etc.) are available.
                  </p>
                </div>

                {/* Custom Tool Generation */}
                <div className="mt-8">
                  <h4 className="font-semibold text-zinc-900">
                    Custom Tool Generation
                  </h4>
                  <p className="mt-1 text-sm text-zinc-600">
                    The AI can automatically generate new tools when needed. You
                    describe what you want, and the system creates Python code:
                  </p>
                  <div className="grid gap-4 mt-4 lg:grid-cols-2">
                    <div className="p-4 rounded-xl bg-zinc-900">
                      <p className="text-xs font-medium text-zinc-400">
                        You say:
                      </p>
                      <p className="mt-2 text-sm italic text-zinc-300">
                        "I need a tool to check if a website is online"
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-900">
                      <p className="text-xs font-medium text-zinc-400">
                        AI generates:
                      </p>
                      <pre className="mt-2 overflow-x-auto font-mono text-xs text-zinc-300">
                        {`import requests

def check_website(url: str) -> dict:
    try:
        r = requests.get(url, timeout=10)
        return {
            "online": True,
            "status": r.status_code,
            "response_time_ms": r.elapsed.total_seconds() * 1000
        }
    except Exception as e:
        return {"online": False, "error": str(e)}`}
                      </pre>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-zinc-500">
                    Generated tools are tested automatically before being saved.
                    They can require API keys (stored as encrypted secrets) and
                    support input/output JSON schemas for validation.
                  </p>
                </div>
              </div>

              {/* ==================== SKILLS DEEP DIVE ==================== */}
              <div className="mt-16">
                <h3 className="flex items-center gap-3 text-xl font-bold text-zinc-900">
                  <span className="flex items-center justify-center w-10 h-10 text-xl rounded-xl bg-emerald-100">
                    📚
                  </span>
                  Skills — Deep Dive
                </h3>
                <p className="mt-3 text-zinc-600">
                  Skills are the intelligence layer. They're written in natural
                  language (Markdown) and describe <em>how</em> to accomplish
                  goals by combining tools, memory, and AI reasoning. Skills are
                  designed to be:
                </p>

                {/* Skill Characteristics */}
                <div className="grid gap-4 mt-6 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    {
                      title: "Human-Readable",
                      description:
                        "Written in plain Markdown. Anyone can read, write, or modify them.",
                      icon: "📝",
                    },
                    {
                      title: "Context-Aware",
                      description:
                        "Can reference user preferences, memories, time, and situational data.",
                      icon: "🎯",
                    },
                    {
                      title: "Composable",
                      description:
                        "Combine multiple tools and even other skills into complex workflows.",
                      icon: "🧩",
                    },
                    {
                      title: "Adaptive",
                      description:
                        "AI interprets and adapts execution based on current situation.",
                      icon: "🔀",
                    },
                  ].map((char) => (
                    <div
                      key={char.title}
                      className="p-4 border rounded-xl border-emerald-100 bg-emerald-50/50"
                    >
                      <div className="text-2xl">{char.icon}</div>
                      <h4 className="mt-2 font-semibold text-zinc-900">
                        {char.title}
                      </h4>
                      <p className="mt-1 text-xs text-zinc-600">
                        {char.description}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Skill Structure */}
                <div className="mt-8">
                  <h4 className="font-semibold text-zinc-900">
                    Skill Structure
                  </h4>
                  <p className="mt-1 text-sm text-zinc-600">
                    Skills follow a consistent Markdown format with YAML
                    frontmatter:
                  </p>
                  <div className="p-4 mt-4 rounded-xl bg-zinc-900">
                    <pre className="overflow-x-auto font-mono text-xs text-zinc-300">
                      {`---
name: Order Status Monitor
description: Track package deliveries and notify on changes
version: 1.0.0
author: User
category: PRODUCTIVITY
---

# Order Status Monitor

## Purpose
Monitor pending orders and notify the user when delivery status changes.

## When to Activate
- User asks about order status
- Scheduled check every 6 hours
- User says "track my packages"

## Workflow

1. **Get pending orders** from memory
   - Search for memories tagged with "order" or "purchase"
   - Filter to orders without "delivered" status

2. **For each order**, check current status:
   - Use \`curl\` tool to call courier tracking API
   - Parse the response for status and ETA

3. **Compare with last known status**:
   - If status changed → Send notification with update
   - If ETA changed significantly → Alert user

4. **Update memory** with new status
   - Store current status for next comparison
   - Add timestamp of check

## Tools Used
- \`memory_search\` - Find order information
- \`curl\` - Call tracking APIs
- \`notification\` - Alert user of changes

## Notes
- Don't notify if status unchanged
- Batch multiple order updates into one notification
- Respect quiet hours (10 PM - 8 AM)`}
                    </pre>
                  </div>
                </div>

                {/* Skill Categories */}
                <div className="mt-8">
                  <h4 className="font-semibold text-zinc-900">
                    Skill Categories
                  </h4>
                  <div className="grid gap-3 mt-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      {
                        name: "Productivity",
                        emoji: "📋",
                        examples:
                          "Task automation, scheduling, reminders, meeting prep",
                      },
                      {
                        name: "Development",
                        emoji: "💻",
                        examples:
                          "Code review, deployment checks, documentation",
                      },
                      {
                        name: "Research",
                        emoji: "🔬",
                        examples:
                          "Information gathering, summarization, fact-checking",
                      },
                      {
                        name: "Communication",
                        emoji: "💬",
                        examples:
                          "Email drafting, message templates, notification rules",
                      },
                      {
                        name: "Health",
                        emoji: "❤️",
                        examples:
                          "Medication reminders, habit tracking, wellness checks",
                      },
                      {
                        name: "Finance",
                        emoji: "💰",
                        examples:
                          "Budget alerts, bill reminders, spending analysis",
                      },
                    ].map((cat) => (
                      <div
                        key={cat.name}
                        className="p-3 border rounded-lg border-zinc-200"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{cat.emoji}</span>
                          <span className="font-semibold text-emerald-700">
                            {cat.name}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {cat.examples}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Example Skills */}
                <div className="mt-8">
                  <h4 className="font-semibold text-zinc-900">
                    Real-World Skill Examples
                  </h4>
                  <div className="mt-4 space-y-4">
                    {/* Example 1 */}
                    <div className="p-5 border rounded-xl border-zinc-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🌤️</span>
                        <h5 className="font-semibold text-zinc-900">
                          Weather Alert Skill
                        </h5>
                      </div>
                      <div className="p-3 mt-3 rounded-lg bg-zinc-50">
                        <pre className="font-mono text-xs text-zinc-700">
                          {`Check the weather every day at 7 AM using the get_weather tool.

Only notify the user if:
• Snow is expected → Immediate alert
• Temperature below 0°C → Morning warning
• Rain probability > 70% → Umbrella reminder

Otherwise, stay completely silent. Don't disturb for nice weather.`}
                        </pre>
                      </div>
                      <p className="mt-3 text-xs text-zinc-500">
                        <strong>Tools used:</strong> get_weather,
                        scheduled_task, notification
                      </p>
                    </div>

                    {/* Example 2 */}
                    <div className="p-5 border rounded-xl border-zinc-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📅</span>
                        <h5 className="font-semibold text-zinc-900">
                          Meeting Preparation Skill
                        </h5>
                      </div>
                      <div className="p-3 mt-3 rounded-lg bg-zinc-50">
                        <pre className="font-mono text-xs text-zinc-700">
                          {`When I have a meeting in the next 30 minutes:

1. Get meeting details from calendar
2. Search my memories for:
   - Previous meetings with same participants
   - Related projects or topics mentioned
   - Any pending action items with attendees
3. Create a brief summary with:
   - Context from previous interactions
   - Suggested talking points
   - Open questions to address
4. Send notification 15 minutes before with the brief`}
                        </pre>
                      </div>
                      <p className="mt-3 text-xs text-zinc-500">
                        <strong>Tools used:</strong> calendar_events,
                        memory_search, notification, todo
                      </p>
                    </div>

                    {/* Example 3 */}
                    <div className="p-5 border rounded-xl border-zinc-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">💊</span>
                        <h5 className="font-semibold text-zinc-900">
                          Health Check-In Skill
                        </h5>
                      </div>
                      <div className="p-3 mt-3 rounded-lg bg-zinc-50">
                        <pre className="font-mono text-xs text-zinc-700">
                          {`Every Monday and Thursday at 10 AM, do a gentle health check:

1. Review my recent memories for health-related mentions:
   - Sleep quality complaints
   - Stress or anxiety mentions
   - Exercise or lack thereof
   - Eating habits

2. If concerning patterns detected:
   - Gently suggest specific actions
   - Reference what I mentioned before
   - Keep tone supportive, never demanding

3. Track positive patterns too:
   - Acknowledge good habits
   - Note improvements over time

Never be pushy. I can ignore these if I want.`}
                        </pre>
                      </div>
                      <p className="mt-3 text-xs text-zinc-500">
                        <strong>Tools used:</strong> memory_search,
                        scheduled_task, notification, user_profile
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ==================== HOW THEY WORK TOGETHER ==================== */}
              <div className="mt-16">
                <h3 className="flex items-center gap-3 text-xl font-bold text-zinc-900">
                  <span className="flex items-center justify-center w-10 h-10 text-xl rounded-xl bg-linear-to-br from-violet-100 to-emerald-100">
                    🔄
                  </span>
                  How They Work Together
                </h3>
                <p className="mt-3 text-zinc-600">
                  The real power comes from combining Skills and Tools. Here's a
                  detailed walkthrough:
                </p>

                <div className="p-6 mt-6 border rounded-xl border-zinc-200">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 rounded-full">
                      User Request
                    </span>
                    <p className="text-sm italic text-zinc-600">
                      "Let me know if it's going to snow this week"
                    </p>
                  </div>

                  <div className="mt-6 space-y-4">
                    {/* Step 1 */}
                    <div className="flex gap-4">
                      <div className="flex items-center justify-center w-8 h-8 text-sm font-bold rounded-full shrink-0 bg-violet-200 text-violet-700">
                        1
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900">
                          AI Identifies Relevant Skill
                        </p>
                        <p className="mt-1 text-sm text-zinc-600">
                          The system matches the request to the{" "}
                          <strong>Weather Alert Skill</strong> based on keywords
                          and intent. The skill's instructions are loaded into
                          context.
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-4">
                      <div className="flex items-center justify-center w-8 h-8 text-sm font-bold rounded-full shrink-0 bg-violet-200 text-violet-700">
                        2
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900">
                          Skill Interprets the Goal
                        </p>
                        <p className="mt-1 text-sm text-zinc-600">
                          AI reads the skill instructions and understands: user
                          wants snow alerts, scope is "this week", action is
                          notify only when snow is expected.
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-4">
                      <div className="flex items-center justify-center w-8 h-8 text-sm font-bold rounded-full shrink-0 bg-amber-200 text-amber-700">
                        3
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900">
                          AI Orchestrates Tools
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <code className="px-2 py-1 text-xs font-medium rounded bg-violet-100 text-violet-700">
                            get_weather(city, days=7)
                          </code>
                          <span className="text-zinc-400">→</span>
                          <code className="px-2 py-1 text-xs font-medium rounded bg-violet-100 text-violet-700">
                            analyze snow probability
                          </code>
                          <span className="text-zinc-400">→</span>
                          <code className="px-2 py-1 text-xs font-medium rounded bg-violet-100 text-violet-700">
                            scheduled_task.create()
                          </code>
                        </div>
                        <p className="mt-2 text-sm text-zinc-600">
                          Each tool executes in the Python sandbox and returns
                          structured data for the next step.
                        </p>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex gap-4">
                      <div className="flex items-center justify-center w-8 h-8 text-sm font-bold rounded-full shrink-0 bg-emerald-200 text-emerald-700">
                        ✓
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900">
                          Result Delivered
                        </p>
                        <p className="mt-1 text-sm text-zinc-600">
                          "I've set up a daily weather check. You'll only
                          receive a notification if snow is expected. The check
                          runs at 7 AM and covers the next 7 days."
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Visual Flow Diagram */}
                <div className="p-6 mt-8 rounded-xl bg-zinc-900">
                  <p className="text-xs font-medium text-zinc-400">
                    Execution Flow
                  </p>
                  <pre className="mt-4 overflow-x-auto font-mono text-xs text-zinc-300">
                    {`┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   User Input    │────▶│  Skill Matcher   │────▶│  Skill Loaded   │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌─────────────────────────────────┘
                        ▼
              ┌──────────────────┐
              │  AI Interprets   │
              │  Instructions    │
              └────────┬─────────┘
                       │
     ┌─────────────────┼─────────────────┐
     ▼                 ▼                 ▼
┌─────────┐     ┌─────────────┐    ┌────────────┐
│ Tool 1  │     │   Tool 2    │    │   Tool 3   │
│ Weather │────▶│  Analyze    │───▶│  Schedule  │
└─────────┘     └─────────────┘    └────────────┘
     │                 │                 │
     └─────────────────┴─────────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  Final Response  │
              │  to User         │
              └──────────────────┘`}
                  </pre>
                </div>
              </div>

              {/* ==================== WHEN TO USE WHAT ==================== */}
              <div className="mt-16">
                <h3 className="text-xl font-bold text-zinc-900">
                  When to Use What
                </h3>

                <div className="grid gap-6 mt-6 lg:grid-cols-2">
                  {/* Create a Tool */}
                  <div className="p-6 border-2 rounded-xl border-violet-200 bg-violet-50/30">
                    <h4 className="flex items-center gap-2 font-semibold text-violet-900">
                      <span>🔧</span> Create a Tool when:
                    </h4>
                    <ul className="mt-4 space-y-3 text-sm text-zinc-700">
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                        <span>
                          You need to interact with an{" "}
                          <strong>external API</strong> (weather, stocks,
                          tracking)
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                        <span>
                          The operation is{" "}
                          <strong>stateless and deterministic</strong>
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                        <span>
                          You need <strong>sandboxed execution</strong> for
                          security
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                        <span>
                          <strong>Performance is critical</strong> — direct code
                          is faster
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                        <span>
                          You want a <strong>reusable building block</strong>{" "}
                          for multiple skills
                        </span>
                      </li>
                    </ul>
                    <div className="p-3 mt-4 rounded-lg bg-violet-100">
                      <p className="text-xs font-medium text-violet-800">
                        Example: "Fetch current Bitcoin price" → Create a tool
                      </p>
                    </div>
                  </div>

                  {/* Create a Skill */}
                  <div className="p-6 border-2 rounded-xl border-emerald-200 bg-emerald-50/30">
                    <h4 className="flex items-center gap-2 font-semibold text-emerald-900">
                      <span>📚</span> Create a Skill when:
                    </h4>
                    <ul className="mt-4 space-y-3 text-sm text-zinc-700">
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>
                          You need to{" "}
                          <strong>orchestrate multiple tools</strong> in
                          sequence
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>
                          The workflow requires{" "}
                          <strong>context, memory, or user data</strong>
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>
                          Steps need <strong>AI interpretation</strong> and
                          decision-making
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>
                          The procedure should be{" "}
                          <strong>human-readable and editable</strong>
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>
                          You want to teach the AI{" "}
                          <strong>"how to do X" your way</strong>
                        </span>
                      </li>
                    </ul>
                    <div className="p-3 mt-4 rounded-lg bg-emerald-100">
                      <p className="text-xs font-medium text-emerald-800">
                        Example: "Alert me only if Bitcoin drops 10% in a day" →
                        Create a skill
                      </p>
                    </div>
                  </div>
                </div>

                {/* Decision Flowchart */}
                <div className="p-6 mt-8 border rounded-xl border-zinc-200">
                  <h4 className="font-semibold text-zinc-900">
                    Quick Decision Guide
                  </h4>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-500">
                        Is it a single API call or computation?
                      </span>
                      <span className="text-zinc-400">→</span>
                      <span className="px-2 py-1 font-medium rounded bg-violet-100 text-violet-700">
                        Tool
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-500">
                        Does it need to combine multiple actions?
                      </span>
                      <span className="text-zinc-400">→</span>
                      <span className="px-2 py-1 font-medium rounded bg-emerald-100 text-emerald-700">
                        Skill
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-500">
                        Should it adapt based on context/memory?
                      </span>
                      <span className="text-zinc-400">→</span>
                      <span className="px-2 py-1 font-medium rounded bg-emerald-100 text-emerald-700">
                        Skill
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-500">
                        Do you need custom Python code?
                      </span>
                      <span className="text-zinc-400">→</span>
                      <span className="px-2 py-1 font-medium rounded bg-violet-100 text-violet-700">
                        Tool
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-500">
                        Should non-developers be able to edit it?
                      </span>
                      <span className="text-zinc-400">→</span>
                      <span className="px-2 py-1 font-medium rounded bg-emerald-100 text-emerald-700">
                        Skill
                      </span>
                    </div>
                  </div>
                </div>
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

              <div className="grid gap-6 mt-8 lg:grid-cols-2">
                <div className="p-6 border rounded-xl border-zinc-200">
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

                <div className="p-6 text-white rounded-xl bg-zinc-900">
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

              <div className="grid gap-4 mt-8 sm:grid-cols-2">
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
                    className="bg-white border rounded-lg group border-zinc-200"
                  >
                    <summary className="flex items-center justify-between px-4 py-3 text-sm font-medium cursor-pointer text-zinc-900">
                      {item.q}
                      <ChevronRight className="w-4 h-4 transition-transform text-zinc-400 group-open:rotate-90" />
                    </summary>
                    <p className="px-4 py-3 text-sm border-t border-zinc-100 text-zinc-600">
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
        <div className="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8">
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
                to="/landing"
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
