// src/Dashboard.tsx

import React, { useState, ReactNode } from 'react';
import { Aankoop, Product, Winkel } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';

import WinkelPrijsVergelijking from './WinkelPrijsVergelijking';
import PrijsOntwikkeling from './PrijsOntwikkeling';

type AankoopExtended = [Aankoop, string, string];

interface DashboardProps {
  aankopen: AankoopExtended[];
  products: Product[];
  winkels: Winkel[];
  selectedStoreIds: Set<bigint>;
}

// Helper component to make each dashboard widget collapsible
const CollapsibleDashboardWidget = ({ title, children }: { title: string, children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(true); // Widgets are open by default

  return (
    <div className="dashboard-widget">
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <span className="collapsible-icon" style={{color: '#6B8E23'}}>{isOpen ? '➖' : '➕'}</span>
        <h4>{title}</h4>
      </div>
      {isOpen && children}
    </div>
  );
};


const Dashboard: React.FC<DashboardProps> = ({ aankopen, products, winkels, selectedStoreIds }) => {
  if (aankopen.length === 0) {
    return <p>Voeg eerst enkele aankopen toe om het dashboard te kunnen zien.</p>;
  }

  return (
    <>
      <div className="orientation-tip">
        <span>📱 Voor de beste weergave, kantel je scherm.</span>
      </div>
      <div className="dashboard-grid">
        <CollapsibleDashboardWidget title="Prijsontwikkeling Producten per Winkel">
          <PrijsOntwikkeling aankopen={aankopen} products={products} winkels={winkels} selectedStoreIds={selectedStoreIds} />
        </CollapsibleDashboardWidget>
        
        <CollapsibleDashboardWidget title="Goedkoopste Winkels per Product">
          <WinkelPrijsVergelijking aankopen={aankopen} products={products} winkels={winkels} selectedStoreIds={selectedStoreIds} />
        </CollapsibleDashboardWidget>
      </div>
    </>
  );
};

export default Dashboard;