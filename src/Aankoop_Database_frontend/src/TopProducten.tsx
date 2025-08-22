// src/TopProducten.tsx

import React, { useMemo } from 'react';
import { Aankoop, Product } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';

type AankoopExtended = [Aankoop, string, string];

interface Props {
  aankopen: AankoopExtended[];
  products: Product[];
}

// Helper functie om eenheid te formatteren zonder icoon
const formatEenheidSimple = (eenheid?: object): string => {
    if (!eenheid || Object.keys(eenheid).length === 0) return '';
    const key = Object.keys(eenheid)[0].toLowerCase();
    return key.charAt(0).toUpperCase() + key.slice(1);
};

const TopProducten: React.FC<Props> = ({ aankopen, products }) => {
  const productHoeveelheden = useMemo(() => {
    const totalen = new Map<bigint, number>();
    aankopen.forEach(([a]) => {
      const huidigTotaal = totalen.get(a.productId) || 0;
      totalen.set(a.productId, huidigTotaal + a.hoeveelheid);
    });

    const gesorteerd = Array.from(totalen.entries())
      .map(([productId, totaal]) => ({
        productId,
        product: products.find(p => p.id === productId),
        totaal,
      }))
      .filter(item => item.product) // Verwijder items zonder productinfo
      .sort((a, b) => b.totaal - a.totaal);

    return {
      top10: gesorteerd.slice(0, 10),
      bottom10: gesorteerd.slice(-10).reverse(),
    };
  }, [aankopen, products]);

  return (
    <div className="dashboard-widget">
      <h4>Meest Gekochte Producten (op hoeveelheid)</h4>
      <div className="table-container-widget">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Totaal</th>
            </tr>
          </thead>
          <tbody>
            {productHoeveelheden.top10.map((item, index) => (
              <tr key={String(item.productId)}>
                <td>{index + 1}</td>
                <td>{item.product!.naam}</td>
                <td>{item.totaal.toFixed(2)} {formatEenheidSimple(item.product!.standaardEenheid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <h4 style={{marginTop: '1.5rem'}}>Minst Gekochte Producten (op hoeveelheid)</h4>
      <div className="table-container-widget">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Totaal</th>
            </tr>
          </thead>
          <tbody>
            {productHoeveelheden.bottom10.map((item, index) => (
              <tr key={String(item.productId)}>
                <td>{index + 1}</td>
                <td>{item.product!.naam}</td>
                <td>{item.totaal.toFixed(2)} {formatEenheidSimple(item.product!.standaardEenheid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TopProducten;