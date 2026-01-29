import {
  ArrowRight,
  Bell,
  BookOpen,
  Bot,
  Brain,
  Check,
  ChevronRight,
  Clock,
  Code,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  Globe,
  Heart,
  Key,
  Layers,
  Lock,
  Menu,
  MessageSquare,
  Mic,
  Monitor,
  PenTool,
  Search,
  Server,
  Settings,
  Shield,
  Sparkles,
  Target,
  Terminal,
  TrendingUp,
  User,
  Volume2,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

type NavItem = { id: string; label: string; icon?: React.ReactNode };

const navItems: NavItem[] = [
  { id: "overview", label: "Overview" },
  { id: "quickstart", label: "Quickstart" },
  { id: "features", label: "Features" },
  { id: "architecture", label: "Architecture" },
  { id: "agents", label: "Agents" },
  { id: "memory", label: "Memory System" },
  { id: "tools-skills", label: "Tools & Skills" },
  { id: "voice", label: "Voice & Audio" },
  { id: "notifications", label: "Notifications" },
  { id: "api", label: "API Reference" },
  { id: "configuration", label: "Configuration" },
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

const coreAgents = [
  {
    name: "Intent Router",
    description: "Classifies incoming user inputs and determines the appropriate system response. Handles classification of questions, commands, reflections, observations, and noise filtering.",
    icon: Target,
    color: "violet",
  },
  {
    name: "Memory Manager",
    description: "Handles short-term and long-term memory lifecycle including ingestion, vectorization, summarization, indexing, and garbage collection.",
    icon: Database,
    color: "blue",
  },
  {
    name: "Memory Retrieval",
    description: "Fetches relevant memories based on context using hybrid search combining vector similarity, keyword matching, and temporal filters.",
    icon: Search,
    color: "cyan",
  },
  {
    name: "Tool Executor",
    description: "Safely executes external operations including browser automation, HTTP API calls, MCP server invocation, and custom Python tools in a sandboxed environment.",
    icon: Wrench,
    color: "orange",
  },
  {
    name: "LLM Router",
    description: "Determines which AI model to use based on task complexity, optimizes for cost, and manages context windows across different providers.",
    icon: Cpu,
    color: "pink",
  },
  {
    name: "Summarization Agent",
    description: "Generates high-quality summaries at multiple time scales from daily to yearly, with bidirectional links to source segments.",
    icon: FileText,
    color: "emerald",
  },
  {
    name: "Noise Filter",
    description: "Distinguishes meaningful interactions from background noise using speaker analysis, semantic relevance assessment, and confidence scoring.",
    icon: Volume2,
    color: "amber",
  },
  {
    name: "Proactive Agent",
    description: "Analyzes memories proactively to provide health, productivity, and wellbeing suggestions. Runs twice daily with a dedicated health check mode.",
    icon: Heart,
    color: "red",
  },
];

const backgroundAgents = [
  { name: "Daily Reflection", schedule: "Every 24h", description: "Generates daily summaries and extracts key insights" },
  { name: "Weekly Summary", schedule: "Weekly", description: "Aggregates 7-day summaries and identifies trends" },
  { name: "Goal Tracker", schedule: "Continuous", description: "Monitors progress on long-term goals" },
  { name: "Habit Analyzer", schedule: "Daily", description: "Tracks recurring behaviors and measures consistency" },
  { name: "Knowledge Gap Detector", schedule: "Weekly", description: "Identifies missing information and suggests resources" },
];

const memoryTimeScales = [
  { label: "Daily", retention: "Full detail", description: "Complete interactions from the past 24 hours" },
  { label: "3-Day", retention: "High detail", description: "Compressed view of recent activity" },
  { label: "Weekly", retention: "Key events", description: "Important decisions and milestones" },
  { label: "Bi-weekly", retention: "Summaries", description: "Consolidated insights from two weeks" },
  { label: "Monthly", retention: "Themes", description: "Major topics and patterns" },
  { label: "Quarterly", retention: "Trends", description: "Long-term patterns and progress" },
  { label: "6-Month", retention: "Highlights", description: "Significant achievements and changes" },
  { label: "Yearly", retention: "Overview", description: "Annual review and reflections" },
  { label: "Multi-year", retention: "Life events", description: "Major life milestones and evolution" },
];

const builtInTools = [
  { name: "todo", description: "Manage tasks and to-do items", actions: "create, list, complete, delete" },
  { name: "notification", description: "Send notifications to user", actions: "send, schedule, dismiss" },
  { name: "scheduled_task", description: "Schedule future tasks", actions: "create, update, delete" },
  { name: "curl / http_request", description: "Make HTTP API calls", actions: "GET, POST, PUT, DELETE" },
  { name: "brave_search", description: "Search the web", actions: "search" },
  { name: "browser", description: "Automated web browsing", actions: "navigate, click, extract" },
  { name: "memory_search", description: "Search user's memories", actions: "search, get_context" },
  { name: "secrets", description: "Manage API keys securely", actions: "store, retrieve, delete" },
];

const apiEndpoints = [
  { method: "POST", path: "/api/auth/signup", description: "Create new user account" },
  { method: "POST", path: "/api/auth/signin", description: "Authenticate user and get JWT token" },
  { method: "GET", path: "/api/auth/me", description: "Get current user profile" },
  { method: "GET", path: "/api/memories", description: "List user memories with filters" },
  { method: "POST", path: "/api/memories", description: "Create a new memory" },
  { method: "GET", path: "/api/memories/search", description: "Semantic search across memories" },
  { method: "POST", path: "/api/chat", description: "Send message to AI assistant" },
  { method: "POST", path: "/api/notifications", description: "Create and send notifications" },
  { method: "GET", path: "/api/notifications", description: "List user notifications" },
  { method: "POST", path: "/api/speakers/enroll", description: "Enroll new speaker profile" },
  { method: "POST", path: "/api/speakers/identify", description: "Identify speaker from audio" },
  { method: "POST", path: "/api/proactive/analyze", description: "Run proactive analysis" },
  { method: "GET", path: "/api/proactive/status", description: "Get proactive agent status" },
  { method: "POST", path: "/api/tools/execute", description: "Execute a tool with parameters" },
  { method: "GET", path: "/api/tools", description: "List available tools" },
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
                  Personal AI Cognitive Operating System
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
                  Second Brain Documentation
                </h1>
                <p className="max-w-2xl text-lg text-zinc-600">
                  An AI-powered personal cognitive operating system that captures, organizes, summarizes, and recalls information to augment human memory and decision-making. Built with privacy-first principles.
                </p>
                
                {/* Key Benefits */}
                <div className="grid gap-4 mt-6 sm:grid-cols-3">
                  <div className="flex items-center gap-3 p-3 border rounded-lg border-zinc-200 bg-zinc-50">
                    <Shield className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-medium text-zinc-700">100% Private & Local</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg border-zinc-200 bg-zinc-50">
                    <Zap className="w-5 h-5 text-violet-600" />
                    <span className="text-sm font-medium text-zinc-700">AI-Powered Insights</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg border-zinc-200 bg-zinc-50">
                    <Mic className="w-5 h-5 text-cyan-600" />
                    <span className="text-sm font-medium text-zinc-700">Voice Recognition</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-4">
                  <a
                    href="#quickstart"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors rounded-lg bg-zinc-900 hover:bg-zinc-800"
                  >
                    Get Started
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  <a
                    href="#features"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors bg-white border rounded-lg border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  >
                    Explore Features
                  </a>
                  <a
                    href="https://github.com/thibautrey/second-brain-ai-syst"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors bg-white border rounded-lg border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  >
                    View on GitHub
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* What it does */}
                <div className="p-6 mt-6 border rounded-xl border-zinc-200 bg-zinc-50">
                  <h2 className="text-lg font-semibold text-zinc-900">What Second Brain Does</h2>
                  <ul className="grid gap-3 mt-4 sm:grid-cols-2">
                    <li className="flex items-start gap-2 text-sm text-zinc-600">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                      <span><strong>Continuously captures</strong> information from voice, text, and tool interactions</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-zinc-600">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                      <span><strong>Organizes & structures</strong> data with semantic understanding</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-zinc-600">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                      <span><strong>Generates summaries</strong> at multiple time scales (daily → yearly)</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-zinc-600">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                      <span><strong>Enables retrieval</strong> through semantic search and chat</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-zinc-600">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                      <span><strong>Provides coaching</strong> for health, productivity, and goals</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-zinc-600">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                      <span><strong>Maintains privacy</strong> with local-first, encrypted architecture</span>
                    </li>
                  </ul>
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
                Get Running in Under 5 Minutes
              </h2>
              <p className="mt-2 text-zinc-600">
                The interactive setup script handles everything from dependency checks to Docker configuration. Just two commands to get started.
              </p>

              {/* Prerequisites */}
              <div className="p-4 mt-6 border rounded-xl border-amber-200 bg-amber-50">
                <h3 className="font-semibold text-amber-900">Prerequisites</h3>
                <ul className="mt-2 space-y-1 text-sm text-amber-800">
                  <li>• <strong>Docker</strong> and <strong>Docker Compose</strong> installed</li>
                  <li>• <strong>Node.js 18+</strong> (for local development)</li>
                  <li>• <strong>Git</strong> for cloning the repository</li>
                </ul>
              </div>

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

              {/* Access Points */}
              <div className="p-4 mt-6 border rounded-xl border-emerald-200 bg-emerald-50">
                <h3 className="font-semibold text-emerald-900">🎉 You're Up!</h3>
                <p className="mt-2 text-sm text-emerald-800">
                  Open <a href="http://localhost:5173" className="font-medium underline">http://localhost:5173</a> to access your Second Brain dashboard.
                </p>
                <div className="grid gap-2 mt-3 text-sm text-emerald-800 sm:grid-cols-2">
                  <div><strong>Frontend:</strong> http://localhost:5173</div>
                  <div><strong>Backend API:</strong> http://localhost:3000</div>
                  <div><strong>PostgreSQL:</strong> localhost:5432</div>
                  <div><strong>Weaviate:</strong> http://localhost:8080</div>
                </div>
              </div>

              {/* What's Included */}
              <h3 className="mt-8 text-lg font-semibold text-zinc-900">What You Get Immediately</h3>
              <div className="grid gap-4 mt-4 sm:grid-cols-2">
                <div className="p-4 border rounded-lg border-zinc-200 bg-white">
                  <h4 className="font-medium text-zinc-900">✅ Core Features (No API keys)</h4>
                  <ul className="mt-2 space-y-1 text-sm text-zinc-600">
                    <li>• Audio training & speaker recognition</li>
                    <li>• Voice profile creation</li>
                    <li>• Memory storage & semantic search</li>
                    <li>• User authentication</li>
                    <li>• Encrypted database</li>
                  </ul>
                </div>
                <div className="p-4 border rounded-lg border-zinc-200 bg-white">
                  <h4 className="font-medium text-zinc-900">🤖 AI Features (Optional setup)</h4>
                  <ul className="mt-2 space-y-1 text-sm text-zinc-600">
                    <li>• <strong>Local AI:</strong> Run <code className="px-1 text-xs rounded bg-zinc-100">./scripts/setup-local-llm.sh</code></li>
                    <li>• <strong>Cloud AI:</strong> Configure OpenAI/Anthropic in Settings</li>
                    <li>• Chat with memory context</li>
                    <li>• Automatic summarization</li>
                    <li>• Proactive coaching</li>
                  </ul>
                </div>
              </div>

              {/* Alternative Setup */}
              <h3 className="mt-8 text-lg font-semibold text-zinc-900">Alternative: Manual Setup</h3>
              <p className="mt-2 text-sm text-zinc-600">
                For more control over the setup process:
              </p>
              <div className="mt-4">
                <CodeBlock code={`# 1. Copy environment template
cp .env.example .env

# 2. Edit .env with your configuration
# Set DATABASE_URL, JWT_SECRET, and optionally OPENAI_API_KEY

# 3. Install dependencies
npm install

# 4. Start with Docker Compose
docker compose up --build

# Or start services individually:
# Terminal 1: npm run backend:dev
# Terminal 2: npm run dev`} />
              </div>
            </section>

            {/* Features Section */}
            <section id="features" className="scroll-mt-24">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
                <Sparkles className="w-4 h-4" />
                Features
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">
                What Second Brain Can Do
              </h2>
              <p className="mt-2 text-zinc-600">
                A comprehensive personal AI system designed to capture, organize, and retrieve information to augment your memory and decision-making.
              </p>

              <div className="grid gap-4 mt-8 sm:grid-cols-2">
                {[
                  { icon: Brain, label: "Continuous Memory", desc: "Captures interactions and structures them automatically" },
                  { icon: Mic, label: "Voice Recognition", desc: "ECAPA-TDNN speaker recognition, fully local" },
                  { icon: Search, label: "Semantic Search", desc: "Find memories by meaning using vector embeddings" },
                  { icon: Shield, label: "Privacy-First", desc: "Self-hosted, encrypted storage, zero telemetry" },
                  { icon: Clock, label: "Multi-Scale Summaries", desc: "From daily to yearly timescales" },
                  { icon: Bot, label: "Autonomous Agents", desc: "Background processes for reflection and goals" },
                  { icon: Heart, label: "Proactive Coaching", desc: "AI that analyzes patterns for health & productivity" },
                  { icon: Wrench, label: "Tool Integration", desc: "Browser automation, APIs, custom tools" },
                  { icon: MessageSquare, label: "Smart Chat", desc: "Conversational interface with memory context" },
                  { icon: Bell, label: "Notifications", desc: "Multi-channel alerts including Pushover support" },
                  { icon: Cpu, label: "Flexible AI Models", desc: "OpenAI, Anthropic, Gemini, or local models" },
                  { icon: Globe, label: "Telegram Integration", desc: "Chat and control via Telegram bot" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex gap-3 p-4 border rounded-lg border-zinc-200 bg-zinc-50">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0 bg-violet-100 text-violet-600">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900">{label}</h3>
                      <p className="text-xs text-zinc-600">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Architecture Section */}
            <section id="architecture" className="scroll-mt-24">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
                <Layers className="w-4 h-4" />
                Architecture
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">
                Modular, Scalable, and Local-First
              </h2>
              <p className="mt-2 text-zinc-600">
                Built on a modern microservices architecture with clear separation of concerns. Every component is designed to work independently while integrating seamlessly.
              </p>

              {/* Technology Stack */}
              <div className="p-6 mt-8 border rounded-xl border-zinc-200 bg-zinc-50">
                <h3 className="text-lg font-semibold text-zinc-900">Technology Stack</h3>
                <div className="grid gap-4 mt-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { layer: "Frontend", tech: "React 18, TypeScript, Tailwind CSS", icon: Monitor },
                    { layer: "Backend", tech: "Node.js 18, Express, TypeScript", icon: Server },
                    { layer: "Database", tech: "PostgreSQL 14+", icon: Database },
                    { layer: "Vector DB", tech: "Weaviate (semantic search)", icon: Search },
                    { layer: "ORM", tech: "Prisma", icon: Code },
                    { layer: "LLM", tech: "OpenAI, Anthropic, Local models", icon: Cpu },
                  ].map(({ layer, tech, icon: Icon }) => (
                    <div key={layer} className="flex items-start gap-3">
                      <Icon className="w-5 h-5 mt-0.5 text-violet-600" />
                      <div>
                        <span className="text-sm font-medium text-zinc-900">{layer}</span>
                        <p className="text-xs text-zinc-600">{tech}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Request Flow */}
              <div className="p-6 mt-6 border rounded-xl border-zinc-200 bg-zinc-50">
                <h3 className="text-lg font-semibold text-zinc-900">Request Flow</h3>
                <div className="mt-4 overflow-x-auto">
                  <CodeBlock code={`User Input → Intent Router → Memory Retrieval → LLM Router → Tool Executor
     ↓              ↓              ↓              ↓              ↓
  Classify    Fetch Context   Select Model   Execute Tools   Store Results
     ↓              ↓              ↓              ↓              ↓
           ← ← ← ← ← ← ← Memory Manager ← ← ← ← ← ← ← ← ←
                              ↓
                     Response to User`} />
                </div>
              </div>

              {/* Project Structure */}
              <div className="p-6 mt-6 border rounded-xl border-zinc-200 bg-zinc-50">
                <h3 className="text-lg font-semibold text-zinc-900">Project Structure</h3>
                <div className="mt-4">
                  <CodeBlock code={`second-brain-ai-syst/
├── backend/                 # Node.js + TypeScript services
│   ├── services/           # Core agents and business logic
│   ├── controllers/        # API route handlers
│   ├── middlewares/        # Express middleware (auth, etc.)
│   ├── prisma/             # Database schema and migrations
│   └── utils/              # Helper functions
├── src/                    # React + TypeScript frontend
│   ├── components/         # UI components
│   ├── pages/              # Page components
│   ├── hooks/              # Custom React hooks
│   └── services/           # API client services
├── landing-docs/           # Documentation website (you're here!)
├── docker/                 # Docker configuration
├── scripts/                # Setup and utility scripts
└── docs/                   # Markdown documentation`} />
                </div>
              </div>
            </section>

            {/* Agents Section */}
            <section id="agents" className="scroll-mt-24">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
                <Bot className="w-4 h-4" />
                Agents
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">
                Intelligent Autonomous Systems
              </h2>
              <p className="mt-2 text-zinc-600">
                Second Brain uses a multi-agent architecture where specialized agents handle different aspects of memory management, reasoning, and automation.
              </p>

              {/* Core Agents */}
              <h3 className="mt-8 text-lg font-semibold text-zinc-900">Core Agents</h3>
              <div className="grid gap-4 mt-4 sm:grid-cols-2">
                {coreAgents.map((agent) => (
                  <div key={agent.name} className="p-4 border rounded-xl border-zinc-200 bg-white">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${agent.color}-100 text-${agent.color}-600`}>
                        <agent.icon className="w-5 h-5" />
                      </div>
                      <h4 className="font-semibold text-zinc-900">{agent.name}</h4>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600">{agent.description}</p>
                  </div>
                ))}
              </div>

              {/* Background Agents */}
              <h3 className="mt-8 text-lg font-semibold text-zinc-900">Background Agents</h3>
              <p className="mt-2 text-sm text-zinc-600">
                These agents run autonomously on schedules to maintain and enhance your memory system.
              </p>
              <div className="mt-4 overflow-hidden border rounded-xl border-zinc-200">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 font-medium text-left text-zinc-900">Agent</th>
                      <th className="px-4 py-3 font-medium text-left text-zinc-900">Schedule</th>
                      <th className="px-4 py-3 font-medium text-left text-zinc-900">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {backgroundAgents.map((agent) => (
                      <tr key={agent.name}>
                        <td className="px-4 py-3 font-medium text-zinc-900">{agent.name}</td>
                        <td className="px-4 py-3 text-zinc-600">{agent.schedule}</td>
                        <td className="px-4 py-3 text-zinc-600">{agent.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Proactive Agent Highlight */}
              <div className="p-6 mt-8 border-2 border-violet-200 rounded-xl bg-violet-50">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-violet-600" />
                  <h4 className="font-semibold text-violet-900">Proactive Agent</h4>
                  <span className="rounded-full bg-violet-200 px-2 py-0.5 text-xs font-medium text-violet-700">
                    Health-Focused
                  </span>
                </div>
                <p className="mt-2 text-sm text-violet-800">
                  A unique AI coach that analyzes your memories to provide gentle, non-invasive suggestions for health, productivity, and wellbeing. Runs twice daily (8 AM and 6 PM) with dedicated health checks on Mondays and Thursdays.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {["Physical Health", "Mental Wellbeing", "Productivity", "Goals", "Habits", "Relationships", "Learning"].map((cat) => (
                    <span key={cat} className="px-2 py-1 text-xs font-medium rounded-full bg-violet-100 text-violet-700">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Memory Section */}
            <section id="memory" className="scroll-mt-24">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
                <Database className="w-4 h-4" />
                Memory System
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">
                Multi-Scale Memory Architecture
              </h2>
              <p className="mt-2 text-zinc-600">
                Memories are organized in a hierarchical system with progressive summarization, ensuring both detailed recall and high-level insights across different time horizons.
              </p>

              {/* Short-term vs Long-term */}
              <div className="grid gap-6 mt-8 md:grid-cols-2">
                <div className="p-6 border rounded-xl border-zinc-200 bg-white">
                  <h3 className="font-semibold text-zinc-900">Short-term Memory</h3>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500" />
                      24h to 7 days retention
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500" />
                      Full fidelity storage
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500" />
                      All meaningful interactions captured
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500" />
                      Vectorized in Weaviate for semantic search
                    </li>
                  </ul>
                </div>
                <div className="p-6 border rounded-xl border-zinc-200 bg-white">
                  <h3 className="font-semibold text-zinc-900">Long-term Memory</h3>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500" />
                      Progressive summarization from short-term
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500" />
                      9 time scales: daily to multi-year
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500" />
                      Tagged with topics, entities, sentiment
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500" />
                      Bidirectional links to source interactions
                    </li>
                  </ul>
                </div>
              </div>

              {/* Time Scales */}
              <h3 className="mt-8 text-lg font-semibold text-zinc-900">Time Scale Summaries</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Memories are automatically summarized at multiple time scales for efficient retrieval and insights.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {memoryTimeScales.map((scale, i) => {
                  const colors = ["emerald", "cyan", "blue", "violet", "purple", "pink", "rose", "orange", "amber"];
                  return (
                    <div key={scale.label} className="p-3 border rounded-lg border-zinc-200 bg-white">
                      <span className={`text-xs font-semibold text-${colors[i % colors.length]}-600`}>{scale.label}</span>
                      <p className="text-xs text-zinc-600">{scale.description}</p>
                    </div>
                  );
                })}
              </div>

              {/* Hybrid Search */}
              <div className="p-6 mt-8 border rounded-xl border-zinc-200 bg-zinc-50">
                <h3 className="text-lg font-semibold text-zinc-900">Hybrid Search</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Memory retrieval combines multiple search strategies for optimal results:
                </p>
                <div className="grid gap-4 mt-4 sm:grid-cols-3">
                  {[
                    { name: "Vector Similarity", desc: "Find semantically similar memories using embeddings" },
                    { name: "Keyword Match", desc: "Exact and fuzzy text matching for precision" },
                    { name: "Temporal Filters", desc: "Time-based queries for historical context" },
                  ].map((method) => (
                    <div key={method.name} className="p-3 bg-white border rounded-lg border-zinc-200">
                      <h4 className="text-sm font-medium text-zinc-900">{method.name}</h4>
                      <p className="text-xs text-zinc-600">{method.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Tools & Skills */}
            <section id="tools-skills" className="scroll-mt-24">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
                <Wrench className="w-4 h-4" />
                Tools & Skills
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">
                Extend Capabilities with Tools and Skills
              </h2>
              <p className="mt-2 text-zinc-600">
                The system distinguishes between <strong>Tools</strong> (atomic actions) and <strong>Skills</strong> (complex workflows) to provide powerful automation capabilities.
              </p>

              {/* Comparison Table */}
              <div className="mt-8 overflow-hidden border rounded-xl border-zinc-200">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 font-medium text-left text-zinc-900">Aspect</th>
                      <th className="px-4 py-3 font-medium text-left text-zinc-900">Tools</th>
                      <th className="px-4 py-3 font-medium text-left text-zinc-900">Skills</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-900">Nature</td>
                      <td className="px-4 py-3 text-zinc-600">Stateless Python functions</td>
                      <td className="px-4 py-3 text-zinc-600">Human-readable instructions</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-900">Format</td>
                      <td className="px-4 py-3 text-zinc-600">Code (Python)</td>
                      <td className="px-4 py-3 text-zinc-600">Natural language (Markdown)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-900">Purpose</td>
                      <td className="px-4 py-3 text-zinc-600">Execute atomic actions</td>
                      <td className="px-4 py-3 text-zinc-600">Orchestrate complex workflows</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-900">Execution</td>
                      <td className="px-4 py-3 text-zinc-600">Direct code execution (~100ms)</td>
                      <td className="px-4 py-3 text-zinc-600">AI interprets and follows (seconds)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-900">Example</td>
                      <td className="px-4 py-3 text-zinc-600"><code className="px-1 bg-zinc-100 rounded">get_weather("Paris")</code></td>
                      <td className="px-4 py-3 text-zinc-600">"Alert me if it will snow"</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Built-in Tools */}
              <h3 className="mt-8 text-lg font-semibold text-zinc-900">Built-in Tools</h3>
              <div className="grid gap-3 mt-4 sm:grid-cols-2">
                {builtInTools.map((tool) => (
                  <div key={tool.name} className="p-4 border rounded-lg border-zinc-200 bg-white">
                    <code className="px-2 py-1 text-sm font-medium rounded bg-zinc-100 text-zinc-900">{tool.name}</code>
                    <p className="mt-2 text-sm text-zinc-600">{tool.description}</p>
                    <p className="mt-1 text-xs text-zinc-500">Actions: {tool.actions}</p>
                  </div>
                ))}
              </div>

              {/* Custom Tools */}
              <div className="p-6 mt-8 border rounded-xl border-zinc-200 bg-zinc-50">
                <h3 className="text-lg font-semibold text-zinc-900">Custom Tools</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  The AI can generate custom Python tools dynamically to perform specialized tasks. Tools are executed in a sandboxed environment for security.
                </p>
                <div className="mt-4">
                  <CodeBlock code={`# Example: Custom weather tool (generated by AI)
import requests
import os

def get_weather(city: str) -> dict:
    """Get current weather for a city."""
    api_key = os.environ.get('OPENWEATHERMAP_API_KEY')
    url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric"
    response = requests.get(url, timeout=10)
    data = response.json()
    return {
        "city": city,
        "temperature": data["main"]["temp"],
        "description": data["weather"][0]["description"]
    }`} />
                </div>
              </div>

              {/* Skill Example */}
              <div className="p-6 mt-6 border rounded-xl border-zinc-200 bg-zinc-50">
                <h3 className="text-lg font-semibold text-zinc-900">Skill Example</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Skills are natural language workflows that the AI interprets and executes using available tools.
                </p>
                <div className="mt-4">
                  <CodeBlock code={`# Weather Alert Skill (Markdown)
---
name: Weather Alert Monitor
description: Monitor weather and notify about important changes
---

## Purpose
Check the weather regularly and alert the user about significant conditions.

## Workflow
1. **Get current location** using the user's configured home location
2. **Check weather** using the \`get_weather\` tool for that location
3. **Analyze conditions**:
   - If snow is expected → Notify immediately
   - If temperature drops below 0°C → Send morning alert
   - If heavy rain expected → Remind to take umbrella
4. **Send notification** only if relevant conditions are detected`} />
                </div>
              </div>
            </section>

            {/* Voice & Audio Section */}
            <section id="voice" className="scroll-mt-24">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
                <Mic className="w-4 h-4" />
                Voice & Audio
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">
                Advanced Voice Recognition
              </h2>
              <p className="mt-2 text-zinc-600">
                Second Brain includes sophisticated audio processing capabilities including speaker recognition, voice activity detection, and continuous listening modes.
              </p>

              {/* Speaker Recognition */}
              <div className="grid gap-6 mt-8 md:grid-cols-2">
                <div className="p-6 border rounded-xl border-zinc-200 bg-white">
                  <h3 className="font-semibold text-zinc-900">Speaker Recognition</h3>
                  <p className="mt-2 text-sm text-zinc-600">
                    ECAPA-TDNN model for reliable speaker identification. Enroll speakers with a few audio samples for personalized memory attribution.
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500" />
                      Runs completely locally
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500" />
                      3-10 audio clips for enrollment
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500" />
                      Confidence scoring (0.0-1.0)
                    </li>
                  </ul>
                </div>
                <div className="p-6 border rounded-xl border-zinc-200 bg-white">
                  <h3 className="font-semibold text-zinc-900">Voice Activity Detection</h3>
                  <p className="mt-2 text-sm text-zinc-600">
                    Intelligent detection of speech vs. silence for efficient audio processing and noise filtering.
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500" />
                      WebRTC-based VAD
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500" />
                      Configurable sensitivity
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-500" />
                      Real-time processing
                    </li>
                  </ul>
                </div>
              </div>

              {/* Input Formats */}
              <h3 className="mt-8 text-lg font-semibold text-zinc-900">Supported Input Formats</h3>
              <div className="grid gap-4 mt-4 sm:grid-cols-3">
                {[
                  { name: "Text Input", desc: "Lowest latency, direct processing", latency: "<100ms" },
                  { name: "Audio Stream", desc: "Real-time WebSocket streaming", latency: "<2s" },
                  { name: "Audio Batch", desc: "3-10s chunks for mobile/IoT", latency: "<3s" },
                ].map((format) => (
                  <div key={format.name} className="p-4 border rounded-lg border-zinc-200 bg-white">
                    <h4 className="font-medium text-zinc-900">{format.name}</h4>
                    <p className="text-sm text-zinc-600">{format.desc}</p>
                    <p className="mt-2 text-xs text-violet-600">Latency: {format.latency}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Notifications Section */}
            <section id="notifications" className="scroll-mt-24">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
                <Bell className="w-4 h-4" />
                Notifications
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">
                Multi-Channel Notification System
              </h2>
              <p className="mt-2 text-zinc-600">
                A comprehensive notification system supporting multiple channels with real-time delivery and intelligent routing.
              </p>

              {/* Channels */}
              <div className="grid gap-4 mt-8 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { name: "In-App", desc: "Real-time WebSocket notifications", icon: Monitor },
                  { name: "Browser Push", desc: "Native browser notifications with Service Worker", icon: Bell },
                  { name: "Pushover", desc: "Mobile notifications for iOS, Android, Desktop", icon: MessageSquare },
                  { name: "Email", desc: "Email notifications (future)", icon: FileText },
                  { name: "Webhook", desc: "Custom HTTP webhooks", icon: Globe },
                  { name: "Telegram", desc: "Chat notifications via Telegram bot", icon: MessageSquare },
                ].map(({ name, desc, icon: Icon }) => (
                  <div key={name} className="flex gap-3 p-4 border rounded-lg border-zinc-200 bg-white">
                    <Icon className="w-5 h-5 text-violet-600 shrink-0" />
                    <div>
                      <h4 className="font-medium text-zinc-900">{name}</h4>
                      <p className="text-sm text-zinc-600">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Notification Types */}
              <h3 className="mt-8 text-lg font-semibold text-zinc-900">Notification Types</h3>
              <div className="flex flex-wrap gap-2 mt-4">
                {[
                  { type: "INFO", color: "blue" },
                  { type: "SUCCESS", color: "emerald" },
                  { type: "WARNING", color: "amber" },
                  { type: "ERROR", color: "red" },
                  { type: "REMINDER", color: "violet" },
                  { type: "ACHIEVEMENT", color: "pink" },
                ].map(({ type, color }) => (
                  <span key={type} className={`px-3 py-1 text-sm font-medium rounded-full bg-${color}-100 text-${color}-700`}>
                    {type}
                  </span>
                ))}
              </div>

              {/* Smart Routing */}
              <div className="p-6 mt-8 border rounded-xl border-zinc-200 bg-zinc-50">
                <h3 className="text-lg font-semibold text-zinc-900">Smart Notification Routing</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  When Pushover is configured, the system automatically routes notifications to your mobile devices for better delivery. This is transparent to the AI—it simply sends notifications and the system chooses the optimal channel.
                </p>
              </div>
            </section>

            {/* API Reference Section */}
            <section id="api" className="scroll-mt-24">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
                <Code className="w-4 h-4" />
                API Reference
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">
                REST API Endpoints
              </h2>
              <p className="mt-2 text-zinc-600">
                All API endpoints require JWT authentication via the <code className="px-1 bg-zinc-100 rounded">Authorization: Bearer &lt;token&gt;</code> header.
              </p>

              {/* Endpoints Table */}
              <div className="mt-8 overflow-hidden border rounded-xl border-zinc-200">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 font-medium text-left text-zinc-900">Method</th>
                      <th className="px-4 py-3 font-medium text-left text-zinc-900">Endpoint</th>
                      <th className="px-4 py-3 font-medium text-left text-zinc-900">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {apiEndpoints.map((endpoint) => (
                      <tr key={`${endpoint.method}-${endpoint.path}`}>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            endpoint.method === "GET" ? "bg-emerald-100 text-emerald-700" :
                            endpoint.method === "POST" ? "bg-blue-100 text-blue-700" :
                            endpoint.method === "PATCH" ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {endpoint.method}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-900">{endpoint.path}</td>
                        <td className="px-4 py-3 text-zinc-600">{endpoint.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Example Request */}
              <div className="p-6 mt-8 border rounded-xl border-zinc-200 bg-zinc-50">
                <h3 className="text-lg font-semibold text-zinc-900">Example: Send a Notification</h3>
                <div className="mt-4">
                  <CodeBlock code={`curl -X POST http://localhost:3000/api/notifications \\
  -H "Authorization: Bearer <your-jwt-token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Reminder",
    "message": "Don't forget your meeting at 3 PM",
    "type": "REMINDER",
    "channels": ["IN_APP", "PUSH"]
  }'`} />
                </div>
              </div>
            </section>

            {/* Configuration Section */}
            <section id="configuration" className="scroll-mt-24">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
                <Settings className="w-4 h-4" />
                Configuration
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">
                Environment Configuration
              </h2>
              <p className="mt-2 text-zinc-600">
                Configure Second Brain using environment variables. Copy <code className="px-1 bg-zinc-100 rounded">.env.example</code> to <code className="px-1 bg-zinc-100 rounded">.env</code> and customize.
              </p>

              {/* Environment Variables */}
              <div className="mt-8">
                <CodeBlock code={`# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/second_brain

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# AI Providers (configure at least one)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...

# Optional: Local LLM
OLLAMA_BASE_URL=http://localhost:11434

# Services
WEAVIATE_URL=http://localhost:8080
PORT=3000
NODE_ENV=development

# Memory Configuration
MEMORY_RETENTION_DAYS=7
LOG_LEVEL=info

# Notifications (optional)
PUSHOVER_APP_TOKEN=your-pushover-token

# Telegram (optional)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token`} />
              </div>

              {/* AI Setup Options */}
              <h3 className="mt-8 text-lg font-semibold text-zinc-900">AI Model Setup</h3>
              <div className="grid gap-4 mt-4 md:grid-cols-2">
                <div className="p-6 border rounded-xl border-zinc-200 bg-white">
                  <h4 className="font-semibold text-zinc-900">Local AI (Privacy-Focused)</h4>
                  <p className="mt-2 text-sm text-zinc-600">
                    Run AI models completely locally using Ollama. Best for sensitive data.
                  </p>
                  <div className="mt-4">
                    <CodeBlock code="./scripts/setup-local-llm.sh" />
                  </div>
                </div>
                <div className="p-6 border rounded-xl border-zinc-200 bg-white">
                  <h4 className="font-semibold text-zinc-900">Cloud AI (More Powerful)</h4>
                  <p className="mt-2 text-sm text-zinc-600">
                    Use cloud providers like OpenAI, Anthropic, or Google. Configure via web interface.
                  </p>
                  <p className="mt-4 text-sm text-zinc-600">
                    Settings → AI Configuration
                  </p>
                </div>
              </div>
            </section>

            {/* Security Section */}
            <section id="security" className="scroll-mt-24">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
                <Shield className="w-4 h-4" />
                Security
              </div>
              <div className="flex items-center gap-3 mt-2">
                <h2 className="text-2xl font-bold text-zinc-900">Privacy & Security</h2>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Local-first
                </span>
              </div>
              <p className="mt-2 text-zinc-600">
                Second Brain is designed with privacy as a core principle. Your data stays under your control at all times.
              </p>

              {/* Security Features */}
              <div className="grid gap-4 mt-8 sm:grid-cols-2">
                {[
                  { icon: Lock, title: "End-to-End Encryption", desc: "All data encrypted at rest and in transit" },
                  { icon: Key, title: "JWT Authentication", desc: "Secure token-based authentication with 7-day expiry" },
                  { icon: Shield, title: "AES-256-GCM Secrets", desc: "API keys and secrets encrypted with AES-256-GCM" },
                  { icon: Server, title: "Local-First Architecture", desc: "All processing can run on your own infrastructure" },
                  { icon: User, title: "User-Scoped Data", desc: "Complete data isolation between users" },
                  { icon: FileText, title: "Audit Logging", desc: "Every read/write operation is logged" },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex gap-3 p-4 border rounded-lg border-zinc-200 bg-white">
                    <Icon className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="font-medium text-zinc-900">{title}</h4>
                      <p className="text-sm text-zinc-600">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Zero Telemetry */}
              <div className="p-6 mt-8 border-2 border-emerald-200 rounded-xl bg-emerald-50">
                <h3 className="font-semibold text-emerald-900">Zero Telemetry</h3>
                <p className="mt-2 text-sm text-emerald-800">
                  Second Brain does not collect any usage data, analytics, or telemetry. Your interactions, memories, and patterns are never sent to external servers. When using local LLM models, your data never leaves your machine.
                </p>
              </div>
            </section>

            {/* Roadmap */}
            <section id="roadmap" className="scroll-mt-24">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
                <TrendingUp className="w-4 h-4" />
                Roadmap
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">
                Development Roadmap
              </h2>
              <p className="mt-2 text-zinc-600">
                Second Brain is actively developed with a clear vision for the future.
              </p>

              <div className="mt-8 space-y-6">
                {[
                  { phase: "Phase 1", name: "Foundation", weeks: "Weeks 1-4", status: "complete", items: ["Backend API scaffolding", "PostgreSQL + Weaviate setup", "Basic memory CRUD", "Intent router MVP", "Basic React frontend"] },
                  { phase: "Phase 2", name: "Memory Core", weeks: "Weeks 5-8", status: "in-progress", items: ["Short-term memory ingestion", "Embedding pipeline with Weaviate", "Summarization scheduler", "Memory browser UI", "Hybrid search implementation"] },
                  { phase: "Phase 3", name: "Autonomy", weeks: "Weeks 9-12", status: "planned", items: ["Daily reflection generator", "Weekly summary agent", "Goal tracker", "Habit analyzer", "Background agent scheduling"] },
                  { phase: "Phase 4", name: "Tool Integration", weeks: "Weeks 13-16", status: "planned", items: ["Tool executor framework", "Browser automation (Browseruse)", "API integrations", "MCP server support", "Safety constraints"] },
                  { phase: "Phase 5", name: "Polish & Deployment", weeks: "Weeks 17+", status: "planned", items: ["Performance optimization", "Frontend UI refinement", "Docker containerization", "Documentation", "Monitoring & observability"] },
                ].map((phase) => (
                  <div key={phase.phase} className="p-6 border rounded-xl border-zinc-200 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-violet-100 text-violet-700">{phase.phase}</span>
                        <h3 className="font-semibold text-zinc-900">{phase.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-500">{phase.weeks}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          phase.status === "complete" ? "bg-emerald-100 text-emerald-700" :
                          phase.status === "in-progress" ? "bg-blue-100 text-blue-700" :
                          "bg-zinc-100 text-zinc-600"
                        }`}>
                          {phase.status === "complete" ? "Complete" : phase.status === "in-progress" ? "In Progress" : "Planned"}
                        </span>
                      </div>
                    </div>
                    <ul className="grid gap-2 mt-4 sm:grid-cols-2">
                      {phase.items.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm text-zinc-600">
                          <Check className={`w-4 h-4 ${phase.status === "complete" ? "text-emerald-500" : "text-zinc-300"}`} />
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
              <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
                <BookOpen className="w-4 h-4" />
                FAQ
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">Frequently Asked Questions</h2>
              <p className="mt-2 text-zinc-600">Common questions about Second Brain.</p>

              <div className="mt-8 space-y-3">
                {[
                  {
                    q: "Does it run fully locally?",
                    a: "Yes. Docker Compose runs all services locally including PostgreSQL and Weaviate. You can use local LLM models (Ollama) for complete offline operation, or connect to cloud providers like OpenAI and Anthropic for more powerful models.",
                  },
                  {
                    q: "What AI models are supported?",
                    a: "Second Brain supports OpenAI (GPT-4, GPT-3.5), Anthropic (Claude), Google (Gemini), and local models via Ollama. The LLM Router automatically selects the best model based on task complexity and your configuration.",
                  },
                  {
                    q: "How does speaker recognition work?",
                    a: "The system uses ECAPA-TDNN, a neural network model for speaker verification. You enroll speakers by providing 3-10 audio samples, which creates a voice profile. When processing audio, the system compares against known profiles to identify who is speaking.",
                  },
                  {
                    q: "How are summaries triggered?",
                    a: "The scheduler runs cron jobs for automatic summarization: daily summaries at 11 PM, weekly on Sundays, and monthly on the 1st. You can also trigger summaries manually via the API or UI.",
                  },
                  {
                    q: "Can I edit or delete memories?",
                    a: "Yes. Full CRUD API support including create, read, update, delete, pin, archive, and bulk operations. You have complete control over your data.",
                  },
                  {
                    q: "How is my data protected?",
                    a: "All data is encrypted at rest (PostgreSQL) and in transit (HTTPS). API keys are encrypted with AES-256-GCM. There is zero telemetry—no data is ever sent to external servers unless you configure cloud AI providers.",
                  },
                  {
                    q: "Can I use it on mobile?",
                    a: "The web interface is responsive and works on mobile browsers. For notifications, Pushover integration provides native push notifications on iOS and Android. Telegram integration allows chat-based interaction from any device.",
                  },
                  {
                    q: "What's the difference between Tools and Skills?",
                    a: "Tools are atomic Python functions that perform specific actions (API calls, web browsing). Skills are natural language workflows that orchestrate multiple tools to accomplish complex goals. The AI interprets skills and executes the appropriate tools.",
                  },
                  {
                    q: "How does the Proactive Agent work?",
                    a: "The Proactive Agent runs twice daily (8 AM and 6 PM) to analyze your recent memories and provide gentle suggestions for health, productivity, and wellbeing. It has a special health-check mode that runs on Mondays and Thursdays. All suggestions are optional and never demanding.",
                  },
                  {
                    q: "Can I contribute to the project?",
                    a: "Absolutely! Second Brain is open source. Check out the GitHub repository to report issues, suggest features, or submit pull requests. The codebase is well-documented with implementation notes in /docs/implementation-notes/.",
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
