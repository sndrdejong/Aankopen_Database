// src/WinkelPrijsVergelijking.tsx

import React, { useMemo } from 'react';
import { Aankoop, Product, Winkel } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';

type AankoopExtended = [Aankoop, string, string];

interface Props {
  aankopen: AankoopExtended[];
  products: Product[];
  winkels: Winkel[];
}

const WinkelPrijsVergelijking: React.FC<Props> = ({ aankopen, products, winkels }) => {
  const prijsVergelijkingData = useMemo(() => {
    const dataByProduct = new Map<bigint, any[]>();

    // 1. Vind de meest recente aankoop per winkel voor elk product
    const laatsteAankopen = new Map<string, Aankoop>(); // Key: "productId-winkelId"
    aankopen.forEach(([a]) => {
      const key = `${a.productId}-${a.winkelId}`;
      const bestaande = laatsteAankopen.get(key);
      if (!bestaande || a.datum > bestaande.datum) {
        laatsteAankopen.set(key, a);
      }
    });

    // 2. Organiseer per product en bereken de eenheidsprijs
    laatsteAankopen.forEach((aankoop) => {
      const product = products.find(p => p.id === aankoop.productId);
      const winkel = winkels.find(w => w.id === aankoop.winkelId);
      if (!product || !winkel) return;

      const eenheidsprijs = aankoop.hoeveelheid > 0 ? aankoop.prijs / aankoop.hoeveelheid : 0;
      
      const entry = {
        winkelNaam: winkel.naam,
        eenheidsprijs,
        datum: new Date(Number(aankoop.datum) / 1_000_000),
      };

      if (!dataByProduct.has(product.id)) {
        dataByProduct.set(product.id, []);
      }
      dataByProduct.get(product.id)?.push(entry);
    });

    // 3. Sorteer winkels per product op prijs
    dataByProduct.forEach((winkelData, productId) => {
      winkelData.sort((a, b) => a.eenheidsprijs - b.eenheidsprijs);
       // Limiteer tot de top 5 goedkoopste
      dataByProduct.set(productId, winkelData.slice(0, 5));
    });

    return dataByProduct;
  }, [aankopen, products, winkels]);

  if (prijsVergelijkingData.size === 0) return null;

  return (
    <div className="dashboard-widget">
      <h4>Goedkoopste Winkels (per product, laatste prijs)</h4>
      {Array.from(prijsVergelijkingData.entries()).map(([productId, winkelData]) => {
        const product = products.find(p => p.id === productId);
        if (winkelData.length < 2) return null; // Toon alleen als er iets te vergelijken is
        return (
          <div key={String(productId)} className="widget-subsection">
            <h5>{product?.naam} ({product?.merk})</h5>
            <div className="table-container-widget">
              <table>
                <thead>
                  <tr>
                    <th>Winkel</th>
                    <th>Eenheidsprijs</th>
                    <th>Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {winkelData.map((data, index) => (
                    <tr key={index}>
                      <td>{data.winkelNaam}</td>
                      <td>€{data.eenheidsprijs.toFixed(2)}</td>
                      <td>{data.datum.toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WinkelPrijsVergelijking;