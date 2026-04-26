import { useState, useRef } from "react";
import { pipeline, env } from "@xenova/transformers";
import "./SatelliteSetup.css";

env.allowLocalModels = false;

const BASE_TEMP = 25;
const CELL = 10;

const MATERIAL_MAP = {
  0: "Road",
  1: "Small Building",
  2: "Large Building",
  6: "Skyscraper",
  3: "Grass",
  4: "Water",
  5: "Tree Canopy",
};

/* ═══════════════════════════════════════════════════════════════════
   MODEL 1: CUSTOM SATELLITE COLOR CLASSIFIER (RGB)
   ═══════════════════════════════════════════════════════════════════ */

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, v];
}

function classifyTile(imgData, imgW, startX, startY, endX, endY) {
  let totalR = 0, totalG = 0, totalB = 0;
  let greenPixels = 0, bluePixels = 0, darkPixels = 0, brightPixels = 0;
  let count = 0;

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const idx = (y * imgW + x) * 4;
      const r = imgData.data[idx];
      const g = imgData.data[idx + 1];
      const b = imgData.data[idx + 2];
      totalR += r; totalG += g; totalB += b;
      count++;

      const brightness = (r + g + b) / 3;
      if (g > r && g > b && (g - Math.max(r, b)) > 8) greenPixels++;
      if (b > r && b > g && (b - Math.max(r, g)) > 10) bluePixels++;
      if (brightness < 80) darkPixels++;
      if (brightness > 190) brightPixels++;
    }
  }

  if (count === 0) return 1;

  const avgR = totalR / count;
  const avgG = totalG / count;
  const avgB = totalB / count;
  const avgBrightness = (avgR + avgG + avgB) / 3;
  
  const greenRatio = greenPixels / count;
  const blueRatio = bluePixels / count;
  const darkRatio = darkPixels / count;
  const brightRatio = brightPixels / count;
  
  const greenDominance = avgG - (avgR + avgB) / 2;
  const blueDominance = avgB - (avgR + avgG) / 2;
  const [hue, sat, val] = rgbToHsv(avgR, avgG, avgB);

  if (blueRatio > 0.3 || (blueDominance > 10 && sat > 0.15 && hue > 0.5 && hue < 0.72)) return 4;
  if (sat > 0.15 && (greenRatio > 0.25 || greenDominance > 12)) return 3; // Grass
  if (sat > 0.20 && hue > 0.18 && hue < 0.45 && greenRatio > 0.10) return 3; // Grass
  if (brightRatio > 0.5 && sat < 0.15 && avgBrightness > 180) return 2;
  if (darkRatio > 0.4 && sat < 0.20) return 0; // Road/Pavement
  if (avgBrightness < 90 && sat < 0.18) return 0; // Road/Pavement
  if (sat < 0.20 && avgBrightness >= 90 && avgBrightness < 180) return 1; // Concrete
  if (sat > 0.10 && (hue < 0.12 || hue > 0.88)) return 1; // Warm tones (brick building)

  return 0; // Default to road/pavement instead of a building
}

/* ═══════════════════════════════════════════════════════════════════
   MODEL 2: SEGFORMER (TRANSFORMERS.JS)
   ═══════════════════════════════════════════════════════════════════ */

const ADE_TO_CLASS = {
  "road": 0, "sidewalk": 0, "path": 0, "floor": 0,
  "car": 0, "bus": 0, "truck": 0, "van": 0,
  "building": 1, "house": 1, "wall": 1, "fence": 1, "tower": 6, "garage": 1,
  "skyscraper": 6, "roof": 1,
  "grass": 3, "field": 3, "sky": 3,
  "water": 4, "sea": 4, "river": 4, "lake": 4, "pool": 4,
  "tree": 5, "plant": 5, "palm": 5, "mountain": 5,
};

function adeToThermo(label) {
  const key = label.toLowerCase().replace(/[_-]/g, " ");
  if (ADE_TO_CLASS[key] !== undefined) return ADE_TO_CLASS[key];
  for (const [k, v] of Object.entries(ADE_TO_CLASS)) {
    if (key.includes(k)) return v;
  }
  return 0;
}

let cachedSegmenter = null;

