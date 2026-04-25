import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthChange, saveUserProfile, logOut } from "../firebase";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Save / merge user profile on every login
        try {
          await saveUserProfile(firebaseUser);
        } catch (err) {
          console.warn("Could not save user profile:", err);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleLogOut = async () => {
    try {
      await logOut();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logOut: handleLogOut }}>
      {children}
    </AuthContext.Provider>
  );
}
