// src/DashboardStats.tsx

import React from 'react';
import { BestePrijsInfo } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';

// Dit type is nodig om de 'bestPrices' map correct te kunnen gebruiken
type BestPriceByCountry = {
  NL?: BestePrijsInfo;
  ES?: BestePrijsInfo;
};

// Definieer de props (input) voor onze component
interface DashboardStatsProps {
  aankopenCount: number;
  productsCount: number;
  winkelsCount: number;
  bestPrices: Map<bigint, BestPriceByCountry>;
}

// Een kleinere, herbruikbare component voor elke individuele statistiek-kaart
const StatCard = ({ value, label }: { value: number | string, label: string }) => (
  <div className="stat-card">
    <span className="stat-value">{value}</span>
    <span className="stat-label">{label}</span>
  </div>
);

const DashboardStats: React.FC<DashboardStatsProps> = ({
  aankopenCount,
  productsCount,
  winkelsCount,
  bestPrices,
}) => {
  // Het aantal unieke producten met een prijs is simpelweg de grootte van de map
  const productsWithPriceCount = bestPrices.size;

  return (
    <section className="dashboard-stats">
      <StatCard value={aankopenCount} label="Geregistreerde Prijzen" />
      <StatCard value={productsCount} label="Unieke Producten" />
      <StatCard value={winkelsCount} label="Aangemaakte Winkels" />
      {/* Toon het aantal producten met prijsdata versus het totaal */}
      <StatCard value={`${productsWithPriceCount} / ${productsCount}`} label="Producten met Prijsdata" />
    </section>
  );
};

export default DashboardStats;