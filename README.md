# Thermopolis

**A 3D city-building game about the urban heat island effect.**

Cities run 2–5 °C hotter than the countryside around them, and heat kills more Americans than any other weather event. Most of that comes down to surfaces: asphalt absorbs about 95% of sunlight, while grass, trees, and white roofs reflect it or cool the air through evapotranspiration.

In Thermopolis you start from a real town. Type a name, the game pulls satellite imagery for it, and a computer vision model turns what's actually there (buildings, roads, vegetation, water) into a playable grid. Then you redesign it: every material carries real albedo and cooling values, so each choice changes your city's temperature score, and players compete on a shared scoreboard.

## Features

- **Real places → game map:** geocodes any town (MapTiler), fetches satellite tiles (ArcGIS World Imagery), and classifies each grid cell with a SegFormer semantic segmentation model running in the browser (Transformers.js / ONNX Runtime Web), cross-checked by a custom RGB color classifier
- **3D city builder:** placeable buildings and terrain, orbit camera, sky, rendered with React Three Fiber
- **Science-backed scoring:** albedo and cooling stats per material, with an in-game page explaining the physics
- **Accounts and leaderboard:** Firebase authentication and a scoreboard
- **ML-ready backend:** Flask API with a prediction endpoint for future temperature modeling

## Stack

React · Vite · Three.js / React Three Fiber / drei · Transformers.js (SegFormer) · ONNX Runtime Web · Firebase · Flask · Kenney City Kit 3D assets

## Running locally

```bash
npm install
npm run dev
# optional backend
pip install flask
python flaskServer.py
```
