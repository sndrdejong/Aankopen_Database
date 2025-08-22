// src/Dashboard.tsx

import React from 'react';
import { Aankoop, Product, Winkel } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';

import WinkelPrijsVergelijking from './WinkelPrijsVergelijking';
import PrijsOntwikkeling from './PrijsOntwikkeling';
import TopProducten from './TopProducten';
import UitgavenPerWinkel from './UitgavenPerWinkel';

type AankoopExtended = [Aankoop, string, string];

interface DashboardProps {
  aankopen: AankoopExtended[];
  products: Product[];
  winkels: Winkel[];
}

const Dashboard: React.FC<DashboardProps> = ({ aankopen, products, winkels }) => {
  if (aankopen.length === 0) {
    return <p>Voeg eerst enkele aankopen toe om het dashboard te kunnen zien.</p>;
  }

  return (
    <div className="dashboard-grid">
      <PrijsOntwikkeling aankopen={aankopen} products={products} />
      <UitgavenPerWinkel aankopen={aankopen} winkels={winkels} />
      <TopProducten aankopen={aankopen} products={products} />
      <WinkelPrijsVergelijking aankopen={aankopen} products={products} winkels={winkels} />
    </div>
  );
};

export default Dashboard;