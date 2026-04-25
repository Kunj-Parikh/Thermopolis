import React from "react";
import "./InfoPage.css";

export default function InfoPage({ onBack }) {
  return (
    <div className="info-page">
      <div className="info-page-inner">
        <button className="info-back-btn" onClick={onBack}>BACK</button>

        <h1 className="info-hero-title">The Science Behind Thermopolis</h1>

        <section className="info-section">
          <h2>Urban Heat Island Effect</h2>
          <ul>
            <li>Cities run 2–5°C hotter than surrounding countryside</li>
            <li>Mapped by NASA/NOAA satellites — this is real, measurable physics</li>
            <li>Heat kills more Americans than any other weather event</li>
            <li>Low-income areas get hit hardest — less green space, older buildings</li>
          </ul>
        </section>

        <section className="info-section">
          <h2>Albedo</h2>
          <ul>
            <li>How much sunlight a surface reflects (0 = absorbs all, 1 = reflects all)</li>
            <li>Asphalt: ~0.05 — absorbs 95% of solar energy</li>
            <li>Grass: ~0.25 — absorbs 75%</li>
            <li>White roofs: ~0.70 — reflects most of it</li>
            <li>Biggest driver of urban heat</li>
          </ul>
        </section>

        <section className="info-section">
          <h2>Evapotranspiration (Cooling)</h2>
          <ul>
            <li>Plants pull water up and evaporate it from leaves — takes heat from the air</li>
            <li>One tree = ~10 air conditioners running 20 hours</li>
            <li>Concrete does none of this — it just gets hot</li>
            <li>Shows up as the "Cooling" stat on each material</li>
          </ul>
        </section>

        <section className="info-section">
          <h2>Heat Diffusion</h2>
          <ul>
            <li>Hot surfaces warm neighboring cells — heat spreads</li>
            <li>Clustered hot surfaces create heat cores that radiate outward</li>
            <li>Thermopolis runs the real diffusion equation: ∂T/∂t = α × ∇²T</li>
            <li>Same materials, different layout = different temperatures</li>
          </ul>
        </section>

        <section className="info-section">
          <h2>UHII — How We Score</h2>
          <div className="info-formula">
            UHII = avg temp (city) − avg temp (rural ring)
          </div>
          <ul>
            <li>Outer ring = untouchable rural baseline (grass)</li>
            <li>Standard metric from published urban climate research</li>
          </ul>
          <table className="info-table">
            <thead><tr><th>UHII</th><th>Rating</th></tr></thead>
            <tbody>
              <tr><td>&lt; 1.0°C</td><td>Excellent</td></tr>
              <tr><td>1.0 – 2.0°C</td><td>Good</td></tr>
              <tr><td>2.0 – 3.5°C</td><td>Concerning</td></tr>
              <tr><td>3.5 – 5.0°C</td><td>Severe</td></tr>
              <tr><td>&gt; 5.0°C</td><td>Extreme</td></tr>
            </tbody>
          </table>
          <ul>
            <li>Phoenix: 8°C+ — London: 3–4°C — Singapore: &lt;2°C (urban greening)</li>
          </ul>
        </section>

        <section className="info-section">
          <h2>Materials</h2>
          <ul>
            <li>All values from NOAA/EPA reference data and field research</li>
            <li>High albedo reflects heat but doesn't cool neighbors</li>
            <li>High cooling pulls heat from the air but costs more</li>
            <li>Finding the balance is the game</li>
          </ul>
        </section>

        <section className="info-section">
          <h2>Why It Matters</h2>
          <ul>
            <li>Urban heat is fixable — it's caused by material choices, not climate inertia</li>
            <li>Singapore, Melbourne, Medellin already proved greening works</li>
            <li>The science is known. The gap is awareness.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
