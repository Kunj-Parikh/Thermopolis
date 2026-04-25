import React, { useState } from "react";
import { signUpWithEmail, signInWithEmail, signInWithGoogle } from "../firebase";
import "./LoginScreen.css";

export default function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        const cred = await signUpWithEmail(email, password);
        // Update display name if provided
        if (displayName.trim()) {
          const { updateProfile } = await import("firebase/auth");
          await updateProfile(cred.user, { displayName: displayName.trim() });
        }
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      const msg = err.code?.replace("auth/", "").replace(/-/g, " ") || err.message;
      setError(msg.charAt(0).toUpperCase() + msg.slice(1));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        const msg = err.code?.replace("auth/", "").replace(/-/g, " ") || err.message;
        setError(msg.charAt(0).toUpperCase() + msg.slice(1));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      {/* Animated background grid */}
      <div className="login-grid-bg" />

      <div className="login-container">
        {/* Logo */}
        <h1 className="login-logo">THERMOPOLIS</h1>
        <p className="login-subtitle">
          {isSignUp ? "Create your account" : "Sign in to continue"}
        </p>

        {/* Error message */}
        {error && <div className="login-error">{error}</div>}

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="login-field">
              <label htmlFor="displayName">DISPLAY NAME</label>
              <input
                id="displayName"
                type="text"
                placeholder="Your name on the leaderboard"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}

          <div className="login-field">
            <label htmlFor="email">EMAIL</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">PASSWORD</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="login-spinner" />
            ) : isSignUp ? (
              "CREATE ACCOUNT"
            ) : (
              "SIGN IN"
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="login-divider">
          <span>OR</span>
        </div>

        {/* Google sign-in */}
        <button
          className="login-google-btn"
          onClick={handleGoogle}
          disabled={loading}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" className="google-icon">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </button>

        {/* Toggle sign-up / sign-in */}
        <p className="login-toggle">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}
          <button
            type="button"
            className="login-toggle-btn"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