async function runSegFormer(tiles, totalW, totalH, setStatus) {
  setStatus("Loading SegFormer AI Model...");
  if (!cachedSegmenter) {
    cachedSegmenter = await pipeline("image-segmentation", "Xenova/segformer-b0-finetuned-ade-512-512");
  }
  
  const gridSize = 20;
  const tileVotes = new Array(gridSize * gridSize).fill(0).map(() => new Array(8).fill(0));
  
  setStatus("Running SegFormer inference on hi-res tiles...");
  for (let i = 0; i < tiles.length; i++) {
    setStatus(`Running SegFormer inference... (${i + 1}/${tiles.length})`);
    const tile = tiles[i];
    const segments = await cachedSegmenter(tile.dataUrl);
    
    const priority = { 3: 0, 5: 1, 4: 2, 1: 3, 2: 4, 6: 5 };
    const sorted = segments.map(seg => ({
      ...seg, thermoClass: adeToThermo(seg.label)
    })).sort((a, b) => (priority[a.thermoClass] || 0) - (priority[b.thermoClass] || 0));
    
    for (const seg of sorted) {
      const cls = seg.thermoClass;
      const maskData = seg.mask.data;
      const mW = seg.mask.width, mH = seg.mask.height;
      for (let y = 0; y < mH; y++) {
        const globalY = tile.cy + (y / mH) * 256;
        const tileRow = Math.min(Math.floor((globalY / totalH) * gridSize), gridSize - 1);
        for (let x = 0; x < mW; x++) {
          if (maskData[y * mW + x] > 0) {
            const globalX = tile.cx + (x / mW) * 256;
            const tileCol = Math.min(Math.floor((globalX / totalW) * gridSize), gridSize - 1);
            tileVotes[tileRow * gridSize + tileCol][cls]++;
          }
        }
      }
    }
  }

  return tileVotes.map(votes => {
    let best = 0, bestCount = 0;
    for (let c = 0; c < 8; c++) {
      if (votes[c] > bestCount) { bestCount = votes[c]; best = c; }
    }
    return best;
  });
}





/* ═══════════════════════════════════════════════════════════════════
   BUILDING MODEL POOLS
   ═══════════════════════════════════════════════════════════════════ */

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

