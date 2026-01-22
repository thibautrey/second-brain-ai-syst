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
} from "lucide-react";
import { useState } from "react";

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
          <NavItem icon={<Home className="w-5 h-5" />} label="Dashboard" />
          <NavItem icon={<Brain className="w-5 h-5" />} label="Memories" />
          <NavItem
            icon={<FileText className="w-5 h-5" />}
            label="Interactions"
          />
          <NavItem icon={<BarChart3 className="w-5 h-5" />} label="Analytics" />
          <NavItem icon={<Settings className="w-5 h-5" />} label="Settings" />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full justify-start text-white border-slate-700 hover:bg-slate-800"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b border-slate-200 p-4 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">
                {user?.name || user?.email}
              </p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
              {(user?.name || user?.email)?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome back, {user?.name}!
            </h2>
            <p className="text-slate-600 mb-8">
              Your personal cognitive operating system is ready to enhance your
              memory and reasoning.
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <QuickStartButton
                    title="Record Thought"
                    description="Capture your current thoughts"
                    icon="🎤"
                  />
                  <QuickStartButton
                    title="View Memories"
                    description="Browse your knowledge base"
                    icon="🧠"
                  />
                  <QuickStartButton
                    title="Today's Summary"
                    description="See today's highlights"
                    icon="📊"
                  />
                  <QuickStartButton
                    title="Settings"
                    description="Customize your system"
                    icon="⚙️"
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
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
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
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <button className="p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left">
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
      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-medium text-slate-900 text-sm">{title}</p>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </div>
      <p className="text-xs text-slate-400 flex-shrink-0">{time}</p>
    </div>
  );
}
