import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { TrainingProgressWidget } from "../components/ui/training-progress-widget";
import { ContinuousListeningCompact } from "../components/ContinuousListeningCompact";
import {
  Menu,
  LogOut,
  Settings,
  Home,
  Brain,
  FileText,
  BarChart3,
  Mic,
  CheckSquare,
  Calendar,
} from "lucide-react";
import { useState, useEffect } from "react";
import { TrainingPage } from "./TrainingPage";
import { SettingsPage } from "./SettingsPage";
import { MemoryBrowser } from "../components/memory";
import { TodoList } from "../components/todos";
import { ScheduleList } from "../components/schedule";
import { useDashboardStats } from "../hooks/useDashboardStats";

export function DashboardPage() {
  const navigate = useNavigate();
  const { tab } = useParams();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const activeTab = tab || "dashboard";
  const { totalMemories, totalInteractions, dailySummaries, isLoading, error } =
    useDashboardStats();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } fixed left-0 top-0 h-screen bg-slate-900 text-white transition-all duration-300 flex flex-col overflow-hidden z-50`}
      >
        <div className="p-6 border-b border-slate-800">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Brain className="w-5 h-5" />
            Second Brain
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavItem
            icon={<Home className="w-5 h-5" />}
            label="Dashboard"
            onClick={() => navigate("/dashboard/dashboard")}
            isActive={activeTab === "dashboard"}
          />
          <NavItem
            icon={<Brain className="w-5 h-5" />}
            label="Memories"
            onClick={() => navigate("/dashboard/memories")}
            isActive={activeTab === "memories"}
          />
          <NavItem
            icon={<FileText className="w-5 h-5" />}
            label="Interactions"
            onClick={() => navigate("/dashboard/interactions")}
            isActive={activeTab === "interactions"}
          />
          <NavItem
            icon={<BarChart3 className="w-5 h-5" />}
            label="Analytics"
            onClick={() => navigate("/dashboard/analytics")}
            isActive={activeTab === "analytics"}
          />
          <NavItem
            icon={<Mic className="w-5 h-5" />}
            label="Voice Training"
            onClick={() => navigate("/dashboard/training")}
            isActive={activeTab === "training"}
          />
          <NavItem
            icon={<CheckSquare className="w-5 h-5" />}
            label="Tâches"
            onClick={() => navigate("/dashboard/todos")}
            isActive={activeTab === "todos"}
          />
          <NavItem
            icon={<Calendar className="w-5 h-5" />}
            label="Planifications"
            onClick={() => navigate("/dashboard/schedule")}
            isActive={activeTab === "schedule"}
          />
          <NavItem
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
            onClick={() => navigate("/dashboard/settings")}
            isActive={activeTab === "settings"}
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="justify-start w-full text-white hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div
        className={`flex flex-col flex-1 ${sidebarOpen ? "ml-64" : "ml-0"} transition-all duration-300`}
      >
        {/* Top Bar */}
        <div
          className={`fixed top-0 flex items-center gap-4 p-4 bg-white border-b border-slate-200 z-40 ${sidebarOpen ? "left-64" : "left-0"} right-0 transition-all duration-300`}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 transition-colors rounded-lg hover:bg-slate-100"
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            {/* Continuous Listening Button */}
            <ContinuousListeningCompact />

            {/* Training Progress Widget */}
            <TrainingProgressWidget />

            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">
                {user?.name || user?.email}
              </p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <div className="flex items-center justify-center w-10 h-10 font-semibold text-white rounded-full bg-gradient-to-br from-blue-400 to-blue-600">
              {(user?.name || user?.email)?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 pt-24 overflow-auto">
          <div className="max-w-6xl mx-auto">
            {activeTab === "dashboard" && (
              <>
                <h2 className="mb-2 text-3xl font-bold text-slate-900">
                  Welcome back, {user?.name}!
                </h2>
                <p className="mb-8 text-slate-600">
                  Your personal cognitive operating system is ready to enhance
                  your memory and reasoning.
                </p>

                {/* Error Display */}
                {error && (
                  <div className="p-4 mb-6 text-red-700 border border-red-200 rounded-lg bg-red-50">
                    <p className="font-medium">
                      Error loading dashboard stats:
                    </p>
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {/* Stats Card */}
                  <DashboardCard
                    title="Total Memories"
                    value={isLoading ? "..." : String(totalMemories)}
                    description="Memories captured"
                    icon="📚"
                    isLoading={isLoading}
                  />
                  <DashboardCard
                    title="Interactions"
                    value={isLoading ? "..." : String(totalInteractions)}
                    description="Interactions logged"
                    icon="💬"
                    isLoading={isLoading}
                  />
                  <DashboardCard
                    title="Daily Summaries"
                    value={isLoading ? "..." : String(dailySummaries)}
                    description="Summaries generated"
                    icon="📝"
                    isLoading={isLoading}
                  />

                  {/* Quick Start */}
                  <div className="p-6 bg-white border rounded-lg shadow md:col-span-3 border-slate-200">
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">
                      Quick Start
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <QuickStartButton
                        title="Record Thought"
                        description="Capture your current thoughts"
                        icon="🎤"
                        onClick={() => {}}
                      />
                      <QuickStartButton
                        title="View Memories"
                        description="Browse your knowledge base"
                        icon="🧠"
                        onClick={() => navigate("/dashboard/memories")}
                      />
                      <QuickStartButton
                        title="Today's Summary"
                        description="See today's highlights"
                        icon="📊"
                        onClick={() => navigate("/dashboard/analytics")}
                      />
                      <QuickStartButton
                        title="Settings"
                        description="Customize your system"
                        icon="⚙️"
                        onClick={() => navigate("/dashboard/settings")}
                      />
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="p-6 bg-white border rounded-lg shadow md:col-span-3 border-slate-200">
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">
                      Recent Activity
                    </h3>
                    <div className="space-y-3">
                      <ActivityItem
                        title="System Initialized"
                        description="Your Second Brain is ready to use"
                        time="Just now"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === "memories" && <MemoryBrowser />}

            {activeTab === "interactions" && (
              <div>
                <h2 className="mb-2 text-3xl font-bold text-slate-900">
                  Interactions
                </h2>
                <p className="mb-8 text-slate-600">
                  View all your interactions and conversations.
                </p>
                <div className="p-8 text-center bg-white border rounded-lg shadow border-slate-200">
                  <p className="text-slate-500">
                    Interactions log coming soon...
                  </p>
                </div>
              </div>
            )}

            {activeTab === "analytics" && (
              <div>
                <h2 className="mb-2 text-3xl font-bold text-slate-900">
                  Analytics
                </h2>
                <p className="mb-8 text-slate-600">
                  Analyze your patterns and insights.
                </p>
                <div className="p-8 text-center bg-white border rounded-lg shadow border-slate-200">
                  <p className="text-slate-500">
                    Analytics dashboard coming soon...
                  </p>
                </div>
              </div>
            )}

            {activeTab === "training" && <TrainingPage />}

            {activeTab === "todos" && <TodoList />}

            {activeTab === "schedule" && <ScheduleList />}

            {activeTab === "settings" && <SettingsPage />}
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({
  icon,
  label,
  onClick,
  isActive = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        isActive
          ? "bg-blue-600 text-white"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function DashboardCard({
  title,
  value,
  description,
  icon,
  isLoading = false,
}: {
  title: string;
  value: string;
  description: string;
  icon: string;
  isLoading?: boolean;
}) {
  return (
    <div className="p-6 transition-shadow bg-white border rounded-lg shadow border-slate-200 hover:shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p
            className={`mt-2 text-3xl font-bold ${isLoading ? "text-slate-300 animate-pulse" : "text-slate-900"}`}
          >
            {value}
          </p>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  );
}

function QuickStartButton({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="p-4 text-left transition-all border rounded-lg border-slate-200 hover:border-blue-300 hover:bg-blue-50"
    >
      <div className="mb-2 text-2xl">{icon}</div>
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </button>
  );
}

function ActivityItem({
  title,
  description,
  time,
}: {
  title: string;
  description: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-4 pb-3 border-b border-slate-100 last:border-0">
      <div className="flex-shrink-0 w-2 h-2 mt-2 bg-blue-500 rounded-full" />
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      <p className="flex-shrink-0 text-xs text-slate-400">{time}</p>
    </div>
  );
}
