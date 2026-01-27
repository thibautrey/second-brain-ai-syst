import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { TrainingProgressWidget } from "../components/ui/training-progress-widget";
import { TipsCarousel } from "../components/TipsCarousel";
import {
  Menu,
  LogOut,
  Settings,
  Home,
  Brain,
  FileText,
  Mic,
  CheckSquare,
  Calendar,
  Wrench,
  Bell,
  BarChart3,
  Target,
  Trophy,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { TrainingPage } from "./TrainingPage";
import { SettingsPage } from "./SettingsPage";
import { MemoryBrowser } from "../components/memory";
import { TodoList } from "../components/todos";
import { ScheduleList } from "../components/schedule";
import { ToolsConfigPage } from "./ToolsConfigPage";
import { NotificationTestPage } from "./NotificationTestPage";
import { AnalyticsPage } from "../components/analytics";
import { GoalsPage, AchievementsPage } from "../components/goals-achievements";
import { useDashboardStats } from "../hooks/useDashboardStats";
import { useRecentActivity } from "../hooks/useRecentActivity";
import { useIsMobile } from "../hooks/use-mobile";
import { MobileDashboard } from "../components/dashboard/MobileDashboard";
import { DesktopDashboard } from "../components/dashboard/DesktopDashboard";
import { fetchActiveTips, dismissTip, viewTip } from "../services/api";
import type { Tip } from "../services/api";

const DESKTOP_BREAKPOINT = 1024;

export function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { tab } = useParams();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= DESKTOP_BREAKPOINT;
  });

  const [tips, setTips] = useState<Tip[]>([]);
  const [tipsLoading, setTipsLoading] = useState(true);

  const userToggledSidebar = useRef(false);
  const activeTab = tab || "dashboard";

  const { totalMemories, totalInteractions, dailySummaries, isLoading, error } =
    useDashboardStats();

  const {
    items: recentActivityItems,
    isLoading: activityLoading,
    error: activityError,
  } = useRecentActivity(10);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const isDesktop = window.innerWidth >= DESKTOP_BREAKPOINT;
        if (!userToggledSidebar.current) {
          setSidebarOpen((prev) => (prev !== isDesktop ? isDesktop : prev));
        }
      }, 150);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Fetch tips on mount
  useEffect(() => {
    const loadTips = async () => {
      try {
        setTipsLoading(true);
        const data = await fetchActiveTips({ limit: 5 });
        setTips(data.tips);
      } catch (error) {
        console.error("Failed to load tips:", error);
        setTips([]);
      } finally {
        setTipsLoading(false);
      }
    };

    loadTips();
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function handleSidebarToggle() {
    setSidebarOpen(!sidebarOpen);
    userToggledSidebar.current = true;
  }

  function handleNavigation(path: string) {
    navigate(path);
    if (isMobile) {
      setSidebarOpen(false);
    }
  }

  const handleTipDismiss = async (tipId: string) => {
    try {
      await dismissTip(tipId);
      // Remove tip from display
      setTips((prevTips) => prevTips.filter((t) => t.id !== tipId));
    } catch (error) {
      console.error("Failed to dismiss tip:", error);
    }
  };

  const handleTipView = async (tipId: string) => {
    try {
      await viewTip(tipId);
    } catch (error) {
      console.error("Failed to track tip view:", error);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
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
            onClick={() => handleNavigation("/dashboard/dashboard")}
            isActive={activeTab === "dashboard"}
          />
          <NavItem
            icon={<Brain className="w-5 h-5" />}
            label="Memories"
            onClick={() => handleNavigation("/dashboard/memories")}
            isActive={activeTab === "memories"}
          />
          <NavItem
            icon={<FileText className="w-5 h-5" />}
            label="Interactions"
            onClick={() => handleNavigation("/dashboard/interactions")}
            isActive={activeTab === "interactions"}
          />
          <NavItem
            icon={<BarChart3 className="w-5 h-5" />}
            label="Analytics"
            onClick={() => handleNavigation("/dashboard/analytics")}
            isActive={activeTab === "analytics"}
          />
          <NavItem
            icon={<Target className="w-5 h-5" />}
            label="Goals"
            onClick={() => handleNavigation("/dashboard/goals")}
            isActive={activeTab === "goals"}
          />
          <NavItem
            icon={<Trophy className="w-5 h-5" />}
            label="Achievements"
            onClick={() => handleNavigation("/dashboard/achievements")}
            isActive={activeTab === "achievements"}
          />
          <NavItem
            icon={<Mic className="w-5 h-5" />}
            label="Voice Training"
            onClick={() => handleNavigation("/dashboard/training")}
            isActive={activeTab === "training"}
          />
          <NavItem
            icon={<CheckSquare className="w-5 h-5" />}
            label="Tâches"
            onClick={() => handleNavigation("/dashboard/todos")}
            isActive={activeTab === "todos"}
          />
          <NavItem
            icon={<Calendar className="w-5 h-5" />}
            label="Planifications"
            onClick={() => handleNavigation("/dashboard/schedule")}
            isActive={activeTab === "schedule"}
          />
          <NavItem
            icon={<Wrench className="w-5 h-5" />}
            label="Tools"
            onClick={() => handleNavigation("/dashboard/tools")}
            isActive={activeTab === "tools"}
          />
          <NavItem
            icon={<Bell className="w-5 h-5" />}
            label="Notifications"
            onClick={() => handleNavigation("/dashboard/notifications")}
            isActive={activeTab === "notifications"}
          />
          <NavItem
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
            onClick={() => handleNavigation("/dashboard/settings")}
            isActive={activeTab === "settings"}
          />
        </nav>

        {/* Tips Carousel - Bottom of sidebar */}
        {!tipsLoading && tips.length > 0 && (
          <TipsCarousel
            tips={tips.map((tip) => ({
              id: tip.id,
              title: tip.title,
              description: tip.description,
              category: tip.category,
              targetFeature: tip.targetFeature,
              icon: tip.icon,
              priority: tip.priority,
              isDismissed: tip.isDismissed,
            }))}
            onDismiss={handleTipDismiss}
            onView={handleTipView}
          />
        )}

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
            onClick={handleSidebarToggle}
            className="p-2 transition-colors rounded-lg hover:bg-slate-100"
            aria-label={
              sidebarOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={sidebarOpen}
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            {!isMobile && <TrainingProgressWidget />}

            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">
                {user?.name || user?.email}
              </p>
              {!isMobile && (
                <p className="text-xs text-slate-500">{user?.email}</p>
              )}
            </div>
            <div className="flex items-center justify-center w-10 h-10 font-semibold text-white rounded-full bg-blue-600">
              {(user?.name || user?.email)?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          className={`flex-1 overflow-auto ${isMobile ? "p-4 pt-20" : "p-8 pt-24"}`}
        >
          <div className="max-w-6xl mx-auto">
            {activeTab === "dashboard" && (
              <>
                {isMobile ? (
                  <MobileDashboard
                    user={user}
                    totalMemories={totalMemories}
                    totalInteractions={totalInteractions}
                    dailySummaries={dailySummaries}
                    isLoading={isLoading}
                    error={error}
                    recentActivityItems={recentActivityItems}
                    activityLoading={activityLoading}
                    activityError={activityError}
                    formatTimeAgo={formatTimeAgo}
                  />
                ) : (
                  <DesktopDashboard
                    user={user}
                    totalMemories={totalMemories}
                    totalInteractions={totalInteractions}
                    dailySummaries={dailySummaries}
                    isLoading={isLoading}
                    error={error}
                    recentActivityItems={recentActivityItems}
                    activityLoading={activityLoading}
                    activityError={activityError}
                    formatTimeAgo={formatTimeAgo}
                  />
                )}
              </>
            )}

            {activeTab === "memories" && <MemoryBrowser />}
            {activeTab === "analytics" && <AnalyticsPage />}
            {activeTab === "goals" && <GoalsPage />}
            {activeTab === "achievements" && <AchievementsPage />}
            {activeTab === "training" && <TrainingPage />}
            {activeTab === "todos" && <TodoList />}
            {activeTab === "schedule" && <ScheduleList />}
            {activeTab === "tools" && <ToolsConfigPage />}
            {activeTab === "notifications" && <NotificationTestPage />}
            {activeTab === "settings" && <SettingsPage />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Components utilitaires inchangés --- */

function NavItem({ icon, label, onClick, isActive = false }: any) {
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

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  const weeks = Math.floor(diffDays / 7);
  if (weeks < 4) return `${weeks}w ago`;

  const months = Math.floor(diffDays / 30);
  return `${months}mo ago`;
}