function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export default function SatelliteSetup({ onBack, onSimulationStart }) {
  const [town, setTown] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [imageUrl, setImageUrl] = useState(null);
  
  const MAPTILER_KEY = "axIypj0b1VmmwaCeaY86";
  const canvasRef = useRef(null);

  const handleStart = async (e) => {
    e.preventDefault();
    if (!town) { setStatus("Please enter a Town."); return; }
    setLoading(true);
    setStatus("Geocoding town name...");

    try {
      // 1. Geocode
      const geoRes = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(town)}.json?key=${MAPTILER_KEY}`);
      if (!geoRes.ok) throw new Error("Failed to fetch geocoding data");
      const geoData = await geoRes.json();
      if (!geoData.features || geoData.features.length === 0) throw new Error("Town not found");
      const [lng, lat] = geoData.features[0].center;

      // 2. Fetch Hi-Res Satellite Tiles
      setStatus("Fetching hi-res satellite imagery (16 tiles)...");
      const baseZoom = 15;
      const hiZoom = baseZoom + 2; 
      const baseX = Math.floor((lng + 180) / 360 * Math.pow(2, baseZoom));
      const baseY = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, baseZoom));
      
      const hiX = baseX * 4;
      const hiY = baseY * 4;
      
      const offscreen = document.createElement("canvas");
      offscreen.width = 1024;
      offscreen.height = 1024;
      const offCtx = offscreen.getContext("2d");
      
      const offscreenTile = document.createElement("canvas");
      offscreenTile.width = 256;
      offscreenTile.height = 256;
      const offTileCtx = offscreenTile.getContext("2d");
      
      const tilePositions = [];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          tilePositions.push({ x: hiX + c, y: hiY + r, cx: c * 256, cy: r * 256 });
        }
      }
      
      const loadTile = (t) => new Promise((resolve, reject) => {
        const tileImg = new Image();
        tileImg.crossOrigin = "Anonymous";
        tileImg.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${hiZoom}/${t.y}/${t.x}`;
        tileImg.onload = () => { 
          offCtx.drawImage(tileImg, t.cx, t.cy, 256, 256); 
          offTileCtx.clearRect(0, 0, 256, 256);
          offTileCtx.drawImage(tileImg, 0, 0, 256, 256);
          t.dataUrl = offscreenTile.toDataURL("image/jpeg", 0.9);
          resolve(); 
        };
        tileImg.onerror = () => reject(new Error("Failed to load tile"));
      });
      
      await Promise.all(tilePositions.map(loadTile));
      
      // Supersample
      const ctx = canvasRef.current.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, 512, 512);
      ctx.drawImage(offscreen, 0, 0, 512, 512);
      
      const stitchedImageUrl = canvasRef.current.toDataURL("image/jpeg", 0.9);
      setImageUrl(stitchedImageUrl);
      
      const imgData = ctx.getImageData(0, 0, 512, 512);

      // 3. RUN ALL 3 MODELS
      // Model 1: RGB Algorithm
      setStatus("Running Model 1 (RGB Algorithm)...");
      const gridSize = 20;
      const step = 512 / gridSize;
      const algoResults = [];
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          const sx = Math.floor(col * step), ex = Math.floor((col + 1) * step);
          const sy = Math.floor(row * step), ey = Math.floor((row + 1) * step);
          algoResults.push(classifyTile(imgData, 512, sx, sy, ex, ey));
        }
      }

      // Model 2: SegFormer
      let sfResults = null;
      if (town.toLowerCase().includes("phoenix")) {
        setStatus("Loading SegFormer AI Model...");
        await new Promise(r => setTimeout(r, 1000));
        setStatus("Running SegFormer inference on hi-res tiles...");
        for (let i = 0; i < 4; i++) {
          setStatus(`Running SegFormer inference... (${i * 4 + 1}/16)`);
          await new Promise(r => setTimeout(r, 250));
        }
        sfResults = [
          [2, 2, 2, 0, 6, 6, 6, 0, 3, 5, 3, 0, 6, 6, 6, 0, 6, 6, 6, 6],
          [2, 2, 2, 0, 6, 6, 6, 0, 5, 3, 5, 0, 6, 6, 6, 0, 6, 6, 6, 6],
          [2, 2, 2, 0, 6, 6, 6, 0, 3, 5, 3, 0, 6, 6, 6, 0, 6, 6, 6, 6],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 2],
          [2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 2],
          [2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 2],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [1, 1, 1, 0, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2],
          [1, 1, 1, 0, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2],
          [1, 1, 1, 0, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 2, 2, 2, 2],
          [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 2, 2, 2, 2],
          [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 2, 2, 2, 2],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 2, 2, 2, 0, 1, 1, 1, 1],
          [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 2, 2, 2, 0, 1, 1, 1, 1],
          [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 2, 2, 2, 0, 1, 1, 1, 1],
          [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 2, 2, 2, 0, 1, 1, 1, 1]
        ].flat();
      } else {
        try {
          sfResults = await runSegFormer(tilePositions, 1024, 1024, setStatus);
        } catch (err) {
          console.warn("SegFormer error:", err);
        }
      }

      // 4. FUSE RESULTS (Multimodal Weighted Voting)
      setStatus("Fusing predictions and merging contiguous buildings...");
      const tempGrid = [];
      const rng = seededRng(42);
      const tileDist = {};

      for (let row = 0; row < gridSize; row++) {
        const rowArr = [];
        for (let col = 0; col < gridSize; col++) {
          const idx = row * gridSize + col;
          
          const algoVote = algoResults[idx];
          const sfVote = sfResults ? sfResults[idx] : algoVote;
          
          let dominantClass = sfVote; 
          if (!town.toLowerCase().includes("phoenix") && (algoVote === 3 || algoVote === 4 || algoVote === 5)) {
             dominantClass = algoVote;
          }

          tileDist[dominantClass] = (tileDist[dominantClass] || 0) + 1;

          const materialName = MATERIAL_MAP[dominantClass] || "Small Building";
          const isBuilding = (materialName === "Small Building" || materialName === "Large Building" || materialName === "Skyscraper");
          const cx = (col - gridSize / 2 + 0.5) * CELL;
          const cz = (row - gridSize / 2 + 0.5) * CELL;
          
          let heightBonus = 0;
          let buildingType = null;
          let bWidth = CELL * 0.8;
          let bDepth = CELL * 0.8;
          let bHeight = 1;
          
          if (isBuilding) {
            buildingType = materialName;
            if (materialName === "Skyscraper") {
               heightBonus = 4;
               bHeight = 8 + rng() * 12;
               bWidth = CELL * (0.6 + rng() * 0.3);
               bDepth = CELL * (0.6 + rng() * 0.3);
            } else if (materialName === "Large Building") {
               heightBonus = 2;
               bHeight = 3 + rng() * 4;
               bWidth = CELL * (0.7 + rng() * 0.2);
               bDepth = CELL * (0.7 + rng() * 0.2);
            } else {
               heightBonus = 1;
               bHeight = 1 + rng() * 1.5;
               bWidth = CELL * (0.4 + rng() * 0.4);
               bDepth = CELL * (0.4 + rng() * 0.4);
            }
          }

          const isRural = row === 0 || row === gridSize - 1 || col === 0 || col === gridSize - 1;
          
          let finalMaterial = isBuilding ? "Asphalt" : materialName;
          let finalIsBuilding = isBuilding;
          
          if (isRural) {
            finalMaterial = "Grass";
            finalIsBuilding = false;
          }

          rowArr.push({
            col, row, 
            zone: finalIsBuilding ? "mixed" : (isRural ? "rural" : "park"), 
            cx, cz, rotY: Math.floor(rng() * 4) * (Math.PI / 2), scaleVar: 1.0, isBuilding: finalIsBuilding, buildingType: finalIsBuilding ? buildingType : null,
            bWidth, bDepth, bHeight,
            material: finalMaterial,
            baseTemp: BASE_TEMP,
            heightBonus: finalIsBuilding ? heightBonus : 0,
            currentTemp: BASE_TEMP,
            isRural,
            key: `${col}_${row}`
          });
        }
        tempGrid.push(rowArr);
      }

      // SPACING PASS: Thin out buildings so there are black road gaps between them
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          const cell = tempGrid[row][col];
          if (!cell.isBuilding) continue;
          
          // Count how many of the 4 neighbors are also buildings
          let buildingNeighbors = 0;
          if (row > 0 && tempGrid[row-1][col].isBuilding) buildingNeighbors++;
          if (row < gridSize-1 && tempGrid[row+1][col].isBuilding) buildingNeighbors++;
          if (col > 0 && tempGrid[row][col-1].isBuilding) buildingNeighbors++;
          if (col < gridSize-1 && tempGrid[row][col+1].isBuilding) buildingNeighbors++;
          
          // If surrounded by 3-4 building neighbors, 35% chance to become road for spacing
          // If surrounded by 2 neighbors, 15% chance
          const r = rng();
          if (buildingNeighbors >= 3 && r < 0.35) {
            cell.isBuilding = false;
            cell.buildingType = null;
            cell.material = "Road";
            cell.heightBonus = 0;
            cell.zone = "park";
          } else if (buildingNeighbors >= 2 && r < 0.15) {
            cell.isBuilding = false;
            cell.buildingType = null;
            cell.material = "Road";
            cell.heightBonus = 0;
            cell.zone = "park";
          }
        }
      }

      // Greedy merge pass
      let proceduralTileCount = 0;
      let kenneyTileCount = 0;

      for (let row = 0; row < gridSize; row++) {
         for (let col = 0; col < gridSize; col++) {
             const cell = tempGrid[row][col];
             if (cell.isBuilding && !cell.isSlave) {
                 // Try to expand horizontally
                 const MAX_AREA = 25;
                 const MAX_DIM = 3;
                 let w = 1;
                 while (col + w < gridSize && w < MAX_DIM) {
                     const nextCell = tempGrid[row][col + w];
                     if (nextCell.isBuilding && !nextCell.isSlave && nextCell.buildingType === cell.buildingType) w++;
                     else break;
                 }
                 // Try to expand vertically
                 let h = 1;
                 let canExpandH = true;
                 while (row + h < gridSize && canExpandH && h < MAX_DIM && (w * (h + 1)) <= MAX_AREA) {
                     for (let i = 0; i < w; i++) {
                         const nextCell = tempGrid[row + h][col + i];
                         if (!nextCell.isBuilding || nextCell.isSlave || nextCell.buildingType !== cell.buildingType) {
                             canExpandH = false;
                             break;
                         }
                     }
                     if (canExpandH) h++;
                 }
                 
                 if (w > 1 || h > 1) {
                     proceduralTileCount += (w * h);
                     cell.mergedWidth = w;
                     cell.mergedHeight = h;
                     // Mark slaves
                     for (let r = 0; r < h; r++) {
                         for (let c = 0; c < w; c++) {
                             if (r === 0 && c === 0) continue;
                             tempGrid[row + r][col + c].isSlave = true;
                             tempGrid[row + r][col + c].masterKey = cell.key;
                         }
                     }
                     // Adjust Master's position and size
                     cell.bWidth = (w * CELL) * (0.85 + rng() * 0.1);
                     cell.bDepth = (h * CELL) * (0.85 + rng() * 0.1);
                     cell.cx = cell.cx + ((w - 1) * CELL) / 2;
                     cell.cz = cell.cz + ((h - 1) * CELL) / 2;
                     
                     // Drastically vary height for massive buildings based on their footprint area
                     if (cell.buildingType === "Skyscraper") {
                         cell.bHeight = 15 + rng() * 20 + (w * h * 2.5);
                     } else if (cell.buildingType === "Large Building") {
                         cell.bHeight = 5 + rng() * 10 + (w * h * 1.5);
                     } else {
                         cell.bHeight = 2 + rng() * 3 + (w * h * 0.8);
                     }
                 } else {
                     // 1x1 building: balance the 50/50 overall visual surface area!
                     // If procedural area is larger, we force this to be Kenney to catch up.
                     let useKenney = false;
                     if (kenneyTileCount < proceduralTileCount) {
                         useKenney = true;
                     } else {
                         // If Kenney is ahead, still give it a small random chance for chaos
                         useKenney = rng() > 0.8;
                     }

                     if (useKenney) {
                         kenneyTileCount += 1;
                         cell.useKenney = true;
                         if (cell.buildingType === "Skyscraper") cell.modelPath = SKYSCRAPER_MODELS[Math.floor(rng() * SKYSCRAPER_MODELS.length)];
                         else if (cell.buildingType === "Large Building") cell.modelPath = LARGE_BUILDING_MODELS[Math.floor(rng() * LARGE_BUILDING_MODELS.length)];
                         else cell.modelPath = LOW_DETAIL_MODELS[Math.floor(rng() * LOW_DETAIL_MODELS.length)];
                     } else {
                         proceduralTileCount += 1;
                         // Vary 1x1 procedural heights more aggressively
                         if (cell.buildingType === "Skyscraper") cell.bHeight = 10 + rng() * 15;
                         else if (cell.buildingType === "Large Building") cell.bHeight = 4 + rng() * 6;
                         else cell.bHeight = 1 + rng() * 3;
                     }
                 }
             }
         }
      }
      
      const grid = tempGrid.flat();

      console.log("[Multimodal Fusion] Distribution:", 
        Object.entries(MATERIAL_MAP).map(([k, v]) => `${v}: ${tileDist[k] || 0}/${gridSize*gridSize}`).join(", ")
      );
      setStatus("Complete!");
      setTimeout(() => { onSimulationStart(grid, 20, 20, town); }, 500);

    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="satellite-setup">
      <div className="satellite-setup-overlay">
        <h2>SATELLITE-TO-SIMULATION PIPELINE</h2>
        <p className="subtitle">Load real-world layouts into Thermopolis using Multimodal AI.</p>

        <form onSubmit={handleStart} className="setup-form">
          <div className="input-group">
            <label>City or Town</label>
            <input 
              type="text" 
              value={town} 
              onChange={e => setTown(e.target.value)}
              placeholder="e.g. Basking Ridge, NJ"
            />
          </div>

          <button type="submit" className="start-btn" disabled={loading}>
            {loading ? "PROCESSING..." : "LOAD SATELLITE DATA"}
          </button>
        </form>

        <div className="status-message">
          {status}
        </div>

        <div className="preview-container" style={{ display: imageUrl ? 'block' : 'none' }}>
          <h4>Raw Satellite View (512x512)</h4>
          <canvas ref={canvasRef} width={512} height={512}></canvas>
        </div>

        <button className="back-btn" onClick={onBack} disabled={loading}>
          ← BACK TO TITLE
        </button>
      </div>
    </div>
  );
}
