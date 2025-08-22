// src/WinkelPrijsVergelijking.tsx

import React, { useMemo, useState } from 'react';
import { Aankoop, Product, Winkel } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';

type AankoopExtended = [Aankoop, string, string];

interface Props {
  aankopen: AankoopExtended[];
  products: Product[];
  winkels: Winkel[];
}

const WinkelPrijsVergelijking: React.FC<Props> = ({ aankopen, products, winkels }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const prijsVergelijkingData = useMemo(() => {
    const dataByProduct = new Map<bigint, any[]>();
    const laatsteAankopen = new Map<string, Aankoop>();
    aankopen.forEach(([a]) => {
      const key = `${a.productId}-${a.winkelId}`;
      const bestaande = laatsteAankopen.get(key);
      if (!bestaande || a.datum > bestaande.datum) {
        laatsteAankopen.set(key, a);
      }
    });

    laatsteAankopen.forEach((aankoop) => {
      const product = products.find(p => p.id === aankoop.productId);
      const winkel = winkels.find(w => w.id === aankoop.winkelId);
      if (!product || !winkel) return;

      const eenheidsprijs = aankoop.hoeveelheid > 0 ? aankoop.prijs / aankoop.hoeveelheid : 0;
      
      const entry = {
        winkelNaam: winkel.naam,
        land: Object.keys(winkel.land)[0],
        keten: winkel.keten,
        eenheidsprijs,
        datum: new Date(Number(aankoop.datum) / 1_000_000),
      };

      if (!dataByProduct.has(product.id)) {
        dataByProduct.set(product.id, []);
      }
      dataByProduct.get(product.id)?.push(entry);
    });

    dataByProduct.forEach((winkelData) => {
      winkelData.sort((a, b) => a.eenheidsprijs - b.eenheidsprijs);
    });

    return dataByProduct;
  }, [aankopen, products, winkels]);
  
  const filteredAndSortedProducts = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    
    return Array.from(prijsVergelijkingData.entries())
      .map(([productId, winkelData]) => ({
        productId,
        product: products.find(p => p.id === productId),
        winkelData
      }))
      .filter(({ product, winkelData }) => {
        if (!product || winkelData.length < 2) return false;
        
        const searchableText = `${product.naam} ${product.merk}`.toLowerCase();
        return searchableText.includes(lowerCaseSearchTerm);
      })
      .sort((a, b) => a.product!.naam.localeCompare(b.product!.naam));
  }, [prijsVergelijkingData, searchTerm, products]);


  if (prijsVergelijkingData.size === 0) return null;

  return (
    <>
      <div className="filter-controls" style={{ marginBottom: '1rem' }}>
          <input
              type="text"
              placeholder="Zoek op productnaam of merk..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
          />
      </div>

      {filteredAndSortedProducts.map(({ productId, product, winkelData }) => (
          <div key={String(productId)} className="widget-subsection">
            <h5>{product?.naam} ({product?.merk})</h5>
            <div className="table-container-widget">
              <table>
                <thead>
                  <tr>
                    <th>Winkel</th>
                    <th>Keten</th>
                    <th>Land</th>
                    <th>Eenheidsprijs</th>
                    <th>Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {winkelData.slice(0, 5).map((data, index) => (
                    <tr key={index}>
                      <td>{data.winkelNaam}</td>
                      <td>{data.keten}</td>
                      <td>{data.land}</td>
                      <td>€{data.eenheidsprijs.toFixed(2)}</td>
                      <td>{data.datum.toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </>
  );
};

export default WinkelPrijsVergelijking;