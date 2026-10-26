import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "@/lib/api/http";
import { api } from "@/lib/api/client";
import { usePageTitle } from "@/lib/usePageTitle";

export function ForgotPasswordPage() {
  usePageTitle("Reset password");

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetComplete, setIsResetComplete] = useState(false);

  useEffect(() => {
    if (!isResetComplete) return;

    const redirectTimer = window.setTimeout(() => {
      navigate("/login", { replace: true });
    }, 5000);

    return () => window.clearTimeout(redirectTimer);
  }, [isResetComplete, navigate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      if (token) {
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }
        await api.confirmPasswordReset({ token, password });
        setMessage(
          "Your password has been reset. Redirecting to sign in in 5 seconds.",
        );
        setIsResetComplete(true);
      } else {
        await api.requestPasswordReset(email);
        setMessage("Password reset email sent.");
      }
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm " +
    "focus:border-accent focus:outline-none";

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="text-center text-xl font-semibold tracking-tight">
        {token ? "Choose a new password" : "Reset your password"}
      </h1>
      <p className="mt-1 text-center text-sm text-muted">
        {token
          ? "Enter a new password for your account."
          : "Enter your account email and we'll send you a reset link."}
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 space-y-4 rounded-2xl border border-line bg-surface p-5"
      >
        {message && (
          <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {!token ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
          </label>
        ) : (
          <>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">
                New password
              </span>
              <input
                type="password"
                required
                minLength={8}
                maxLength={32}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">
                Confirm password
              </span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={inputClass}
              />
            </label>
          </>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-accent px-4 py-2.5 font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? token
              ? "Saving..."
              : "Sending..."
            : token
              ? "Reset password"
              : "Send reset link"}
        </button>

        <p className="text-center text-sm text-muted">
          <Link to="/login" className="text-accent hover:text-accent-hover">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
