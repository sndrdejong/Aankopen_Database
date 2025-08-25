// src/PrijsOntwikkeling.tsx

import React, { useMemo, useState } from 'react';
import { Aankoop, Product, Winkel } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';

type AankoopExtended = [Aankoop, string, string];
type SortOrder = 'verandering' | 'stijging' | 'daling' | 'alfabetisch';

interface Props {
  aankopen: AankoopExtended[];
  products: Product[];
  winkels: Winkel[];
  selectedStoreIds: Set<bigint>;
}

const PrijsOntwikkeling: React.FC<Props> = ({ aankopen, products, winkels, selectedStoreIds }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('verandering');

  const prijsOntwikkelingData = useMemo(() => {
    // Filter eerst op geselecteerde winkels EN op aankopen die niet gratis waren
    const relevanteAankopen = aankopen.filter(([a]) => {
        const storeFilterPassed = selectedStoreIds.size === 0 || selectedStoreIds.has(a.winkelId);
        const priceFilterPassed = a.prijs > 0;
        return storeFilterPassed && priceFilterPassed;
    });

    const dataByProductAndWinkel = new Map<string, Aankoop[]>();
    relevanteAankopen.forEach(([a]) => {
      const key = `${a.productId}-${a.winkelId}`;
      if (!dataByProductAndWinkel.has(key)) {
        dataByProductAndWinkel.set(key, []);
      }
      dataByProductAndWinkel.get(key)?.push(a);
    });

    const result: any[] = [];
    dataByProductAndWinkel.forEach((productAankopen, key) => {
      if (productAankopen.length < 2) return;

      const [productIdStr, winkelIdStr] = key.split('-');
      const productId = BigInt(productIdStr);
      const winkelId = BigInt(winkelIdStr);
      
      productAankopen.sort((a, b) => Number(a.datum) - Number(b.datum));
      
      const eerste = productAankopen[0];
      const laatste = productAankopen[productAankopen.length - 1];
      
      const eerstePrijs = eerste.prijs / eerste.hoeveelheid;
      const laatstePrijs = laatste.prijs / laatste.hoeveelheid;
      
      if (eerstePrijs === 0) return;
      
      const verandering = ((laatstePrijs - eerstePrijs) / eerstePrijs) * 100;

      // Sla producten zonder prijsverandering over
      if (verandering === 0) return;

      const product = products.find(p => p.id === productId);
      const winkel = winkels.find(w => w.id === winkelId);

      if (product && winkel) {
        result.push({
          key,
          productNaam: `${product.naam} (${product.merk})`,
          winkelNaam: winkel.naam,
          winkelKeten: winkel.keten,
          winkelLand: winkel.land,
          eerstePrijs,
          laatstePrijs,
          verandering,
          aantal: productAankopen.length,
        });
      }
    });

    return result;
  }, [aankopen, products, winkels, selectedStoreIds]);

  const filteredAndSortedData = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    // Helper function to safely convert the land object to a string for searching
    const getLandAsString = (landObject: any) => {
        if (typeof landObject === 'object' && landObject !== null) {
            return Object.keys(landObject)[0] || '';
        }
        return '';
    }

    return prijsOntwikkelingData
      .filter(data => 
        data.productNaam.toLowerCase().includes(lowerCaseSearchTerm) ||
        data.winkelNaam.toLowerCase().includes(lowerCaseSearchTerm) ||
        data.winkelKeten.toLowerCase().includes(lowerCaseSearchTerm) ||
        getLandAsString(data.winkelLand).toLowerCase().includes(lowerCaseSearchTerm)
      )
      .sort((a, b) => {
        switch (sortOrder) {
          case 'stijging':
            return b.verandering - a.verandering;
          case 'daling':
            return a.verandering - b.verandering;
          case 'alfabetisch':
            return a.productNaam.localeCompare(b.productNaam);
          case 'verandering':
          default:
            return Math.abs(b.verandering) - Math.abs(a.verandering);
        }
      });
  }, [prijsOntwikkelingData, searchTerm, sortOrder]);

  if (prijsOntwikkelingData.length === 0) return null;

  return (
    <>
      <div className="filter-controls" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
        <input
            type="text"
            placeholder="Zoek op product, merk of winkel..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
        />
        <div className="button-group" style={{ justifyContent: 'flex-start' }}>
            <button onClick={() => setSortOrder('verandering')} className={sortOrder === 'verandering' ? 'button-primary' : 'button-secondary'}>Grootste verandering</button>
            <button onClick={() => setSortOrder('stijging')} className={sortOrder === 'stijging' ? 'button-primary' : 'button-secondary'}>Grootste stijgers</button>
            <button onClick={() => setSortOrder('daling')} className={sortOrder === 'daling' ? 'button-primary' : 'button-secondary'}>Grootste dalers</button>
            <button onClick={() => setSortOrder('alfabetisch')} className={sortOrder === 'alfabetisch' ? 'button-primary' : 'button-secondary'}>Alfabetisch</button>
        </div>
      </div>
      <div className="table-container-widget">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Winkel</th>
              <th>Keten</th>
              <th>Land</th>
              <th>Verandering</th>
              <th>Prijs Historie</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedData.slice(0, 10).map(data => (
              <tr key={data.key}>
                <td>{data.productNaam} ({data.aantal}x)</td>
                <td>{data.winkelNaam}</td>
                <td>{data.winkelKeten}</td>
                <td>{Object.keys(data.winkelLand)[0]}</td>
                <td>
                  <span className={data.verandering > 0 ? 'price-increase' : 'price-decrease'}>
                    {data.verandering > 0 ? '▲' : '▼'} {data.verandering.toFixed(1)}%
                  </span>
                </td>
                <td>€{data.eerstePrijs.toFixed(2)} → €{data.laatstePrijs.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default PrijsOntwikkeling;