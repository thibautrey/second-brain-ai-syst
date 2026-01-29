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
            <Link to="/" className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 font-semibold text-white rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
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
            <a
              href="/"
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Home
            </a>
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
                  A local-first memory system with continuous listening, semantic search, and AI-powered insights. Capture voice, text, and tool activity—all stored privately and indexed with embeddings.
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
                Clone the repository and run the setup script. It handles everything from dependency checks to Docker configuration.
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
            </section>

            {/* Architecture Section */}
            <section id="architecture" className="scroll-mt-24">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
                <Zap className="w-4 h-4" />
                Architecture
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">
                Modular, scalable, and local-first
              </h2>
              <p className="mt-2 text-zinc-600">
                The backend is an Express API with WebSockets for streaming and real-time audio. PostgreSQL stores memories and metadata. Weaviate (optional) indexes vector embeddings for semantic search. Everything runs in Docker or locally.
              </p>
            </section>

            {/* Agents Section */}
            <section id="agents" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-zinc-900">Agents</h2>
              <p className="mt-2 text-zinc-600">
                Autonomous systems that run on a schedule or on-demand to summarize memories, generate insights, track goals, and provide proactive coaching.
              </p>
            </section>

            {/* Memory Section */}
            <section id="memory" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-zinc-900">Memory</h2>
              <p className="mt-2 text-zinc-600">
                Memories are stored in PostgreSQL with vector embeddings in Weaviate. Multi-scale summaries from daily to yearly provide long-term context and insights.
              </p>
            </section>

            {/* Tools & Skills */}
            <section id="tools-skills" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-zinc-900">Tools & Skills</h2>
              <p className="mt-2 text-zinc-600">
                <strong>Tools</strong> are atomic Python functions for API calls, web browsing, and task execution. <strong>Skills</strong> are natural language workflows that combine tools and memory to accomplish complex goals.
              </p>
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
                JWT authentication, encrypted secrets (AES-256-GCM), optional local LLM models, and zero telemetry. Your data never leaves your infrastructure.
              </p>
            </section>

            {/* Roadmap */}
            <section id="roadmap" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-zinc-900">Roadmap</h2>
              <p className="mt-2 text-zinc-600">
                Phase 1: Foundation • Phase 2: Memory Intelligence • Phase 3: Autonomy • Phase 4: Tool Integration • Phase 5: Deployment
              </p>
            </section>

            {/* FAQ Section */}
            <section id="faq" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-zinc-900">FAQ</h2>
              <p className="mt-2 text-zinc-600">Common questions about Second Brain.</p>

              <div className="mt-8 space-y-3">
                {[
                  {
                    q: "Does it run fully locally?",
                    a: "Yes. Docker Compose runs all services locally. LLM calls go to your configured provider (including local models).",
                  },
                  {
                    q: "How are summaries triggered?",
                    a: "The scheduler runs cron jobs for daily/weekly/monthly summaries. You can also call endpoints manually.",
                  },
                  {
                    q: "Can I edit or delete memories?",
                    a: "Yes. Full CRUD API support including pin, archive, and delete operations.",
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

export default DocsPage;
