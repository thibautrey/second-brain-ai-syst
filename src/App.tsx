import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ContinuousListeningProvider } from "./contexts/ContinuousListeningContext";
import { TooltipProvider } from "./components/ui/tooltip";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TrainingPage } from "./pages/TrainingPage";
import { FloatingActionButtons } from "./components/FloatingActionButtons";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";

function AppContent() {
  const { isAuthenticated, hasCompletedOnboarding } = useAuth();

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

        {/* Redirect */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              hasCompletedOnboarding ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/onboarding" replace />
              )
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

function App() {
  return (
    <TooltipProvider>
      <Router>
        <AuthProvider>
          <ContinuousListeningProvider>
            <AppContent />
          </ContinuousListeningProvider>
        </AuthProvider>
      </Router>
    </TooltipProvider>
  );
}

export default App;
