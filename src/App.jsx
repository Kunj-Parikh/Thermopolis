import { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useAuth } from "./contexts/AuthContext";
import { saveScore, clearAllScores } from "./firebase";
import LoginScreen from "./components/LoginScreen";
import Scoreboard from "./components/Scoreboard";
import WheelSpinner from "./components/WheelSpinner";
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
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="enter-btn" onClick={() => onEnter("CITY")}>ENTER CITY</button>
          <button className="enter-btn" onClick={() => onEnter("SANDBOX")}>EMPTY SANDBOX</button>
          <button className="enter-btn" style={{ background: '#c06020' }} onClick={() => onEnter("HEAT_HUNT")}>HEAT HUNT</button>
        </div>
      </div>
      {/* Invisible secret admin button to clear leaderboard */}
      <button 
        style={{
          position: 'absolute', bottom: 0, left: 0, 
          width: '50px', height: '50px', 
          background: 'transparent', border: 'none', 
          cursor: 'default', zIndex: 100 
        }}
        onClick={async () => {
          if (window.confirm("SECRET ADMIN ACTION: Delete all leaderboard entries?")) {
            try {
              await clearAllScores();
              alert("All leaderboard entries have been deleted.");
            } catch (err) {
              alert("Error clearing leaderboard: " + err.message);
            }
          }
        }}
        title=""
      />
    </div>
  );
}

const MATERIALS = {
  Asphalt: { albedo: 0.05, cooling: 0, cost: 1000, color: "#222222" },
  Concrete: { albedo: 0.30, cooling: 2, cost: 5000, color: "#888888" },
  "White Roof": { albedo: 0.70, cooling: 5, cost: 20000, color: "#ffffff" },
  Grass: { albedo: 0.25, cooling: 8, cost: 15000, color: "#3a9e40" },
  Water: { albedo: 0.10, cooling: 8, cost: 25000, color: "#2a7aaa" },
  "Tree Canopy": { albedo: 0.20, cooling: 12, cost: 30000, color: "#2d6b31" },
  "Solar Panels": { albedo: 0.15, cooling: 4, cost: 40000, color: "#1a2c4d", income: 500 },
  "Brick": { albedo: 0.20, cooling: -2, cost: 3000, color: "#b24c3b" },
  "Permeable Pavement": { albedo: 0.25, cooling: 6, cost: 10000, color: "#9ca5b5" },
  "Sand": { albedo: 0.40, cooling: 2, cost: 5000, color: "#e3c68a" },
  "Green Wall": { albedo: 0.35, cooling: 20, cost: 75000, color: "#1b4d24" },
  "Cool Coating": { albedo: 0.95, cooling: 10, cost: 35000, color: "#f0f8ff" },
};

const BUILDINGS = {
  Bulldoze: { cost: 5000, type: "clear", heightBonus: 0 },
  "Small Building": { cost: 50000, type: "residential", heightBonus: 1 },
  "Large Building": { cost: 150000, type: "downtown", heightBonus: 2 },
  "Skyscraper": { cost: 500000, type: "financial", heightBonus: 4 },
};

const TEXTURE_CACHE = {};

