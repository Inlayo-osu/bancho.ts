import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ApiError } from "@/lib/api/http";
import { api } from "@/lib/api/client";
import { usePageTitle } from "@/lib/usePageTitle";

export function VerifyEmailPage() {
  usePageTitle("Verify email");

  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error",
  );
  const [error, setError] = useState<string | null>(
    token ? null : "This verification link is missing its token.",
  );
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!token) return;

    api.confirmEmailVerification(token)
      .then(() => setStatus("success"))
      .catch((verificationError) => {
        setStatus("error");
        setError(
          verificationError instanceof ApiError
            ? verificationError.message
            : "This verification link is invalid or has expired.",
        );
      });
  }, [token]);

  async function resendVerification(event: FormEvent) {
    event.preventDefault();
    if (!email) return;
    setError(null);
    setResendMessage(null);
    setIsResending(true);

    try {
      await api.requestEmailVerification(email);
      setResendMessage("A new verification link has been sent.");
    } catch (resendError) {
      setError(
        resendError instanceof ApiError
          ? resendError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="rounded-2xl border border-line bg-surface p-5 text-center">
        {status === "loading" && !error && (
          <>
            <h1 className="text-xl font-semibold tracking-tight">
              Check your email
            </h1>
            <p className="mt-2 text-sm text-muted">
              We sent a verification link to {email ?? "your email address"}.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="text-xl font-semibold tracking-tight">
              Email verified
            </h1>
            <p className="mt-2 text-sm text-muted">
              Your account is ready. You can sign in now.
            </p>
            <Link
              to="/login"
              className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Sign in
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-xl font-semibold tracking-tight">
              Verification failed
            </h1>
            <p className="mt-2 text-sm text-red-300">{error}</p>
            {email && (
              <form onSubmit={resendVerification} className="mt-5">
                <button
                  type="submit"
                  disabled={isResending}
                  className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResending ? "Sending..." : "Send a new link"}
                </button>
              </form>
            )}
          </>
        )}

        {status === "loading" && error && (
          <p className="mt-4 text-sm text-accent">{error}</p>
        )}
        {resendMessage && (
          <p role="status" className="mt-4 text-sm text-emerald-300">
            {resendMessage}
          </p>
        )}
      </div>
    </div>
  );
}
