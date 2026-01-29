import {
  Brain,
  Calendar,
  CheckSquare,
  FileText,
  Home,
  LogOut,
  Menu,
  Mic,
  Radio,
  Settings,
  Target,
  Trophy,
  Wrench,
} from "lucide-react";
import { dismissTip, fetchActiveTips, viewTip } from "../services/api";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { AnalyticsPage } from "../components/analytics";
import { Button } from "../components/ui/button";
import { ChannelsPage } from "./ChannelsPage";
import { GoalsAchievementsPage } from "../components/goals-achievements";
import { MemoryBrowser } from "../components/memory";
import { SettingsPage } from "./SettingsPage";
import { TasksSchedulingPage } from "../components/tasks-scheduling";
import { ThemeToggleButton } from "../components/ui/theme-toggle-button";
import type { Tip } from "../services/api";
import { TipsCarousel } from "../components/TipsCarousel";
import { ToolsConfigPage } from "./ToolsConfigPage";
import { TrainingPage } from "./TrainingPage";
import { TrainingProgressWidget } from "../components/ui/training-progress-widget";
import { useAuth } from "../contexts/AuthContext";
import { useDashboardStats } from "../hooks/useDashboardStats";
import { useIsMobile } from "../hooks/use-mobile";
import { useTranslation } from "react-i18next";

const DESKTOP_BREAKPOINT = 1024;

export function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { tab } = useParams();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const { totalInteractions } = useDashboardStats();

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= DESKTOP_BREAKPOINT;
  });

  const [tips, setTips] = useState<Tip[]>([]);
  const [tipsLoading, setTipsLoading] = useState(true);

  const userToggledSidebar = useRef(false);
  const activeTab = tab || "dashboard";
  const [hasDetectedInteractions, setHasDetectedInteractions] = useState(() => {
    // Initialize from localStorage
    return localStorage.getItem("hasDetectedInteractions") === "true";
  });

  // Update localStorage when interactions are first detected
  useEffect(() => {
    if (totalInteractions > 0 && !hasDetectedInteractions) {
      setHasDetectedInteractions(true);
      localStorage.setItem("hasDetectedInteractions", "true");
    }
  }, [totalInteractions, hasDetectedInteractions]);

  const navItems = [
    {
      icon: <Home className="w-5 h-5" />,
      label: t("navigation.dashboard"),
      path: "/dashboard/dashboard",
      matches: ["dashboard"],
    },
    {
      icon: <Brain className="w-5 h-5" />,
      label: t("navigation.memories"),
      path: "/dashboard/memories",
      matches: ["memories"],
    },
    {
      icon: <FileText className="w-5 h-5" />,
      label: t("navigation.interactions"),
      path: "/dashboard/interactions",
      matches: ["interactions"],
      hidden: !hasDetectedInteractions, // Hide until interactions are detected
    },
    {
      icon: <Target className="w-5 h-5" />,
      label: t("navigation.goalsAchievements"),
      path: "/dashboard/goals-achievements",
      matches: ["goals-achievements", "goals", "achievements"],
    },
    {
      icon: <Mic className="w-5 h-5" />,
      label: t("navigation.voiceTraining"),
      path: "/dashboard/training",
      matches: ["training"],
    },
    {
      icon: <CheckSquare className="w-5 h-5" />,
      label: t("navigation.tasksScheduling"),
      path: "/dashboard/tasks-scheduling",
      matches: ["tasks-scheduling", "todos", "schedule"],
    },
    {
      icon: <Wrench className="w-5 h-5" />,
      label: t("navigation.tools"),
      path: "/dashboard/tools",
      matches: ["tools"],
    },
    {
      icon: <Radio className="w-5 h-5" />,
      label: t("navigation.channels"),
      path: "/dashboard/channels",
      matches: ["channels"],
    },
    {
      icon: <Settings className="w-5 h-5" />,
      label: t("navigation.settings"),
      path: "/dashboard/settings",
      matches: ["settings"],
    },
  ];
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

  // Redirect old todos/schedule URLs to the new unified page
  useEffect(() => {
    if (activeTab === "todos" || activeTab === "schedule") {
      navigate("/dashboard/tasks-scheduling", { replace: true });
    }
  }, [activeTab, navigate]);

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
            {t("navigation.appName")}
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems
            .filter((item) => !item.hidden)
            .map((item) => (
              <NavItem
                key={item.path}
                icon={item.icon}
                label={item.label}
                onClick={() => handleNavigation(item.path)}
                isActive={item.matches.includes(activeTab)}
              />
            ))}
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
            {t("navigation.logout")}
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
              sidebarOpen ? t("navigation.menuClose") : t("navigation.menuOpen")
            }
            aria-expanded={sidebarOpen}
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2 sm:gap-4">
            {!isMobile && <TrainingProgressWidget />}

            <ThemeToggleButton />

            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">
                {user?.name || user?.email}
              </p>
              {!isMobile && (
                <p className="text-xs text-slate-500">{user?.email}</p>
              )}
            </div>
            <div className="flex items-center justify-center w-10 h-10 font-semibold text-white bg-blue-600 rounded-full">
              {(user?.name || user?.email)?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          className={`flex-1 overflow-auto ${isMobile ? "p-4 pt-20" : "p-8 pt-24"}`}
        >
          <div className="max-w-6xl mx-auto">
            {activeTab === "dashboard" && <AnalyticsPage />}

            {activeTab === "memories" && <MemoryBrowser />}
            {(activeTab === "goals-achievements" ||
              activeTab === "goals" ||
              activeTab === "achievements") && <GoalsAchievementsPage />}
            {activeTab === "training" && <TrainingPage />}
            {(activeTab === "tasks-scheduling" ||
              activeTab === "todos" ||
              activeTab === "schedule") && <TasksSchedulingPage />}
            {activeTab === "tools" && <ToolsConfigPage />}
            {activeTab === "channels" && <ChannelsPage />}
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
