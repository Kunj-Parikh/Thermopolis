import React, { useState, useEffect } from "react";
import { onLeaderboardUpdate } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import "./Scoreboard.css";

export default function Scoreboard({ visible, onClose }) {
  const { user } = useAuth();
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const unsub = onLeaderboardUpdate((newScores) => {
      setScores(newScores);
      setLoading(false);
    });
    return unsub;
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="scoreboard-overlay" onClick={onClose}>
      <div className="scoreboard-panel" onClick={(e) => e.stopPropagation()}>
        <div className="scoreboard-header">
          <div className="scoreboard-header-left">
            <span className="scoreboard-icon"></span>
            <h2 className="scoreboard-title">LEADERBOARD</h2>
          </div>
          <button className="scoreboard-close" onClick={onClose}>✕</button>
        </div>

        <div className="scoreboard-content">
          {loading ? (
            <div className="scoreboard-loading">
              <div className="scoreboard-spinner" />
              <span>Loading scores…</span>
            </div>
          ) : scores.length === 0 ? (
            <div className="scoreboard-empty">
              <p>No scores yet!</p>
              <p className="scoreboard-empty-sub">Play a game to be first on the board.</p>
            </div>
          ) : (
            <table className="scoreboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>PLAYER</th>
                  <th>MODE</th>
                  <th>SCORE</th>
                  <th>DATE</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s, i) => {
                  const isMe = user && s.userId === user.uid;
                  const date = s.timestamp
                    ? new Date(s.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : "—";
                  return (
                    <tr key={s.id} className={`scoreboard-row ${isMe ? "row-me" : ""}`} style={{ animationDelay: `${i * 0.05}s` }}>
                      <td>{i + 1}</td>
                      <td>
                        {s.playerName || s.userId?.slice(0, 8) || "Anon"}
                        {isMe && <span className="you-badge">YOU</span>}
                      </td>
                      <td>{s.mode || "—"}</td>
                      <td className="score-val">{s.score?.toLocaleString() ?? "—"}</td>
                      <td>{date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="scoreboard-footer">
          <span>Top 10 • Real-time updates</span>
        </div>
      </div>
    </div>
  );
}
