import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.email || !formData.password) {
      setError(t("auth.login.emailRequired"));
      return;
    }

    try {
      await login(formData.email, formData.password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.login.error"));
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-2 text-slate-900">
          {t("auth.login.title")}
        </h1>
        <p className="text-center text-slate-600 mb-8">
          {t("auth.login.subtitle")}
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              {t("auth.login.emailLabel")}
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
              required
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              {t("auth.login.passwordLabel")}
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={isLoading}
              required
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full mt-6">
            {isLoading ? t("auth.login.signingIn") : t("auth.login.signIn")}
          </Button>
        </form>

        <p className="text-center text-slate-600 mt-6">
          {t("auth.login.dontHaveAccount")}{" "}
          <Link
            to="/signup"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            {t("auth.login.createOne")}
          </Link>
        </p>
      </div>
    </div>
  );
}