function createTexture(type) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  // Base color
  const color = MATERIALS[type]?.color || '#ffffff';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  
  if (type === 'Solar Panels') {
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.5)';
    ctx.lineWidth = 3;
    for(let x=0; x<=256; x+=32) {
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,256); ctx.stroke();
    }
    for(let y=0; y<=256; y+=64) {
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(256,y); ctx.stroke();
    }
    // Glare
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath(); ctx.moveTo(0,256); ctx.lineTo(256,0); ctx.lineTo(256,64); ctx.lineTo(64,256); ctx.fill();
  } else if (type === 'Brick') {
    ctx.fillStyle = '#cccccc'; // mortar
    for(let y=0; y<256; y+=32) {
      ctx.fillRect(0, y, 256, 4); // horizontal
      const offset = (y/32)%2 === 0 ? 0 : 32;
      for(let x=0; x<256; x+=64) {
        ctx.fillRect(x + offset, y, 4, 32); // vertical
      }
    }
  } else if (type === 'Grass' || type === 'Tree Canopy') {
    for(let i=0; i<800; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.15})`;
      ctx.beginPath();
      ctx.arc(Math.random()*256, Math.random()*256, type === 'Grass' ? 2 : 5, 0, Math.PI*2);
      ctx.fill();
    }
  } else if (type === 'Permeable Pavement') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    for(let y=8; y<256; y+=16) {
      for(let x=8; x<256; x+=16) {
        ctx.beginPath(); ctx.arc(x,y, 4, 0, Math.PI*2); ctx.fill();
      }
    }
  } else if (type === 'Cool Coating') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(0, 0, 256, 256);
  } else if (type === 'Green Wall') {
    for(let i=0; i<400; i++) {
      ctx.fillStyle = `rgba(27,77,36,${Math.random()*0.4+0.6})`;
      ctx.fillRect(Math.random()*256, Math.random()*256, 16, 8);
    }
  } else {
    // Asphalt, Concrete, Sand (noise)
    for(let i=0; i<3000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.1})`;
      ctx.fillRect(Math.random()*256, Math.random()*256, 2, 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function getMaterialTexture(type) {
  if (!type || type === "Water" || type === "Bulldoze") return null;
  if (!TEXTURE_CACHE[type]) {
    TEXTURE_CACHE[type] = createTexture(type);
  }
  return TEXTURE_CACHE[type];
}

const BASE_TEMP = 25; // °C
const SOLAR_CONSTANT = 18; // Max temp addition from sun

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

function generateInitialGrid(mapMode, randomSeed) {
  const baseSeed = randomSeed || 42;
  const globalRng = seededRng(baseSeed);
  
  // Procedural Voronoi seeds for HEAT_HUNT patches
  const matSeeds = [];
  const bldgSeeds = [];
  if (mapMode === "HEAT_HUNT") {
    const matKeys = Object.keys(MATERIALS);
    for (let i = 0; i < 12; i++) { // Fewer seeds = much larger patches
      matSeeds.push({
        c: globalRng() * GRID_COLS,
        r: globalRng() * GRID_ROWS,
        mat: matKeys[Math.floor(globalRng() * matKeys.length)]
      });
    }
    for (let i = 0; i < 40; i++) {
      bldgSeeds.push({
        c: globalRng() * GRID_COLS,
        r: globalRng() * GRID_ROWS,
        isBldg: globalRng() > 0.6, // 40% chance for a patch to be buildings
      });
    }
  }

  const grid = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const rng = seededRng(col * 1337 + row * 7919 + baseSeed);
      const zone = getZone(col, row);
      const cx = (col - GRID_COLS / 2 + 0.5) * CELL;
      const cz = (row - GRID_ROWS / 2 + 0.5) * CELL;
      const rotY = Math.floor(rng() * 4) * (Math.PI / 2);
      const scaleVar = 0.85 + rng() * 0.35;
      
      let initialMaterial = "Asphalt";
      let isBuilding = false;
      let modelPath = null;
      let heightBonus = 0;
      const isRural = row === 0 || row === GRID_ROWS - 1 || col === 0 || col === GRID_COLS - 1;

      if (isRural) {
        zone = "rural";
        initialMaterial = "Grass";
      } else if (mapMode === "HEAT_HUNT") {
        // Nearest material patch
        let bestMatDist = Infinity;
        for (const s of matSeeds) {
          const dist = Math.hypot(s.c - col, s.r - row) + (rng() * 1.2); // Reduced noise for cleaner edges
          if (dist < bestMatDist) {
            bestMatDist = dist;
            initialMaterial = s.mat;
          }
        }
        
        // Nearest building patch
        let bestBldgDist = Infinity;
        for (const s of bldgSeeds) {
          const dist = Math.hypot(s.c - col, s.r - row) + (rng() * 1.5); // Slightly more noise for buildings
          if (dist < bestBldgDist) {
            bestBldgDist = dist;
            isBuilding = s.isBldg;
          }
        }

        if (isBuilding) {
          initialMaterial = "Asphalt";
        }

        modelPath = isBuilding ? pickModel("mixed", rng) : null;
        if (modelPath?.includes("skyscraper")) heightBonus = 4;
        else if (modelPath?.includes("building-")) heightBonus = 2;
        else if (isBuilding) heightBonus = 1;
      } else if (mapMode !== "SANDBOX") {
        if (zone === "park") initialMaterial = "Grass";
        isBuilding = zone !== "park";
        modelPath = isBuilding ? pickModel(zone, rng) : null;
        
        if (modelPath?.includes("skyscraper")) heightBonus = 4;
        else if (modelPath?.includes("building-")) heightBonus = 2;
        else if (isBuilding) heightBonus = 1;
      }

      grid.push({
        col, row, zone, cx, cz, rotY, scaleVar, modelPath, isBuilding,
        material: initialMaterial,
        baseTemp: BASE_TEMP,
        heightBonus,
        currentTemp: BASE_TEMP,
        isRural,
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

function KeyboardPanControls() {
  const { camera } = useThree();
  const keys = useRef({ w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (keys.current.hasOwnProperty(e.key)) keys.current[e.key] = true;
    };
    const handleKeyUp = (e) => {
      if (keys.current.hasOwnProperty(e.key)) keys.current[e.key] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((state, delta) => {
    let moveX = 0;
    let moveZ = 0;
    const k = keys.current;
    
    // moveZ is the multiplier for the forward vector
    if (k.w || k.ArrowUp) moveZ += 1;
    if (k.s || k.ArrowDown) moveZ -= 1;
    if (k.a || k.ArrowLeft) moveX -= 1;
    if (k.d || k.ArrowRight) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= length;
      moveZ /= length;
      
      const speed = 60 * delta; // 60 units per second
      
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      forward.y = 0;
      forward.normalize();
      
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      right.y = 0;
      right.normalize();

      const dx = (right.x * moveX + forward.x * moveZ) * speed;
      const dz = (right.z * moveX + forward.z * moveZ) * speed;

      camera.position.x += dx;
      camera.position.z += dz;

      if (state.controls && state.controls.target) {
        state.controls.target.x += dx;
        state.controls.target.z += dz;
      }
    }
  });

  return null;
}

/* ══════════════════════════════════════════════════════════════════════
   3D COMPONENTS
   ══════════════════════════════════════════════════════════════════════ */

function AnimatedWater({ cx, cz }) {
  const materialRef = useRef();
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    baseColor: { value: new THREE.Color("#2a7aaa") }
  }), []);
  
  useFrame((state) => {
    if (materialRef.current) materialRef.current.uniforms.time.value = state.clock.elapsedTime;
  });
  
  return (
    <mesh position={[cx, 0.1, cz]}>
      <boxGeometry args={[CELL, 0.2, CELL, 32, 1, 32]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          varying float vWave;
          uniform float time;
          void main() {
            vUv = uv;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            
            // Complex overlapping waves for a highly randomized, natural interference pattern
            float wave1 = sin(worldPos.x * 0.83 + time * 1.2) * cos(worldPos.z * 1.17 + time * 0.9) * 0.12;
            float wave2 = sin(worldPos.x * -1.41 + time * 0.8) * cos(worldPos.z * 1.73 - time * 0.6) * 0.08;
            float wave3 = sin(worldPos.x * 2.37 - time * 1.5) * sin(worldPos.z * -0.91 + time * 1.1) * 0.06;
            
            // Large, slow sweeping wave to break up small repeating tile patterns across the map
            float wave4 = sin(worldPos.x * 0.31 + worldPos.z * 0.47 + time * 0.4) * 0.07;
            
            float totalWave = wave1 + wave2 + wave3 + wave4;

            vec3 pos = position;
            pos.y += totalWave;
            vWave = totalWave;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          varying float vWave;
          uniform vec3 baseColor;
          void main() {
            // Normalize wave height roughly to 0.0 - 1.0
            float intensity = clamp((vWave + 0.3) / 0.6, 0.0, 1.0);
            
            // Sharper color transitions to avoid blurriness
            vec3 deepColor = vec3(0.0, 0.2, 0.5);   // Rich, darker navy
            vec3 shallowColor = vec3(0.0, 0.5, 0.7); // Softer ocean blue
            vec3 waterColor = mix(deepColor, shallowColor, smoothstep(0.4, 0.65, intensity));
            
            // Crisp foam highlights at the very peaks, toned down
            float foam = smoothstep(0.75, 0.9, intensity);
            waterColor += vec3(foam * 0.4);
            
            gl_FragColor = vec4(waterColor, 0.9);
          }
        `}
        transparent
      />
    </mesh>
  );
}

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
      <primitive object={clonedScene} />
      {showOverlay && (
        <mesh position={[center.x, roofY + overlayThickness / 2 + 0.01, center.z]}>
          <boxGeometry args={[size.x * 0.9, overlayThickness, size.z * 0.9]} />
          <meshStandardMaterial color={overlayColor} map={getMaterialTexture(appliedMaterial)} roughness={0.8} />
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
    for (let i = 0; i < grid.length * 3; i++) arr[i] = 1;
    return arr;
  }, [grid.length]);
  
  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();

    // Dynamic range: use actual min/max from grid for maximum sensitivity
    let minT = Infinity, maxT = -Infinity;
    for (const c of grid) {
      if (c.currentTemp < minT) minT = c.currentTemp;
      if (c.currentTemp > maxT) maxT = c.currentTemp;
    }
    // Ensure at least 1°C spread so we don't divide by zero
    const spread = Math.max(maxT - minT, 1);
    
    grid.forEach((c, i) => {
      dummy.position.set(c.cx, 0.15, c.cz);
      dummy.scale.set(CELL, 1, CELL);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      
      // Normalize 0-1 across the actual temperature spread
      const t = Math.max(0, Math.min(1, (c.currentTemp - minT) / spread));
      // Blue (cold) → Green → Yellow → Red (hot), full saturation
      tempColor.setHSL((1 - t) * 0.65, 1, 0.45 + t * 0.1);
      meshRef.current.setColorAt(i, tempColor);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [grid]);

  return (
    <instancedMesh ref={meshRef} args={[null, null, grid.length]}>
      <boxGeometry args={[1, 0.15, 1]} />
      <meshBasicMaterial transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      <instancedBufferAttribute attach="instanceColor" args={[colorArray, 3]} />
    </instancedMesh>
  );
}

// Ground plane
function Ground() {
  const totalW = GRID_COLS * CELL + 60;
  const totalD = GRID_ROWS * CELL + 60;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
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

function ColdestBeam({ cell }) {
  const meshRef = useRef();
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.material.opacity = 0.4 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
    }
  });
  return (
    <mesh ref={meshRef} position={[cell.cx, 25, cell.cz]}>
      <cylinderGeometry args={[0.8, 0.8, 50, 16]} />
      <meshBasicMaterial color="#40a0ff" transparent opacity={0.5} depthWrite={false} />
    </mesh>
  );
}

function CityScene({ grid, onGridClick, showHeatMap, huntLowest, huntState }) {
  return (
    <>
      <fogExp2 attach="fog" args={["#c8ddf0", 0.004]} />
      <color attach="background" args={["#87ceeb"]} />
      <Sky distance={4500} sunPosition={[100, 40, -80]} inclination={0.52} azimuth={0.22} turbidity={6} rayleigh={0.8} />
      <ambientLight intensity={0.75} color="#fff4e0" />
      <directionalLight position={[100, 140, -80]} intensity={3.2} />
      
      <Ground />
      
      {/* Interaction Plane */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.2, 0]} onPointerDown={onGridClick}>
        <planeGeometry args={[GRID_COLS * CELL, GRID_ROWS * CELL]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {showHeatMap && <HeatMap grid={grid} />}

      <Suspense fallback={<LoadingFallback />}>
        <group>
          {grid.map(c => {
            if (!c.isBuilding) {
              if (c.material === "Water") {
                return <AnimatedWater key={c.key} cx={c.cx} cz={c.cz} />;
              }
              
              const leftCell = c.col > 0 ? grid[c.row * GRID_COLS + c.col - 1] : null;
              const rightCell = c.col < GRID_COLS - 1 ? grid[c.row * GRID_COLS + c.col + 1] : null;
              const topCell = c.row > 0 ? grid[(c.row - 1) * GRID_COLS + c.col] : null;
              const bottomCell = c.row < GRID_ROWS - 1 ? grid[(c.row + 1) * GRID_COLS + c.col] : null;

              const sameLeft = leftCell && !leftCell.isBuilding && leftCell.material === c.material;
              const sameRight = rightCell && !rightCell.isBuilding && rightCell.material === c.material;
              const sameTop = topCell && !topCell.isBuilding && topCell.material === c.material;
              const sameBottom = bottomCell && !bottomCell.isBuilding && bottomCell.material === c.material;

              let width = CELL - 0.5;
              let depth = CELL - 0.5;
              let dx = 0;
              let dz = 0;

              if (sameLeft) { width += 0.25; dx -= 0.125; }
              if (sameRight) { width += 0.25; dx += 0.125; }
              if (sameTop) { depth += 0.25; dz -= 0.125; }
              if (sameBottom) { depth += 0.25; dz += 0.125; }

              const matColor = MATERIALS[c.material].color;
              const tex = getMaterialTexture(c.material);
              return (
                <mesh key={c.key} position={[c.cx + dx, 0.1, c.cz + dz]}>
                  <boxGeometry args={[width, 0.2, depth]} />
                  <meshStandardMaterial color={matColor} map={tex} roughness={0.9} />
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

      {huntState === "game_over" && huntLowest && <ColdestBeam cell={huntLowest} />}

      <KeyboardPanControls />
      <OrbitControls 
        makeDefault
        enableDamping 
        dampingFactor={0.07} 
        minDistance={8} 
        maxDistance={320} 
        maxPolarAngle={Math.PI / 2.05} 
        target={[0, 5, 0]} 
      />
    </>
  );
}

function CityView({ onBack, mapMode }) {
  const [huntSeed, setHuntSeed] = useState(() => Math.floor(Math.random() * 1000000));
  const [grid, setGrid] = useState(() => generateInitialGrid(mapMode, mapMode === "HEAT_HUNT" ? huntSeed : undefined));
  const [budget, setBudget] = useState(2000000); // $2M starting budget
  const [mode, setMode] = useState(mapMode === "HEAT_HUNT" ? "HEAT_HUNT" : "BUDGET"); // "BUDGET" or "HEAT_HUNT"
  const [activeTab, setActiveTab] = useState("MATERIALS"); // "MATERIALS" or "BUILDINGS"
  const [selectedMaterial, setSelectedMaterial] = useState("White Roof");
  const [selectedBuilding, setSelectedBuilding] = useState("Small Building");
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  
  // Heat Hunt State
  const [huntState, setHuntState] = useState("playing");
  const [huntScore, setHuntScore] = useState(0);
  const [huntGuess, setHuntGuess] = useState(null);
  const [pendingGuess, setPendingGuess] = useState(null);
  const [huntLowest, setHuntLowest] = useState(null);

  // Heat Simulation Loop (runs every 1 second)
  useInterval(() => {
    let currentGrid = grid.map(c => ({...c}));
    let totalIncome = 0;
    
    // 1. Calculate local target equilibrium for each cell
    for (let i = 0; i < currentGrid.length; i++) {
      const c = currentGrid[i];
      const mat = MATERIALS[c.material];
      const targetTemp = c.baseTemp + (1 - mat.albedo) * SOLAR_CONSTANT - mat.cooling + c.heightBonus;
      // Move current slowly towards target
      c.currentTemp += (targetTemp - c.currentTemp) * 0.15;
      
      if (mat.income && mode === "BUDGET") {
        totalIncome += mat.income;
      }
    }

    if (totalIncome > 0) {
      setBudget(prev => prev + totalIncome);
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
      
      if (cell.isRural) return;

      if (mode === "BUDGET") {
        if (activeTab === "MATERIALS") {
          const matData = MATERIALS[selectedMaterial];
          // Skip if same material already on this tile, or can't afford it
          if (cell.material === selectedMaterial || budget < matData.cost) return;
          setBudget(prev => prev - matData.cost);
          const newGrid = [...grid];
          newGrid[cellIndex] = {
            ...cell,
            material: selectedMaterial,
            currentTemp: cell.baseTemp, // reset heat before applying new material
          };
          setGrid(newGrid);
        } else if (activeTab === "BUILDINGS") {
          const bldgData = BUILDINGS[selectedBuilding];
          if (!bldgData || budget < bldgData.cost) return;

          if (selectedBuilding === "Bulldoze") {
            if (!cell.isBuilding) return; // Nothing to bulldoze
            setBudget(prev => prev - bldgData.cost);
            const newGrid = [...grid];
            newGrid[cellIndex] = {
              ...cell,
              isBuilding: false,
              modelPath: null,
              material: "Asphalt",
              heightBonus: 0,
              currentTemp: cell.baseTemp,
            };
            setGrid(newGrid);
          } else {
            // Can't build on a building or water (unless we allow overwriting, but bulldozing first is safer)
            if (cell.isBuilding || cell.material === "Water") return;

            setBudget(prev => prev - bldgData.cost);
            const rng = seededRng(hitCol * 1337 + hitRow * 7919 + 42 + Math.random() * 1000); 
            const modelPath = pickModel(bldgData.type, rng);
            
            const newGrid = [...grid];
            newGrid[cellIndex] = {
              ...cell,
              isBuilding: true,
              modelPath: modelPath,
              heightBonus: bldgData.heightBonus,
              material: "Asphalt", // default roof
              currentTemp: cell.baseTemp,
            };
            setGrid(newGrid);
          }
        }
      } else if (mode === "HEAT_HUNT") {
        if (huntState !== "playing") return;
        setPendingGuess(cell);
      }
    }
  };

  const confirmGuess = () => {
    if (!pendingGuess) return;
    const cell = pendingGuess;
    setPendingGuess(null);

    let lowest = grid[0];
    for (let i = 1; i < grid.length; i++) {
      if (grid[i].currentTemp < lowest.currentTemp) lowest = grid[i];
    }

    const guessedTemp = cell.currentTemp;
    const lowestTemp = lowest.currentTemp;
    const scoreDiff = Math.abs(guessedTemp - lowestTemp);
    const finalScore = Math.max(0, Math.round(1000 - scoreDiff * 100));

    setHuntGuess(cell);
    setHuntLowest(lowest);
    setHuntScore(finalScore);
    setHuntState("game_over");

    if (user) {
      saveScore({ mode: "heat-hunt", score: finalScore, avgTemp: scoreDiff, extras: { guessedTemp, lowestTemp } }).catch(console.error);
    }
  };

  // Stats computation
  const ruralCells = grid.filter(c => c.isRural);
  const innerCells = grid.filter(c => !c.isRural);
  
  const avgRuralTemp = ruralCells.reduce((acc, c) => acc + c.currentTemp, 0) / (ruralCells.length || 1);
  const avgInnerTemp = innerCells.reduce((acc, c) => acc + c.currentTemp, 0) / (innerCells.length || 1);
  const uhii = avgInnerTemp - avgRuralTemp;
  
  let uhiiRating = { text: "Excellent 🟢", color: "#00ffc8" };
  if (uhii > 5.0) uhiiRating = { text: "Extreme 🚨", color: "#ff0000" };
  else if (uhii > 3.5) uhiiRating = { text: "Severe 🔴", color: "#ff4060" };
  else if (uhii > 2.0) uhiiRating = { text: "Concerning 🟠", color: "#ffaa20" };
  else if (uhii > 1.0) uhiiRating = { text: "Good 🟡", color: "#ffeb3b" };

  const materialCounts = grid.reduce((acc, c) => {
    if (c.isRural) return acc; // Only count inner city materials
    acc[c.material] = (acc[c.material] || 0) + 1;
    return acc;
  }, {});
  const { user, logOut: handleLogOut } = useAuth();
  const [showBoard, setShowBoard] = useState(false);

  return (
    <div className="city-layout">
      {/* ─── CENTER 3D CANVAS (BACKGROUND) ─── */}
      <div className="center-canvas">
        <Canvas camera={{ position: [70, 55, 70], fov: 45 }} gl={{ antialias: true, powerPreference: "high-performance" }}>
          <CityScene grid={grid} onGridClick={handleGridClick} showHeatMap={showHeatMap} huntLowest={huntLowest} huntState={huntState} />
        </Canvas>
      </div>

      {/* ─── TOP LEFT CONTROLS ─── */}
      <div className="hud-panel hud-top-left">
        <button className="back-btn" onClick={onBack}>← TITLE SCREEN</button>
        <h2 className="panel-title">CONTROLS</h2>
        
        {mapMode !== "HEAT_HUNT" && (
          <div className="mode-toggle">
            <button className={mode === "BUDGET" ? "active" : ""} onClick={() => setMode("BUDGET")}>Budget Mode</button>
            <button className={mode === "HEAT_HUNT" ? "active" : ""} onClick={() => setMode("HEAT_HUNT")}>Heat Hunt</button>
          </div>
        )}

        {mode === "BUDGET" && (
          <div className="budget-display">
            <h4>REMAINING BUDGET</h4>
            <div className="budget-val">${budget.toLocaleString()}</div>
            <button 
              className="spin-btn-small" 
              onClick={() => setShowSpinner(true)}
              style={{
                marginTop: '10px', width: '100%', padding: '8px', 
                background: '#d97030',
                color: '#fff', border: 'none', borderRadius: '8px',
                fontWeight: 'bold', cursor: 'pointer',
                letterSpacing: '0.5px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            >
              SPIN FOR FUNDS
            </button>
          </div>
        )}

        {mode === "HEAT_HUNT" && (
          <div className="mode-content heat-hunt-mode">
            <h3>HEAT HUNT</h3>
            {huntState === "playing" ? (
              <p style={{color: '#9a8e80', lineHeight: 1.5}}>
                The city is a chaotic thermal mess! You have ONE guess. <strong style={{color: '#e8e0d4'}}>Click the tile that you think has the LOWEST temperature.</strong>
              </p>
            ) : (
              <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px' }}>
                <h2 style={{color: '#f0c870', fontSize: '32px', margin: '0 0 10px 0'}}>{huntScore} <span style={{fontSize:'16px'}}>PTS</span></h2>
                <p style={{margin: '5px 0', color: '#9a8e80'}}>
                  Guessed Temp: <strong style={{color: '#e8e0d4'}}>{huntGuess?.currentTemp.toFixed(1)}°C</strong>
                </p>
                <p style={{margin: '5px 0', color: '#9a8e80'}}>
                  Lowest Temp: <strong style={{color: '#60a0d0'}}>{huntLowest?.currentTemp.toFixed(1)}°C</strong>
                </p>
                <p style={{margin: '5px 0', color: '#dc5040'}}>
                  Difference: {Math.abs(huntGuess?.currentTemp - huntLowest?.currentTemp).toFixed(1)}°C
                </p>
                
                <button 
                  className="hud-btn" 
                  style={{marginTop: '20px', width: '100%'}}
                  onClick={() => {
                    const newSeed = Math.floor(Math.random() * 1000000);
                    setHuntSeed(newSeed);
                    setHuntState("playing");
                    setHuntGuess(null);
                    setHuntLowest(null);
                    setGrid(generateInitialGrid("HEAT_HUNT", newSeed));
                  }}
                >
                  PLAY AGAIN
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── TOP RIGHT STATS ─── */}
      <div className="hud-panel hud-top-right">
        <h2 className="panel-title">LIVE STATS</h2>
        
        <div className="stat-box">
          <h4>Heat Island Intensity</h4>
          <div className="value" style={{ color: uhiiRating.color }}>
            +{Math.max(0, uhii).toFixed(1)}°C
          </div>
          <div style={{ fontSize: '13px', color: uhiiRating.color, marginTop: '4px', fontWeight: 'bold' }}>
            {uhiiRating.text}
          </div>
        </div>

        <div className="stat-box">
          <h4>Material Breakdown</h4>
          <div className="material-breakdown">
            {Object.entries(materialCounts).map(([mat, count]) => (
              <div key={mat} className="mat-count-row">
                <span className="dot" style={{ background: MATERIALS[mat] ? MATERIALS[mat].color : "#fff" }}></span>
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

        <button
          className={`heatmap-toggle-btn ${showHeatMap ? "active" : ""}`}
          onClick={() => setShowHeatMap(!showHeatMap)}
        >
          {showHeatMap ? "HIDE HEAT MAP" : "SHOW HEAT MAP"}
        </button>
        <button className="hud-btn" onClick={() => setShowBoard(true)}>LEADERBOARD</button>
        {user && (
          <div className="hud-user">
            <span className="hud-user-name">{user.displayName || user.email}</span>
            <button className="hud-btn hud-btn-out" onClick={handleLogOut}>SIGN OUT</button>
          </div>
        )}
      </div>

      {/* ─── BOTTOM BUILD MENU ─── */}
      {mode === "BUDGET" && (
        <div className="hud-panel hud-bottom">
          <div className="mode-toggle vertical" style={{ marginRight: '16px', minWidth: '100px' }}>
            <button className={activeTab === "MATERIALS" ? "active" : ""} onClick={() => setActiveTab("MATERIALS")}>Materials</button>
            <button className={activeTab === "BUILDINGS" ? "active" : ""} onClick={() => setActiveTab("BUILDINGS")}>Buildings</button>
          </div>

          {activeTab === "MATERIALS" ? (
            <div className="materials-list-horizontal">
              {Object.entries(MATERIALS).map(([name, data]) => (
                <div 
                  key={name} 
                  className={`material-card-compact ${selectedMaterial === name ? "active" : ""}`}
                  onClick={() => setSelectedMaterial(name)}
                >
                  <span className="mat-name">{name}</span>
                  <span className="mat-cost">${data.cost / 1000}k</span>
                  <div className="mat-stats">
                    <span>Albedo: {data.albedo}</span>
                    <span>Cooling: {data.cooling}°</span>
                    {data.income && <span style={{color: '#60b060'}}>Income: +${data.income}/s</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="materials-list-horizontal">
              {Object.entries(BUILDINGS).map(([name, data]) => (
                <div 
                  key={name} 
                  className={`material-card-compact ${selectedBuilding === name ? "active" : ""}`}
                  onClick={() => setSelectedBuilding(name)}
                >
                  <span className="mat-name">{name}</span>
                  <span className="mat-cost">${data.cost / 1000}k</span>
                  {name !== "Bulldoze" && (
                    <div className="mat-stats">
                      <span>Height: +{data.heightBonus}</span>
                      <span>{data.type}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scoreboard overlay */}
      <Scoreboard visible={showBoard} onClose={() => setShowBoard(false)} />
      
      {/* Funding Wheel overlay */}
      <WheelSpinner 
        visible={showSpinner} 
        onClose={() => setShowSpinner(false)} 
        onWin={(amount) => setBudget(b => b + amount)} 
      />

      {/* Heat Hunt Confirmation Popup */}
      {pendingGuess && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          pointerEvents: 'auto'
        }} onClick={() => setPendingGuess(null)}>
          <div style={{
            background: 'rgba(28, 28, 28, 0.97)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '14px', padding: '32px 40px',
            textAlign: 'center', maxWidth: '360px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{margin: '0 0 12px 0', color: '#e0ddd8', fontSize: '18px'}}>Lock in your guess?</h3>
            <p style={{color: '#999', fontSize: '14px', margin: '0 0 8px 0'}}>
              Tile at ({pendingGuess.col}, {pendingGuess.row}) — {pendingGuess.material}
            </p>
            <p style={{color: '#777', fontSize: '12px', margin: '0 0 24px 0'}}>
              You only get one guess. This cannot be undone.
            </p>
            <div style={{display: 'flex', gap: '12px', justifyContent: 'center'}}>
              <button 
                onClick={() => setPendingGuess(null)}
                style={{
                  padding: '10px 24px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.06)', color: '#aaa',
                  border: '1px solid rgba(255,255,255,0.1)', fontWeight: '600',
                  cursor: 'pointer', transition: '0.15s'
                }}
              >Cancel</button>
              <button 
                onClick={confirmGuess}
                style={{
                  padding: '10px 24px', borderRadius: '8px',
                  background: '#d97030', color: '#fff',
                  border: 'none', fontWeight: '700',
                  cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  transition: '0.15s'
                }}
              >Confirm</button>
            </div>
          </div>
        </div>
      )}
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

  if (screen === "CITY" || screen === "SANDBOX" || screen === "HEAT_HUNT") return <CityView mapMode={screen} onBack={() => setScreen("title")} />;
  return <TitleScreen onEnter={(mode) => setScreen(mode)} />;
}

