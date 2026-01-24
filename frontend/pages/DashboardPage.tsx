import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import {
  Menu,
  LogOut,
  Settings,
  Home,
  Brain,
  FileText,
  BarChart3,
  Mic,
  MessageSquare,
  Wrench,
  CheckSquare,
  Calendar,
} from "lucide-react";
import { useState } from "react";
import { ToolsConfigPage } from "./ToolsConfigPage";
import { TodoList } from "../components/todos";
import { ScheduleList } from "../components/schedule";

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } bg-slate-900 text-white transition-all duration-300 flex flex-col overflow-hidden`}
      >
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Second Brain
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavItem
            icon={<Home className="w-5 h-5" />}
            label="Dashboard"
            onClick={() => setActiveTab("dashboard")}
            isActive={activeTab === "dashboard"}
          />
          <NavItem
            icon={<Brain className="w-5 h-5" />}
            label="Memories"
            onClick={() => setActiveTab("memories")}
            isActive={activeTab === "memories"}
          />
          <NavItem
            icon={<FileText className="w-5 h-5" />}
            label="Interactions"
            onClick={() => setActiveTab("interactions")}
            isActive={activeTab === "interactions"}
          />
          <NavItem
            icon={<BarChart3 className="w-5 h-5" />}
            label="Analytics"
            onClick={() => setActiveTab("analytics")}
            isActive={activeTab === "analytics"}
          />
          <NavItem
            icon={<Mic className="w-5 h-5" />}
            label="Voice Training"
            onClick={() => setActiveTab("training")}
            isActive={activeTab === "training"}
          />
          <NavItem
            icon={<MessageSquare className="w-5 h-5" />}
            label="Chat"
            onClick={() => setActiveTab("chat")}
            isActive={activeTab === "chat"}
          />
          <NavItem
            icon={<CheckSquare className="w-5 h-5" />}
            label="Tâches"
            onClick={() => setActiveTab("todos")}
            isActive={activeTab === "todos"}
          />
          <NavItem
            icon={<Calendar className="w-5 h-5" />}
            label="Planifications"
            onClick={() => setActiveTab("schedule")}
            isActive={activeTab === "schedule"}
          />
          <NavItem
            icon={<Wrench className="w-5 h-5" />}
            label="Tools"
            onClick={() => setActiveTab("tools")}
            isActive={activeTab === "tools"}
          />
          <NavItem
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
            onClick={() => setActiveTab("settings")}
            isActive={activeTab === "settings"}
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full text-slate-300 border-slate-700 hover:bg-slate-800"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-slate-100"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{user?.email}</span>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-8">
          {activeTab === "dashboard" && (
            <>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Welcome back, {user?.name}!
              </h2>
              <p className="text-slate-600 mb-8">
                Your personal cognitive operating system is ready to enhance
                your memory and reasoning.
              </p>

              {/* Dashboard Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Stats Card */}
                <DashboardCard
                  title="Total Memories"
                  value="0"
                  description="Memories captured"
                  icon="📚"
                />
                <DashboardCard
                  title="Interactions"
                  value="0"
                  description="Interactions logged"
                  icon="💬"
                />
                <DashboardCard
                  title="Daily Summaries"
                  value="0"
                  description="Summaries generated"
                  icon="📝"
                />

                {/* Quick Start */}
                <div className="md:col-span-3 bg-white rounded-lg shadow p-6 border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">
                    Quick Start
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                    <QuickStartButton
                      title="Record Thought"
                      description="Capture your current thoughts"
                      icon="🎤"
                      onClick={() => setActiveTab("chat")}
                    />
                    <QuickStartButton
                      title="View Memories"
                      description="Browse your knowledge base"
                      icon="🧠"
                      onClick={() => setActiveTab("memories")}
                    />
                    <QuickStartButton
                      title="Today's Summary"
                      description="See today's highlights"
                      icon="📊"
                      onClick={() => setActiveTab("analytics")}
                    />
                    <QuickStartButton
                      title="Mes Tâches"
                      description="Gérer mes todos"
                      icon="✅"
                      onClick={() => setActiveTab("todos")}
                    />
                    <QuickStartButton
                      title="Planifications"
                      description="Tâches automatiques"
                      icon="📅"
                      onClick={() => setActiveTab("schedule")}
                    />
                    <QuickStartButton
                      title="Configure Tools"
                      description="Manage integrations"
                      icon="🔧"
                      onClick={() => setActiveTab("tools")}
                    />
                    <QuickStartButton
                      title="Settings"
                      description="Customize your system"
                      icon="⚙️"
                      onClick={() => setActiveTab("settings")}
                    />
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="md:col-span-3 bg-white rounded-lg shadow p-6 border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">
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

          {activeTab === "memories" && (
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Memories
              </h2>
              <p className="text-slate-600 mb-8">
                Browse and manage your captured memories.
              </p>
              <div className="p-8 text-center bg-white rounded-lg shadow border border-slate-200">
                <p className="text-slate-500">Memory browser coming soon...</p>
              </div>
            </div>
          )}

          {activeTab === "interactions" && (
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Interactions
              </h2>
              <p className="text-slate-600 mb-8">
                View your interaction history.
              </p>
              <div className="p-8 text-center bg-white rounded-lg shadow border border-slate-200">
                <p className="text-slate-500">
                  Interactions log coming soon...
                </p>
              </div>
            </div>
          )}

          {activeTab === "analytics" && (
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Analytics
              </h2>
              <p className="text-slate-600 mb-8">
                Analyze your patterns and insights.
              </p>
              <div className="p-8 text-center bg-white rounded-lg shadow border border-slate-200">
                <p className="text-slate-500">
                  Analytics dashboard coming soon...
                </p>
              </div>
            </div>
          )}

          {activeTab === "training" && (
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Voice Training
              </h2>
              <p className="text-slate-600 mb-8">
                Train your voice model for better recognition.
              </p>
              <div className="p-8 text-center bg-white rounded-lg shadow border border-slate-200">
                <p className="text-slate-500">Voice training coming soon...</p>
              </div>
            </div>
          )}

          {activeTab === "chat" && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                Chat with Second Brain
              </h2>
              <div className="p-8 text-center bg-white rounded-lg shadow border border-slate-200">
                <p className="text-slate-500">Chat interface coming soon...</p>
              </div>
            </div>
          )}

          {activeTab === "todos" && <TodoList />}

          {activeTab === "schedule" && <ScheduleList />}

          {activeTab === "tools" && <ToolsConfigPage />}

          {activeTab === "settings" && (
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Settings
              </h2>
              <p className="text-slate-600 mb-8">
                Customize your Second Brain experience.
              </p>
              <div className="p-8 text-center bg-white rounded-lg shadow border border-slate-200">
                <p className="text-slate-500">
                  Settings interface coming soon...
                </p>
              </div>
            </div>
          )}
        </main>
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
}: {
  title: string;
  value: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6 border border-slate-200 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-slate-600 font-medium">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
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
      className="p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <p className="font-medium text-slate-900 text-sm">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{description}</p>
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
      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
      <div className="flex-1">
        <p className="font-medium text-slate-900 text-sm">{title}</p>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </div>
      <p className="text-xs text-slate-400 shrink-0">{time}</p>
    </div>
  );
}
