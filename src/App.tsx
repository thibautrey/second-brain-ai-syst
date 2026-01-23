import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ContinuousListeningProvider } from "./contexts/ContinuousListeningContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TrainingPage } from "./pages/TrainingPage";
import { FloatingChat } from "./components/FloatingChat";

function AppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard/:tab?"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {/* Global Floating Chat - only visible when authenticated */}
      {isAuthenticated && <FloatingChat />}
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ContinuousListeningProvider>
          <AppContent />
        </ContinuousListeningProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
