import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ContinuousListeningProvider } from "./contexts/ContinuousListeningContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TooltipProvider } from "./components/ui/tooltip";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TrainingPage } from "./pages/TrainingPage";
import { LandingPage } from "./pages/LandingPage";
import { DocsPage } from "./pages/DocsPage";
import { FloatingActionButtons } from "./components/FloatingActionButtons";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { useUserPresence } from "./hooks/useUserPresence";
import { useNotificationListener } from "./hooks/useNotificationListener";
import { useHasUsers } from "./hooks/useHasUsers";

function AppContent() {
  const { isAuthenticated, hasCompletedOnboarding, isLoading } = useAuth();
  const { hasUsers, isLoading: isUsersLoading } = useHasUsers();

  const isBootLoading = isLoading || isUsersLoading;

  return (
    <>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Onboarding Route */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingWizard />
            </ProtectedRoute>
          }
        />

        {/* Protected Routes */}
        <Route
          path="/dashboard/:tab?"
          element={
            <ProtectedRoute>
              {hasCompletedOnboarding ? (
                <DashboardPage />
              ) : (
                <Navigate to="/onboarding" replace />
              )}
            </ProtectedRoute>
          }
        />

        {/* Docs */}
        <Route path="/docs" element={<DocsPage />} />

        {/* Landing */}
        <Route path="/landing" element={<LandingPage />} />

        {/* Bootstrap Redirect */}
        <Route
          path="/"
          element={
            isBootLoading ? (
              <div className="flex min-h-screen items-center justify-center text-slate-500">
                Loading...
              </div>
            ) : isAuthenticated ? (
              <Navigate
                to={hasCompletedOnboarding ? "/dashboard" : "/onboarding"}
                replace
              />
            ) : hasUsers === false ? (
              <Navigate to="/signup" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Floating Action Buttons - only visible when authenticated and onboarded */}
      {isAuthenticated && hasCompletedOnboarding && <FloatingActionButtons />}
    </>
  );
}

function PresenceTracker() {
  // Track user presence in the web interface
  useUserPresence({ enabled: true });
  return null;
}

function NotificationInitializer() {
  // Initialize global notification WebSocket connection
  // This ensures notifications are received on all pages, not just the notifications page
  useNotificationListener();
  return null;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <TooltipProvider>
            <ContinuousListeningProvider>
              <PresenceTracker />
              <NotificationInitializer />
              <AppContent />
            </ContinuousListeningProvider>
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
