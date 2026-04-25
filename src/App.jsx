import React, { useState, useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import "./App.css";

/* ══════════════════════════════════════════════════════════════════════
   TITLE SCREEN
   ══════════════════════════════════════════════════════════════════════ */

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
   NYC CITY DATA GENERATOR
   ══════════════════════════════════════════════════════════════════════ */

const BLOCK_SIZE = 7;
const ROAD_WIDTH = 3.5;
const CELL = BLOCK_SIZE + ROAD_WIDTH;  // 10.5 per cell
const COLS = 14;
const ROWS = 22;

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getZone(col, row) {
  // Central Park
  if (col >= 4 && col <= 7 && row >= 7 && row <= 13) return "park";
  // Midtown
  if (col >= 3 && col <= 10 && row >= 14 && row <= 18) return "midtown";
  // Financial district
  if (col >= 4 && col <= 9 && row >= 0 && row <= 4) return "financial";
  // Edge residential
  if (col <= 1 || col >= 12) return "residential";
  return "mixed";
}

function buildingHeight(zone, rng) {
  switch (zone) {
    case "park":        return 0;
    case "midtown":     return 28 + rng() * 80;
    case "financial":   return 22 + rng() * 70;
    case "residential": return 4  + rng() * 14;
    default:            return 6  + rng() * 30;
  }
}

// Setback tiers for NYC-style stepped skyscrapers
function buildTiers(totalH, rng) {
  if (totalH < 8) return [{ h: totalH, scale: 1.0 }];
  const tiers = [];
  let rem = totalH;
  let sc = 1.0;
  while (rem > 4 && tiers.length < 4) {
    const frac = 0.35 + rng() * 0.45;
    tiers.push({ h: rem * frac, scale: sc });
    rem = rem * (1 - frac);
    sc *= 0.60 + rng() * 0.30;
  }
  if (rem > 1) tiers.push({ h: rem, scale: sc * (0.4 + rng() * 0.4) });
  return tiers;
}

// Zone → color palette
const PALETTES = {
  midtown:     ["#b8ccd8","#8aaabf","#c8d8e8","#9ab8cc","#d8e8f0","#7090a8"],
  financial:   ["#bcc8d0","#9aacb8","#ccd8e0","#aac0cc","#d0dce4","#80969e"],
  residential: ["#8a8070","#7a8870","#8a7a6a","#6a7880","#9a8a7a","#7a6a60"],
  mixed:       ["#8890a0","#9a9080","#7a8890","#8a9070","#909880","#8078a0"],
  park:        ["#1e5e28"],
};

function randomColor(zone, rng) {
  const pal = PALETTES[zone] || PALETTES.mixed;
  return pal[Math.floor(rng() * pal.length)];
}

function generateNYC() {
  const blocks = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const rng = seededRng(col * 1009 + row * 31337 + 7);
      const zone = getZone(col, row);
      const height = buildingHeight(zone, rng);
      const tiers = (zone !== "park" && height > 0) ? buildTiers(height, rng) : [];
      const cx = (col - COLS / 2 + 0.5) * CELL;
      const cz = (row - ROWS / 2 + 0.5) * CELL;
      const color = randomColor(zone, rng);
      const windowEmissive = zone !== "park" && height > 0
        ? (rng() > 0.5 ? "#ffd060" : "#80c4ff")
        : "#000000";
      const hasAntenna = zone !== "park" && height > 35 && rng() > 0.5;
      const hasWaterTower = height > 14 && rng() > 0.65;

      blocks.push({ col, row, zone, height, tiers, cx, cz, color, windowEmissive, hasAntenna, hasWaterTower });
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
          color={hovered ? "#00ffc8" : color}
          roughness={0.25}
          metalness={0.55}
          emissive={windowEmissive}
          emissiveIntensity={hovered ? 0 : 0.10}
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
            <meshStandardMaterial color="#999" roughness={0.3} metalness={0.9} />
          </mesh>
          <mesh position={[0, height + 7.5, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshBasicMaterial color="#ff2020" />
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
  }, []);

  return (
    <group>
      {/* Grass */}
      <mesh position={[cx, 0.05, cz]} receiveShadow>
        <boxGeometry args={[totalW, 0.1, totalD]} />
        <meshStandardMaterial color="#1d5c25" roughness={0.97} />
      </mesh>

      {/* Diagonal paths */}
      <mesh position={[cx, 0.09, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, totalD]} />
        <meshStandardMaterial color="#c4b06a" roughness={0.95} />
      </mesh>
      <mesh position={[cx, 0.09, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[totalW, 1.5]} />
        <meshStandardMaterial color="#c4b06a" roughness={0.95} />
      </mesh>

      {/* Lake — simple squashed plane */}
      <mesh
        position={[cx - totalW * 0.12, 0.08, cz + totalD * 0.08]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[totalW * 0.22, totalD * 0.14, 1]}
      >
        <circleGeometry args={[1, 24]} />
        <meshStandardMaterial color="#1a4a6a" roughness={0.05} metalness={0.1} transparent opacity={0.88} />
      </mesh>

      {/* Trees */}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <mesh position={[0, t.h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.10, 0.18, t.h, 5]} />
            <meshStandardMaterial color="#4a2e10" roughness={0.95} />
          </mesh>
          <mesh position={[0, t.h + t.r * 0.55, 0]} castShadow>
            <sphereGeometry args={[t.r, 7, 6]} />
            <meshStandardMaterial
              color={`hsl(${112 + t.shade * 3}, ${48 + t.shade}%, ${18 + t.shade * 2}%)`}
              roughness={0.97}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Road grid — avenues + streets
function Roads() {
  const totalW = COLS * CELL + ROAD_WIDTH;
  const totalD = ROWS * CELL + ROAD_WIDTH;

  const avenues = Array.from({ length: COLS + 1 }, (_, col) => (col - COLS / 2) * CELL);
  const streets = Array.from({ length: ROWS + 1 }, (_, row) => (row - ROWS / 2) * CELL);

  return (
    <group>
      {/* Avenues (N-S) */}
      {avenues.map((x, i) => (
        <React.Fragment key={`av${i}`}>
          <mesh position={[x, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[ROAD_WIDTH, totalD]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
          </mesh>
          {/* Center line */}
          <mesh position={[x, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.07, totalD]} />
            <meshBasicMaterial color="#e8c010" />
          </mesh>
          {/* Sidewalks */}
          <mesh position={[x - ROAD_WIDTH / 2 - 0.5, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[1.0, totalD]} />
            <meshStandardMaterial color="#6a6258" roughness={0.98} />
          </mesh>
          <mesh position={[x + ROAD_WIDTH / 2 + 0.5, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[1.0, totalD]} />
            <meshStandardMaterial color="#6a6258" roughness={0.98} />
          </mesh>
        </React.Fragment>
      ))}

      {/* Streets (E-W) */}
      {streets.map((z, i) => (
        <React.Fragment key={`st${i}`}>
          <mesh position={[0, 0.015, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[totalW, ROAD_WIDTH]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
          </mesh>
          {/* Center line */}
          <mesh position={[0, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[totalW, 0.07]} />
            <meshBasicMaterial color="#e8c010" />
          </mesh>
        </React.Fragment>
      ))}
    </group>
  );
}

// Sparse street lights — just poles + glow, no point lights (for performance)
function StreetLights() {
  const lights = useMemo(() => {
    const arr = [];
    // Only at every-other intersection
    for (let col = 0; col <= COLS; col += 2) {
      for (let row = 0; row <= ROWS; row += 2) {
        arr.push({
          x: (col - COLS / 2) * CELL,
          z: (row - ROWS / 2) * CELL,
          id: col * 1000 + row,
        });
      }
    }
    return arr;
  }, []);

  return (
    <group>
      {lights.map((l) => (
        <group key={l.id} position={[l.x, 0, l.z]}>
          {/* Pole */}
          <mesh position={[0, 2.5, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 5, 5]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Arm */}
          <mesh position={[0.55, 4.85, 0]} rotation={[0, 0, -Math.PI / 7]}>
            <cylinderGeometry args={[0.025, 0.025, 1.3, 4]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Lamp head */}
          <mesh position={[1.05, 4.75, 0]}>
            <boxGeometry args={[0.28, 0.11, 0.17]} />
            <meshBasicMaterial color="#fff8c0" />
          </mesh>
        </group>
      ))}

      {/* Fewer point lights — 1 per 4x4 block of intersections */}
      {lights.filter((_, i) => i % 6 === 0).map((l) => (
        <pointLight
          key={`pl_${l.id}`}
          position={[l.x + 1.05, 4.5, l.z]}
          intensity={6}
          distance={18}
          color="#fff5a0"
          decay={2}
        />
      ))}
    </group>
  );
}

// Large flat ground
function Ground() {
  const totalW = COLS * CELL + 20;
  const totalD = ROWS * CELL + 20;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[totalW, totalD]} />
      <meshStandardMaterial color="#0f0f0f" roughness={0.98} />
    </mesh>
  );
}

// Atmosphere fog
function SceneFog() {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.FogExp2("#060c18", 0.007);
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
      <color attach="background" args={["#060c18"]} />
      <Stars radius={300} depth={60} count={3000} factor={4} fade />

      {/* Lighting */}
      <ambientLight intensity={0.18} color="#b0c8ff" />
      {/* Moon-style directional */}
      <directionalLight
        position={[80, 120, 60]}
        intensity={0.7}
        color="#ddeeff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={400}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />
      {/* Warm city-glow fill */}
      <pointLight position={[0, 2, 0]} intensity={1.5} color="#ff8020" distance={180} decay={1.2} />
      {/* Cool blue rim from the river side */}
      <directionalLight position={[-80, 20, -60]} intensity={0.15} color="#4488ff" />

      {/* Scene geometry */}
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
    <div className="city-view">
      {/* HUD */}
      <div className="city-hud">
        <button className="back-btn" onClick={onBack}>← BACK</button>
        <h2 className="hud-title">NEW YORK CITY</h2>
        <div className="hud-stats">
          <span>Grid: {COLS}×{ROWS}</span>
          <span>Buildings: {blocks.filter(b => b.height > 0).length}</span>
          <span>Scale: 1u ≈ 3m</span>
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

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [100, 90, 100], fov: 42 }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        gl={{ antialias: true }}
      >
        <CityScene blocks={blocks} />
      </Canvas>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   APP ROOT
   ══════════════════════════════════════════════════════════════════════ */

export default function App() {
  const [screen, setScreen] = useState("title");
  if (screen === "city") return <CityView onBack={() => setScreen("title")} />;
  return <TitleScreen onEnter={() => setScreen("city")} />;
}
