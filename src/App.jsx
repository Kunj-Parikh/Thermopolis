import { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sky, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useAuth } from "./contexts/AuthContext";
import LoginScreen from "./components/LoginScreen";
import Scoreboard from "./components/Scoreboard";
import "./App.css";

/* ══════════════════════════════════════════════════════════════════════
   TITLE SCREEN
   ══════════════════════════════════════════════════════════════════════ */

function TitleParticles() {
  const count = 150;
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const [data] = useState(() =>
    Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 28,
      y: Math.random() * 16 - 3,
      z: (Math.random() - 0.5) * 28,
      speed: 0.15 + Math.random() * 0.5,
      scale: 0.03 + Math.random() * 0.08,
    }))
  );

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
   GAME CONSTANTS & SURFACE SCIENCE DATA
   ══════════════════════════════════════════════════════════════════════ */

const MATERIALS = {
  Asphalt: { albedo: 0.05, cooling: 0, cost: 1000, color: "#222222" },
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
      const cx = (col - GRID_COLS / 2 + 0.5) * CELL;
      const cz = (row - GRID_ROWS / 2 + 0.5) * CELL;
      const rotY = Math.floor(rng() * 4) * (Math.PI / 2);
      const scaleVar = 0.85 + rng() * 0.35;
      
      let initialMaterial = "Asphalt";
      if (zone === "park") initialMaterial = "Grass";

      const isBuilding = zone !== "park";
      const modelPath = isBuilding ? pickModel(zone, rng) : null;
      
      let heightBonus = 0;
      if (modelPath?.includes("skyscraper")) heightBonus = 4;
      else if (modelPath?.includes("building-")) heightBonus = 2;
      else if (isBuilding) heightBonus = 1;

      grid.push({
        col, row, zone, cx, cz, rotY, scaleVar, modelPath, isBuilding,
        material: initialMaterial,
        baseTemp: BASE_TEMP,
        heightBonus,
        currentTemp: BASE_TEMP,
        key: `${col}_${row}`
      });
    }
  }
  return grid;
}

// Hook for simulation loop
function useInterval(callback, delay) {
  const savedCallback = useRef();
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current(), delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

/* ══════════════════════════════════════════════════════════════════════
   3D COMPONENTS
   ══════════════════════════════════════════════════════════════════════ */

function KenneyBuilding({ modelPath, position, rotation, scale, appliedMaterial }) {
  const { scene } = useGLTF(modelPath);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  
  const { box, size, center, roofY } = useMemo(() => {
    const b = new THREE.Box3().setFromObject(clonedScene);
    const s = b.getSize(new THREE.Vector3());
    const c = b.getCenter(new THREE.Vector3());
    
    // Raycast downwards to find the actual roof height, ignoring thin antennas in the middle
    const raycaster = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const offsets = [
      [0.25, 0.25], [-0.25, 0.25], [0.25, -0.25], [-0.25, -0.25],
      [0, 0.3], [0, -0.3], [0.3, 0], [-0.3, 0] // some additional edge points
    ];
    
    let highestHitY = -Infinity;
    
    offsets.forEach(([dx, dz]) => {
      const origin = new THREE.Vector3(c.x + s.x * dx, b.max.y + 0.1, c.z + s.z * dz);
      raycaster.set(origin, down);
      const intersects = raycaster.intersectObject(clonedScene, true);
      if (intersects.length > 0) {
        if (intersects[0].point.y > highestHitY) {
          highestHitY = intersects[0].point.y;
        }
      }
    });

    const finalRoofY = highestHitY > -Infinity ? highestHitY : b.max.y;

    return { box: b, size: s, center: c, roofY: finalRoofY };
  }, [clonedScene]);

  const showOverlay = appliedMaterial && appliedMaterial !== "Asphalt";
  const overlayColor = showOverlay ? MATERIALS[appliedMaterial].color : "#ffffff";
  const overlayThickness = 0.08;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={clonedScene} castShadow receiveShadow />
      {showOverlay && (
        <mesh position={[center.x, roofY + overlayThickness / 2 + 0.01, center.z]} castShadow receiveShadow>
          <boxGeometry args={[size.x * 0.9, overlayThickness, size.z * 0.9]} />
          <meshStandardMaterial color={overlayColor} roughness={0.8} />
        </mesh>
      )}
    </group>
  );
}

