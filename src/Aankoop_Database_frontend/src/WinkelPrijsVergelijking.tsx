// src/WinkelPrijsVergelijking.tsx
import React, { useMemo, useState } from 'react';
import { Aankoop, Product, Winkel, Eenheid } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';

type AankoopExtended = [Aankoop, string, string];

interface Props {
  aankopen: AankoopExtended[];
  products: Product[];
  winkels: Winkel[];
  selectedStoreIds: Set<bigint>;
}

// Helper om eenheidsprijzen te formatteren en converteren
const formatEenheidsprijs = (prijs: number, eenheid: Eenheid): string => {
  const eenheidKey = Object.keys(eenheid)[0];

  if (eenheidKey === 'GRAM') {
    return `€${(prijs * 1000).toFixed(2)} per kg`;
  }
  if (eenheidKey === 'MILLILITER') {
    return `€${(prijs * 1000).toFixed(2)} per liter`;
  }

  const eenheidText = (eenheidKey || '').toLowerCase();
  return `€${prijs.toFixed(2)} per ${eenheidText}`;
};


const WinkelPrijsVergelijking: React.FC<Props> = ({ aankopen, products, winkels, selectedStoreIds }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const prijsVergelijkingData = useMemo(() => {
    const filteredAankopen = selectedStoreIds.size > 0
      ? aankopen.filter(([a]) => selectedStoreIds.has(a.winkelId))
      : aankopen;

    const dataByProduct = new Map<bigint, any[]>();
    const laatsteAankopen = new Map<string, Aankoop>();

    filteredAankopen.forEach(([a]) => {
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
      if (eenheidsprijs === 0) return; // Sla gratis producten over in de vergelijking

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
  }, [aankopen, products, winkels, selectedStoreIds]);

  const filteredAndSortedProducts = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    return Array.from(prijsVergelijkingData.entries())
      .map(([productId, winkelData]) => {
        const product = products.find(p => p.id === productId);
        let prijsVerschilPercentage: number | null = null;

        if (winkelData.length >= 2) {
          const goedkoopste = winkelData[0].eenheidsprijs;
          const duurste = winkelData[winkelData.length - 1].eenheidsprijs;
          if (duurste > 0) { // Voorkom delen door nul, nu met de duurste prijs
            prijsVerschilPercentage = ((duurste - goedkoopste) / duurste) * 100;
          }
        }

        return {
          productId,
          product,
          winkelData,
          prijsVerschilPercentage
        }
      })
      .filter(({ product, winkelData }) => {
        if (!product || winkelData.length < 2) return false;

        const searchableText = `${product.naam} ${product.merk}`.toLowerCase();
        return searchableText.includes(lowerCaseSearchTerm);
      })
      // Sorteer op het grootste prijsverschil
      .sort((a, b) => (b.prijsVerschilPercentage || 0) - (a.prijsVerschilPercentage || 0));
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

      {filteredAndSortedProducts.map(({ productId, product, winkelData, prijsVerschilPercentage }) => (
        <div key={String(productId)} className="widget-subsection">
          <h5>
            {product?.naam} ({product?.merk})
            {prijsVerschilPercentage !== null && prijsVerschilPercentage > 1 && ( // Toon alleen als het verschil de moeite waard is
              <span className="price-decrease" style={{ marginLeft: '0.5rem', fontSize: '0.8em', fontWeight: 'bold' }}>
                Tot {prijsVerschilPercentage.toFixed(0)}% goedkoper
              </span>
            )}
          </h5>
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
                {winkelData.map((data, index) => (
                  <tr key={index}>
                    <td>{data.winkelNaam}</td>
                    <td>{data.keten}</td>
                    <td>{data.land}</td>
                    <td>{product ? formatEenheidsprijs(data.eenheidsprijs, product.standaardEenheid) : '-'}</td>
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