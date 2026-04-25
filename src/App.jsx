import React, { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useAuth } from "./contexts/AuthContext";
import LoginScreen from "./components/LoginScreen";
import Scoreboard from "./components/Scoreboard";
import "./App.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: '20px', background: '#111', height: '100vh', overflow: 'auto' }}>
          <h2>Application Crashed</h2>
          <pre>{this.state.error?.stack || this.state.error?.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function TitleParticles() {
  const count = 150;
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data = useMemo(() =>
    Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 28,
      y: Math.random() * 16 - 3,
      z: (Math.random() - 0.5) * 28,
      speed: 0.15 + Math.random() * 0.5,
      scale: 0.03 + Math.random() * 0.08,
    })), []);

  useEffect(() => {
    data.forEach((d, i) => {
      dummy.position.set(d.x, d.y, d.z);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((_, dt) => {
    const mat = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    data.forEach((d, i) => {
      meshRef.current.getMatrixAt(i, mat);
      mat.decompose(pos, quat, sc);
      pos.y += d.speed * dt;
      if (pos.y > 13) pos.y = -3;
      dummy.position.copy(pos);
      dummy.scale.copy(sc);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#ff4060" transparent opacity={0.45} />
    </instancedMesh>
  );
}

function TitleScene() {
  return (
    <Canvas camera={{ position: [0, 4, 14], fov: 50 }} style={{ position: "absolute", inset: 0, zIndex: 0 }}>
      <color attach="background" args={["#06060e"]} />
      <TitleParticles />
    </Canvas>
  );
}

function TitleScreen({ onEnter }) {
  return (
    <div className="title-screen">
      <TitleScene />
      <div className="title-overlay">
        <h1 className="title-logo">THERMOPOLIS</h1>
        <p className="title-tagline">Every surface choice has a measurable temperature consequence.</p>
        <button className="enter-btn" onClick={onEnter}>ENTER CITY</button>
        <div className="title-badges">
          <span>React</span>
          <span>Three.js r{THREE.REVISION}</span>
          <span>Firebase</span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MATERIALS DATA
   ══════════════════════════════════════════════════════════════════════ */
const MATERIALS = {
  asphalt: { name: "Asphalt", cost: 0, albedo: 0.05, etCooling: 0, thermalMass: "Very High", diffusionRadius: 0, color: "#2C2C2C", notes: "Starting material, worst heat" },
  concrete: { name: "Concrete pavement", cost: 50, albedo: 0.30, etCooling: 0, thermalMass: "High", diffusionRadius: 0, color: "#A0A0A0", notes: "Cheap upgrade, minor help" },
  gravel: { name: "Gravel / light pavement", cost: 80, albedo: 0.45, etCooling: 0, thermalMass: "Medium", diffusionRadius: 0, color: "#C8B89A", notes: "Decent albedo, no cooling" },
  grass: { name: "Grass / lawn", cost: 120, albedo: 0.25, etCooling: 35, thermalMass: "Low", diffusionRadius: 1, color: "#7EC850", notes: "Moderate cooling, wide availability" },
  greenRoof: { name: "Green roof", cost: 200, albedo: 0.30, etCooling: 50, thermalMass: "Low", diffusionRadius: 1, color: "#5A8C3C", notes: "Good ET, applied to buildings only" },
  coolRoof: { name: "White / cool roof", cost: 150, albedo: 0.70, etCooling: 0, thermalMass: "Low", diffusionRadius: 0, color: "#F0F0F0", notes: "High albedo but zero ET — only helps that cell" },
  reflectivePavement: { name: "Reflective pavement", cost: 180, albedo: 0.60, etCooling: 0, thermalMass: "Medium", diffusionRadius: 0, color: "#E8E0C8", notes: "Good reflection, no cooling radius" },
  shrubs: { name: "Shrubs / hedgerow", cost: 160, albedo: 0.22, etCooling: 45, thermalMass: "Low", diffusionRadius: 1, color: "#4A7A28", notes: "Mid-tier, good value" },
  smallTree: { name: "Small tree", cost: 250, albedo: 0.20, etCooling: 60, thermalMass: "Low", diffusionRadius: 1, color: "#3A6B20", notes: "Solid cooling radius" },
  matureTree: { name: "Mature tree", cost: 400, albedo: 0.18, etCooling: 85, thermalMass: "Low", diffusionRadius: 2, color: "#2D5218", notes: "Best ET, wide radius, expensive" },
  waterFeature: { name: "Water feature / pond", cost: 350, albedo: 0.10, etCooling: 90, thermalMass: "Very High", diffusionRadius: 2, color: "#4A90D9", notes: "Excellent ET but only if 2×2 or larger" },
  wetland: { name: "Wetland / rain garden", cost: 300, albedo: 0.12, etCooling: 95, thermalMass: "Medium", diffusionRadius: 2, color: "#6B9E6B", notes: "Highest cooling but placement-dependent" },
  permeablePavement: { name: "Permeable pavement", cost: 200, albedo: 0.40, etCooling: 20, thermalMass: "Low", diffusionRadius: 0, color: "#B8A882", notes: "Absorbs water, mild ET in wet conditions" },
  solarPanels: { name: "Solar panels", cost: 300, albedo: 0.10, etCooling: 0, thermalMass: "Low", diffusionRadius: 0, color: "#1A1A4A", notes: "Low albedo (hot!) but earns back $50/turn" }
};

/* ══════════════════════════════════════════════════════════════════════
   GAME CONSTANTS & SURFACE SCIENCE DATA
   ══════════════════════════════════════════════════════════════════════ */

const MATERIALS = {
  Asphalt: { albedo: 0.05, cooling: 0, cost: 0, color: "#222222" },
  Concrete: { albedo: 0.30, cooling: 2, cost: 5000, color: "#888888" },
  "White Roof": { albedo: 0.70, cooling: 5, cost: 20000, color: "#ffffff" },
  Grass: { albedo: 0.25, cooling: 8, cost: 15000, color: "#3a9e40" },
  Water: { albedo: 0.10, cooling: 8, cost: 25000, color: "#2a7aaa" },
  "Tree Canopy": { albedo: 0.20, cooling: 12, cost: 30000, color: "#2d6b31" },
};

const BASE_TEMP = 25; // °C
const SOLAR_CONSTANT = 18; // Max temp addition from sun

// Kenney City Kit Models
const SKYSCRAPER_MODELS = [
  "/models/building-skyscraper-a.glb", "/models/building-skyscraper-b.glb",
  "/models/building-skyscraper-c.glb", "/models/building-skyscraper-d.glb",
  "/models/building-skyscraper-e.glb",
];
const LARGE_BUILDING_MODELS = [
  "/models/building-a.glb", "/models/building-b.glb", "/models/building-c.glb",
  "/models/building-d.glb", "/models/building-e.glb", "/models/building-f.glb",
  "/models/building-g.glb", "/models/building-h.glb", "/models/building-i.glb",
  "/models/building-j.glb", "/models/building-k.glb", "/models/building-l.glb",
  "/models/building-m.glb", "/models/building-n.glb",
];
const LOW_DETAIL_MODELS = [
  "/models/low-detail-building-a.glb", "/models/low-detail-building-b.glb",
  "/models/low-detail-building-c.glb", "/models/low-detail-building-d.glb",
  "/models/low-detail-building-e.glb", "/models/low-detail-building-f.glb",
  "/models/low-detail-building-g.glb", "/models/low-detail-building-h.glb",
  "/models/low-detail-building-i.glb", "/models/low-detail-building-j.glb",
  "/models/low-detail-building-k.glb", "/models/low-detail-building-l.glb",
  "/models/low-detail-building-m.glb", "/models/low-detail-building-n.glb",
];
const WIDE_BUILDING_MODELS = [
  "/models/low-detail-building-wide-a.glb", "/models/low-detail-building-wide-b.glb",
];

const ALL_MODELS = [...SKYSCRAPER_MODELS, ...LARGE_BUILDING_MODELS, ...LOW_DETAIL_MODELS, ...WIDE_BUILDING_MODELS];
ALL_MODELS.forEach((path) => useGLTF.preload(path));

/* ══════════════════════════════════════════════════════════════════════
   CITY LAYOUT GENERATOR
   ══════════════════════════════════════════════════════════════════════ */

const MODEL_SCALE = 6;
const BLOCK_SIZE = 7;
const ROAD_WIDTH = 3;
const CELL = BLOCK_SIZE + ROAD_WIDTH; // 10
const GRID_COLS = 12;
const GRID_ROWS = 16;

function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function getZone(col, row) {
  if (col >= 4 && col <= 7 && row >= 6 && row <= 10) return "park";
  if (col >= 3 && col <= 8 && row >= 11 && row <= 15) return "downtown";
  if (col >= 3 && col <= 8 && row >= 0 && row <= 3) return "financial";
  if (col <= 1 || col >= 10) return "residential";
  return "mixed";
}

function pickModel(zone, rng) {
  const r = rng();
  switch (zone) {
    case "downtown":
      if (r < 0.50) return SKYSCRAPER_MODELS[Math.floor(rng() * SKYSCRAPER_MODELS.length)];
      if (r < 0.85) return LARGE_BUILDING_MODELS[Math.floor(rng() * LARGE_BUILDING_MODELS.length)];
      return LOW_DETAIL_MODELS[Math.floor(rng() * LOW_DETAIL_MODELS.length)];
    case "financial":
      if (r < 0.40) return SKYSCRAPER_MODELS[Math.floor(rng() * SKYSCRAPER_MODELS.length)];
      if (r < 0.80) return LARGE_BUILDING_MODELS[Math.floor(rng() * LARGE_BUILDING_MODELS.length)];
      return LOW_DETAIL_MODELS[Math.floor(rng() * LOW_DETAIL_MODELS.length)];
    case "residential":
      if (r < 0.15) return LARGE_BUILDING_MODELS[Math.floor(rng() * LARGE_BUILDING_MODELS.length)];
      if (r < 0.25) return WIDE_BUILDING_MODELS[Math.floor(rng() * WIDE_BUILDING_MODELS.length)];
      return LOW_DETAIL_MODELS[Math.floor(rng() * LOW_DETAIL_MODELS.length)];
    case "mixed":
    default:
      if (r < 0.15) return SKYSCRAPER_MODELS[Math.floor(rng() * SKYSCRAPER_MODELS.length)];
      if (r < 0.50) return LARGE_BUILDING_MODELS[Math.floor(rng() * LARGE_BUILDING_MODELS.length)];
      if (r < 0.85) return LOW_DETAIL_MODELS[Math.floor(rng() * LOW_DETAIL_MODELS.length)];
      return WIDE_BUILDING_MODELS[Math.floor(rng() * WIDE_BUILDING_MODELS.length)];
  }
}

function generateInitialGrid() {
  const grid = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const rng = seededRng(col * 1337 + row * 7919 + 42);
      const zone = getZone(col, row);
      const height = buildingHeight(zone, rng);
      const tiers = (zone !== "park" && height > 0) ? buildTiers(height, rng) : [];
      const cx = (col - COLS / 2 + 0.5) * CELL;
      const cz = (row - ROWS / 2 + 0.5) * CELL;
      const color = randomColor(zone, rng);
      const winEmissive = "#000000";  // no window glow in daylight
      const hasAntenna = zone !== "park" && height > 35 && rng() > 0.5;
      const hasWaterTower = height > 14 && rng() > 0.65;

      blocks.push({ col, row, zone, height, tiers, cx, cz, color, windowEmissive: winEmissive, hasAntenna, hasWaterTower });
    }
  }
  return blocks;
}

/* ══════════════════════════════════════════════════════════════════════
   3D SCENE COMPONENTS
   ══════════════════════════════════════════════════════════════════════ */

function NYCBuilding({ block }) {
  const { cx, cz, zone, height, tiers, color, windowEmissive, hasAntenna, hasWaterTower } = block;
  const [hovered, setHovered] = useState(false);

  if (zone === "park" || height === 0 || tiers.length === 0) return null;

  const bw = BLOCK_SIZE * 0.86;
  const bd = BLOCK_SIZE * 0.86;

  let yOffset = 0;
  const tierMeshes = tiers.map((tier, ti) => {
    const tw = bw * tier.scale;
    const td = bd * tier.scale;
    const midY = yOffset + tier.h / 2;
    yOffset += tier.h;
    return (
      <mesh key={ti} position={[0, midY, 0]} castShadow receiveShadow>
        <boxGeometry args={[tw, tier.h, td]} />
        <meshStandardMaterial
          color={hovered ? "#ffdd55" : color}
          roughness={0.18}
          metalness={0.45}
        />
      </mesh>
    );
  });

  return (
    <group
      position={[cx, 0, cz]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {tierMeshes}

      {/* Antenna spire */}
      {hasAntenna && (
        <>
          <mesh position={[0, height + 3.5, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.12, 7, 6]} />
            <meshStandardMaterial color="#aaaaaa" roughness={0.25} metalness={0.85} />
          </mesh>
          <mesh position={[0, height + 7.5, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshBasicMaterial color="#ff3030" />
          </mesh>
        </>
      )}

      {/* Water tower */}
      {hasWaterTower && (
        <group position={[bw * 0.25, height, bd * 0.25]}>
          <mesh position={[0, 1.0, 0]}>
            <cylinderGeometry args={[0.38, 0.48, 2.0, 8]} />
            <meshStandardMaterial color="#5a3a18" roughness={0.92} />
          </mesh>
          <mesh position={[0, 2.2, 0]}>
            <coneGeometry args={[0.5, 0.7, 8]} />
            <meshStandardMaterial color="#4a2e12" roughness={0.92} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// Central Park green area with trees
function ParkArea() {
  const startCol = 4, endCol = 7, startRow = 7, endRow = 13;
  const parkCols = endCol - startCol + 1;
  const parkRows = endRow - startRow + 1;
  const totalW = parkCols * CELL;
  const totalD = parkRows * CELL;
  const cx = ((startCol + parkCols / 2 - 0.5) - COLS / 2) * CELL;
  const cz = ((startRow + parkRows / 2 - 0.5) - ROWS / 2) * CELL;

  const trees = useMemo(() => {
    const arr = [];
    const rng = seededRng(88888);
    for (let i = 0; i < 180; i++) {
      arr.push({
        x: cx + (rng() - 0.5) * totalW * 0.9,
        z: cz + (rng() - 0.5) * totalD * 0.9,
        h: 1.5 + rng() * 3.5,
        r: 0.8 + rng() * 1.4,
        shade: Math.floor(rng() * 12),
      });
    }
    return arr;
  }, [grid.length]);
  
  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();
    
    grid.forEach((c, i) => {
      // Place slightly above the road to not z-fight, cover the cell
      dummy.position.set(c.cx, 0.1, c.cz);
      dummy.scale.set(CELL, 1, CELL);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      
      // Map temp from 20 to 45
      const minT = 20, maxT = 45;
      const t = Math.max(0, Math.min(1, (c.currentTemp - minT) / (maxT - minT)));
      // Blue (cold) to Red (hot)
      tempColor.setHSL((1 - t) * 0.65, 1, 0.5);
      meshRef.current.setColorAt(i, tempColor);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [grid]);

  return (
    <instancedMesh ref={meshRef} args={[null, null, grid.length]}>
      <boxGeometry args={[1, 0.1, 1]} />
      <meshBasicMaterial transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      <instancedBufferAttribute attach="instanceColor" args={[colorArray, 3]} />
    </instancedMesh>
  );
}

// Ground plane
function Ground() {
  const totalW = GRID_COLS * CELL + 60;
  const totalD = GRID_ROWS * CELL + 60;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[totalW, totalD]} />
      <meshStandardMaterial color="#333333" roughness={0.97} />
    </mesh>
  );
}

// Loading fallback
function LoadingFallback() {
  const meshRef = useRef();
  useFrame((_, dt) => { if (meshRef.current) meshRef.current.rotation.y += dt * 2; });
  return (
    <mesh ref={meshRef} position={[0, 2, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#00ffc8" wireframe />
    </mesh>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CITY VIEW - MAIN APP
   ══════════════════════════════════════════════════════════════════════ */

// Daytime haze
function SceneFog() {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.FogExp2("#c8ddf0", 0.004);
    return () => { scene.fog = null; };
  }, [scene]);
  return null;
}

/* ══════════════════════════════════════════════════════════════════════
   CITY VIEW
   ══════════════════════════════════════════════════════════════════════ */

function CityScene({ blocks }) {
  return (
    <>
      <SceneFog />
      <color attach="background" args={["#87ceeb"]} />
      <Sky distance={4500} sunPosition={[100, 40, -80]} inclination={0.52} azimuth={0.22} turbidity={6} rayleigh={0.8} />
      <ambientLight intensity={0.75} color="#fff4e0" />
      <directionalLight position={[100, 140, -80]} intensity={3.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-far={500} shadow-camera-left={-130} shadow-camera-right={130} shadow-camera-top={130} shadow-camera-bottom={-130} shadow-bias={-0.0005} />
      
      <Ground />
      <Roads />
      <ParkArea />
      {blocks.map((b, i) => <NYCBuilding key={i} block={b} />)}
      <StreetLights />

      <OrbitControls
        enableDamping
        dampingFactor={0.07}
        minDistance={8}
        maxDistance={320}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 12, 0]}
      />
    </>
  );
}

function CityView({ onBack }) {
  const blocks = useMemo(() => generateNYC(), []);

  return (
    <div className="city-layout">
      {/* ─── LEFT PANEL ─── */}
      <div className="panel left-panel">
        <button className="back-btn" onClick={onBack}>← TITLE SCREEN</button>
        <h2 className="panel-title">CONTROLS</h2>
        
        <div className="mode-toggle">
          <button className={mode === "BUDGET" ? "active" : ""} onClick={() => setMode("BUDGET")}>Budget Mode</button>
          <button className={mode === "HEAT_HUNT" ? "active" : ""} onClick={() => setMode("HEAT_HUNT")}>Heat Hunt</button>
        </div>

        {mode === "BUDGET" && (
          <div className="mode-content budget-mode">
            <div className="budget-display">
              <h4>REMAINING BUDGET</h4>
              <div className="budget-val">${budget.toLocaleString()}</div>
            </div>
            
            <h4>SURFACE MATERIALS</h4>
            <div className="materials-list">
              {Object.entries(MATERIALS).map(([name, data]) => (
                <div 
                  key={name} 
                  className={`material-card ${selectedMaterial === name ? "active" : ""}`}
                  onClick={() => setSelectedMaterial(name)}
                >
                  <div className="mat-header">
                    <span className="mat-name">{name}</span>
                    <span className="mat-cost">${data.cost / 1000}k</span>
                  </div>
                  <div className="mat-stats">
                    <span>Albedo: {data.albedo}</span>
                    <span>Cooling: {data.cooling}°</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === "HEAT_HUNT" && (
          <div className="mode-content heat-hunt-mode">
            <h4>SENSOR READINGS</h4>
            <p className="hint-text">Click anywhere in the city to drop a thermal sensor.</p>
            <div className="sensor-log">
              {sensorLog.length === 0 && <span className="empty-log">No readings yet.</span>}
              {sensorLog.map((log, i) => (
                <div key={i} className="log-entry">
                  <span className="time">{log.time}</span>
                  <span className="loc">[{log.loc}]</span>
                  <span className="temp">{log.temp}°C</span>
                </div>
              ))}
            </div>
            <button className="lock-in-btn" onClick={() => alert("Simulation Locked In! Final Evaluation Pending.")}>LOCK IN DESIGN</button>
          </div>
        )}
      </div>

      {/* ─── CENTER 3D CANVAS ─── */}
      <div className="center-canvas">
        <Canvas shadows camera={{ position: [70, 55, 70], fov: 45 }} gl={{ antialias: true, powerPreference: "high-performance" }}>
          <CityScene grid={grid} onGridClick={handleGridClick} />
        </Canvas>
      </div>

      {/* ─── RIGHT PANEL ─── */}
      <div className="panel right-panel">
        <h2 className="panel-title">LIVE STATS</h2>
        
        <div className="stat-box">
          <h4>Avg City Temp</h4>
          <div className="value" style={{ color: avgTemp > 35 ? "#ff4060" : "#00ffc8" }}>
            {avgTemp.toFixed(1)} °C
          </div>
        </div>

        <div className="stat-box">
          <h4>Hottest Block</h4>
          <div className="value" style={{ color: "#ff4060", fontSize: "18px" }}>
            {hottest.currentTemp.toFixed(1)}°C <span style={{fontSize: "12px", color: "#888"}}>({hottest.zone})</span>
          </div>
        </div>

        <div className="stat-box">
          <h4>Coolest Block</h4>
          <div className="value" style={{ color: "#00aaff", fontSize: "18px" }}>
            {coolest.currentTemp.toFixed(1)}°C <span style={{fontSize: "12px", color: "#888"}}>({coolest.zone})</span>
          </div>
        </div>

        <div className="stat-box">
          <h4>Material Breakdown</h4>
          <div className="material-breakdown">
            {Object.entries(materialCounts).map(([mat, count]) => (
              <div key={mat} className="mat-count-row">
                <span className="dot" style={{ background: MATERIALS[mat].color }}></span>
                <span className="mat-name">{mat}</span>
                <span className="mat-count">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stat-box temp-legend">
          <h4>Temp Legend</h4>
          <div className="gradient-bar"></div>
          <div className="gradient-labels">
            <span>20°C</span>
            <span>32°C</span>
            <span>45°C</span>
          </div>
        </div>
        <button className="hud-btn" onClick={() => setShowBoard(true)}>🏆 BOARD</button>
        {user && (
          <div className="hud-user">
            <span className="hud-user-name">{user.displayName || user.email}</span>
            <button className="hud-btn hud-btn-out" onClick={handleLogOut}>SIGN OUT</button>
          </div>
        )}
      </div>

      {/* Material Panel */}
      <div className="material-panel">
        <h3 className="panel-title">MATERIALS</h3>
        <div className="material-list">
          {Object.entries(MATERIALS).map(([key, mat]) => (
            <div 
              key={key} 
              className={`material-item ${selectedMaterial === key ? 'selected' : ''}`}
              onClick={() => setSelectedMaterial(key)}
            >
              <div className="material-color" style={{ background: mat.color }} />
              <div className="material-info">
                <div className="material-name">{mat.name} <span className="material-cost">${mat.cost}</span></div>
                <div className="material-stats">Albedo: {mat.albedo} | ET: {mat.etCooling} W/m²</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zone legend */}
      <div className="city-legend">
        <div className="legend-item"><span className="dot" style={{ background: "#b8ccd8" }} />Midtown</div>
        <div className="legend-item"><span className="dot" style={{ background: "#bcc8d0" }} />Financial District</div>
        <div className="legend-item"><span className="dot" style={{ background: "#1d5c25" }} />Central Park</div>
        <div className="legend-item"><span className="dot" style={{ background: "#8890a0" }} />Mixed Use</div>
        <div className="legend-item"><span className="dot" style={{ background: "#8a8070" }} />Residential</div>
      </div>

      {/* Scoreboard overlay */}
      <Scoreboard visible={showBoard} onClose={() => setShowBoard(false)} />

      <Canvas
        shadows
        camera={{ position: [100, 90, 100], fov: 42 }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        gl={{ antialias: true }}
      >
        <CityScene blocks={blocks} onBuildingClick={handleBuildingClick} />
      </Canvas>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   APP ROOT
   ══════════════════════════════════════════════════════════════════════ */

export default function App() {
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState("title");

  // Show loading spinner while Firebase checks auth
  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
      </div>
    );
  }

  // Not signed in → show login
  if (!user) return <LoginScreen />;

  // Signed in → normal flow
  if (screen === "city") return <CityView onBack={() => setScreen("title")} />;
  return <TitleScreen onEnter={() => setScreen("city")} />;
}