function HeatMap({ grid }) {
  const meshRef = useRef();
  
  // Pre-allocate a color buffer for the instanced mesh
  const colorArray = useMemo(() => {
    const arr = new Float32Array(grid.length * 3);
    for (let i = 0; i < grid.length * 3; i++) arr[i] = 1; // Default white
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

// SceneFog replaced by <fogExp2 /> in CityScene

function CityScene({ grid, onGridClick }) {
  return (
    <>
      <fogExp2 attach="fog" args={["#c8ddf0", 0.004]} />
      <color attach="background" args={["#87ceeb"]} />
      <Sky distance={4500} sunPosition={[100, 40, -80]} inclination={0.52} azimuth={0.22} turbidity={6} rayleigh={0.8} />
      <ambientLight intensity={0.75} color="#fff4e0" />
      <directionalLight position={[100, 140, -80]} intensity={3.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-far={500} shadow-camera-left={-130} shadow-camera-right={130} shadow-camera-top={130} shadow-camera-bottom={-130} shadow-bias={-0.0005} />
      
      <Ground />
      
      {/* Interaction Plane */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.2, 0]} onPointerDown={onGridClick}>
        <planeGeometry args={[GRID_COLS * CELL, GRID_ROWS * CELL]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <HeatMap grid={grid} />

      <Suspense fallback={<LoadingFallback />}>
        <group>
          {grid.map(c => {
            if (!c.isBuilding) {
              const matColor = MATERIALS[c.material].color;
              return (
                <mesh key={c.key} position={[c.cx, 0.1, c.cz]} receiveShadow>
                  <boxGeometry args={[CELL-0.5, 0.2, CELL-0.5]} />
                  <meshStandardMaterial color={matColor} roughness={0.9} />
                </mesh>
              );
            }
            return (
              <KenneyBuilding
                key={c.key}
                modelPath={c.modelPath}
                position={[c.cx, 0, c.cz]}
                rotation={[0, c.rotY, 0]}
                scale={[MODEL_SCALE * c.scaleVar, MODEL_SCALE * c.scaleVar, MODEL_SCALE * c.scaleVar]}
                appliedMaterial={c.material}
              />
            );
          })}
        </group>
      </Suspense>

      <OrbitControls enableDamping dampingFactor={0.07} minDistance={8} maxDistance={320} maxPolarAngle={Math.PI / 2.05} target={[0, 5, 0]} listenToKeyEvents={window} keyPanSpeed={15} />
    </>
  );
}

function CityView({ onBack }) {
  const [grid, setGrid] = useState(generateInitialGrid);
  const [budget, setBudget] = useState(1000000); // $250k starting budget
  const [mode, setMode] = useState("BUDGET"); // "BUDGET" or "HEAT_HUNT"
  const [selectedMaterial, setSelectedMaterial] = useState("White Roof");
  const [sensorLog, setSensorLog] = useState([]);

  // Heat Simulation Loop (runs every 1 second)
  useInterval(() => {
    let currentGrid = grid.map(c => ({...c}));
    
    // 1. Calculate local target equilibrium for each cell
    for (let i = 0; i < currentGrid.length; i++) {
      const c = currentGrid[i];
      const mat = MATERIALS[c.material];
      const targetTemp = c.baseTemp + (1 - mat.albedo) * SOLAR_CONSTANT - mat.cooling + c.heightBonus;
      // Move current slowly towards target
      c.currentTemp += (targetTemp - c.currentTemp) * 0.15;
    }

    // 2. Perform 15 Diffusion Passes
    for (let pass = 0; pass < 15; pass++) {
      let nextGrid = currentGrid.map(c => ({...c}));
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const idx = r * GRID_COLS + c;
          let tempSum = currentGrid[idx].currentTemp;
          let count = 1;
          
          if (r > 0) { tempSum += currentGrid[(r-1)*GRID_COLS + c].currentTemp; count++; }
          if (r < GRID_ROWS-1) { tempSum += currentGrid[(r+1)*GRID_COLS + c].currentTemp; count++; }
          if (c > 0) { tempSum += currentGrid[r*GRID_COLS + c - 1].currentTemp; count++; }
          if (c < GRID_COLS-1) { tempSum += currentGrid[r*GRID_COLS + c + 1].currentTemp; count++; }
          
          nextGrid[idx].currentTemp = tempSum / count;
        }
      }
      currentGrid = nextGrid;
    }
    setGrid(currentGrid);
  }, 1000);

  // Interaction Handler
  const handleGridClick = (e) => {
    e.stopPropagation();
    const hitCol = Math.floor(e.point.x / CELL) + Math.floor(GRID_COLS / 2);
    const hitRow = Math.floor(e.point.z / CELL) + Math.floor(GRID_ROWS / 2);
    
    if (hitCol >= 0 && hitCol < GRID_COLS && hitRow >= 0 && hitRow < GRID_ROWS) {
      const cellIndex = hitRow * GRID_COLS + hitCol;
      const cell = grid[cellIndex];

      if (mode === "BUDGET") {
        const matData = MATERIALS[selectedMaterial];
        if (cell.material !== selectedMaterial && budget >= matData.cost) {
          setBudget(prev => prev - matData.cost);
          const newGrid = [...grid];
          newGrid[cellIndex] = { ...cell, material: selectedMaterial };
          setGrid(newGrid);
        }
      } else if (mode === "HEAT_HUNT") {
        setSensorLog(prev => [
          { time: new Date().toLocaleTimeString(), loc: `${hitCol},${hitRow}`, temp: cell.currentTemp.toFixed(1) },
          ...prev
        ].slice(0, 10)); // keep last 10
      }
    }
  };

  // Stats computation
  const avgTemp = grid.reduce((acc, c) => acc + c.currentTemp, 0) / grid.length;
  const sortedByTemp = [...grid].sort((a, b) => b.currentTemp - a.currentTemp);
  const hottest = sortedByTemp[0];
  const coolest = sortedByTemp[sortedByTemp.length - 1];

  const materialCounts = grid.reduce((acc, c) => {
    acc[c.material] = (acc[c.material] || 0) + 1;
    return acc;
  }, {});
  const { user, logOut: handleLogOut } = useAuth();
  const [showBoard, setShowBoard] = useState(false);

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

      {/* Scoreboard overlay */}
      <Scoreboard visible={showBoard} onClose={() => setShowBoard(false)} />
    </div>
  );
}

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

