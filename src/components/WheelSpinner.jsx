import React, { useState } from "react";
import "./WheelSpinner.css";

const PRIZES = [
  { label: "$10k", value: 10000, color: "#ff4060" },
  { label: "$50k", value: 50000, color: "#ffaa20" },
  { label: "$100k", value: 100000, color: "#3a9e40" },
  { label: "$250k", value: 250000, color: "#2a7aaa" },
  { label: "$500k", value: 500000, color: "#aa3bff" },
  { label: "$1M", value: 1000000, color: "#00ffc8" },
];

export default function WheelSpinner({ visible, onClose, onWin }) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);

  if (!visible) return null;

  const spin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setResult(null);

    // Pick a random prize to win
    const targetIndex = Math.floor(Math.random() * PRIZES.length);
    const segmentAngle = 360 / PRIZES.length;
    
    // We want the targetIndex to end up at 0 degrees (pointing RIGHT where the arrow is)
    // The current angle of targetIndex is targetIndex * segmentAngle
    // So we need to rotate by: 360 - (targetIndex * segmentAngle)
    // Plus a random offset within the segment so it doesn't land perfectly on the line
    const randomOffset = (Math.random() * 0.8 + 0.1) * segmentAngle; // 10% to 90% of segment
    const targetAngle = 360 - (targetIndex * segmentAngle) - randomOffset;
    
    // Add multiple full rotations for effect
    const spins = 6;
    const finalRotation = rotation + (spins * 360) + targetAngle - (rotation % 360);

    setRotation(finalRotation);

    setTimeout(() => {
      setIsSpinning(false);
      const wonPrize = PRIZES[targetIndex];
      setResult(wonPrize);
      onWin(wonPrize.value);
    }, 4000); // 4s spin duration
  };

  return (
    <div className="spinner-overlay" onClick={isSpinning ? null : onClose}>
      <div className="spinner-panel" onClick={(e) => e.stopPropagation()}>
        <div className="spinner-header">
          <h2 className="spinner-title">FUNDING WHEEL</h2>
          <button className="spinner-close" onClick={onClose} disabled={isSpinning}>✕</button>
        </div>
        
        <div className="wheel-container">
          <div className="wheel-arrow">◀</div>
          <svg viewBox="0 0 200 200" width="300" height="300" className="wheel-svg">
            <g 
              transform={`rotate(${rotation} 100 100)`} 
              style={{ transition: isSpinning ? "transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)" : "none" }}
            >
              {PRIZES.map((prize, i) => {
                const angle = 360 / PRIZES.length;
                const startAngle = i * angle;
                const endAngle = (i + 1) * angle;
                
                const x1 = 100 + 100 * Math.cos(Math.PI * startAngle / 180);
                const y1 = 100 + 100 * Math.sin(Math.PI * startAngle / 180);
                const x2 = 100 + 100 * Math.cos(Math.PI * endAngle / 180);
                const y2 = 100 + 100 * Math.sin(Math.PI * endAngle / 180);
                
                const largeArcFlag = angle > 180 ? 1 : 0;
                
                const pathData = [
                  `M 100 100`,
                  `L ${x1} ${y1}`,
                  `A 100 100 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                  `Z`
                ].join(' ');

                // Text position (middle of the slice)
                const midAngle = startAngle + angle / 2;
                const tx = 100 + 65 * Math.cos(Math.PI * midAngle / 180);
                const ty = 100 + 65 * Math.sin(Math.PI * midAngle / 180);

                return (
                  <g key={i}>
                    <path d={pathData} fill={prize.color} stroke="#0a0a16" strokeWidth="2" />
                    <text 
                      x={tx} 
                      y={ty} 
                      fill="#fff" 
                      fontSize="14" 
                      fontFamily="Orbitron" 
                      fontWeight="bold"
                      textAnchor="middle" 
                      alignmentBaseline="middle"
                      transform={`rotate(${midAngle} ${tx} ${ty})`}
                      style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}
                    >
                      {prize.label}
                    </text>
                  </g>
                );
              })}
              {/* Center dot */}
              <circle cx="100" cy="100" r="10" fill="#0a0a16" stroke="#fff" strokeWidth="2" />
            </g>
          </svg>
        </div>

        <div className="spinner-controls">
          <div className="spinner-result-box">
            {result ? (
              <span>You won <strong style={{ color: result.color }}>{result.label}</strong>!</span>
            ) : (
              <span>Test your luck to get more city funds!</span>
            )}
          </div>
          
          <button 
            className="spin-btn" 
            onClick={spin} 
            disabled={isSpinning}
          >
            {isSpinning ? "SPINNING..." : "SPIN NOW"}
          </button>
        </div>
      </div>
    </div>
  );
}
