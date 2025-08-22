// src/UitgavenPerWinkel.tsx

import React, { useMemo } from 'react';
import { Aankoop, Winkel } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';

type AankoopExtended = [Aankoop, string, string];

interface Props {
  aankopen: AankoopExtended[];
  winkels: Winkel[];
}

const UitgavenPerWinkel: React.FC<Props> = ({ aankopen, winkels }) => {
  const uitgavenData = useMemo(() => {
    const data = new Map<bigint, { totaal: number; bezoeken: number }>();

    aankopen.forEach(([a]) => {
      const winkelStats = data.get(a.winkelId) || { totaal: 0, bezoeken: 0 };
      winkelStats.totaal += a.prijs;
      winkelStats.bezoeken += 1;
      data.set(a.winkelId, winkelStats);
    });

    return Array.from(data.entries())
      .map(([winkelId, stats]) => ({
        winkel: winkels.find(w => w.id === winkelId),
        ...stats,
      }))
      .filter(item => item.winkel)
      .sort((a, b) => b.totaal - a.totaal);
      
  }, [aankopen, winkels]);

  if (uitgavenData.length === 0) return null;

  return (
    <div className="dashboard-widget">
      <h4>Uitgaven per Winkel</h4>
      <div className="table-container-widget">
        <table>
          <thead>
            <tr>
              <th>Winkel</th>
              <th>Totaal</th>
              <th>Gem. per bezoek</th>
            </tr>
          </thead>
          <tbody>
            {uitgavenData.map(data => (
              <tr key={String(data.winkel!.id)}>
                <td>{data.winkel!.naam} ({data.bezoeken}x)</td>
                <td>€{data.totaal.toFixed(2)}</td>
                <td>€{(data.totaal / data.bezoeken).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UitgavenPerWinkel;