// src/PrijsOntwikkeling.tsx

import React, { useMemo } from 'react';
import { Aankoop, Product } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';

type AankoopExtended = [Aankoop, string, string];

interface Props {
  aankopen: AankoopExtended[];
  products: Product[];
}

const PrijsOntwikkeling: React.FC<Props> = ({ aankopen, products }) => {
  const prijsOntwikkelingData = useMemo(() => {
    const dataByProduct = new Map<bigint, Aankoop[]>();
    aankopen.forEach(([a]) => {
      if (!dataByProduct.has(a.productId)) {
        dataByProduct.set(a.productId, []);
      }
      dataByProduct.get(a.productId)?.push(a);
    });

    const result: any[] = [];
    dataByProduct.forEach((productAankopen, productId) => {
      if (productAankopen.length < 2) return; // Minimaal 2 aankopen nodig

      productAankopen.sort((a, b) => Number(a.datum) - Number(b.datum));
      
      const eerste = productAankopen[0];
      const laatste = productAankopen[productAankopen.length - 1];
      
      const eerstePrijs = eerste.prijs / eerste.hoeveelheid;
      const laatstePrijs = laatste.prijs / laatste.hoeveelheid;
      
      if (eerstePrijs === 0) return; // Voorkom delen door nul
      
      const verandering = ((laatstePrijs - eerstePrijs) / eerstePrijs) * 100;

      const product = products.find(p => p.id === productId);
      if (product) {
        result.push({
          productId: product.id,
          productNaam: `${product.naam} (${product.merk})`,
          eerstePrijs,
          laatstePrijs,
          verandering,
          aantal: productAankopen.length,
        });
      }
    });

    return result.sort((a, b) => Math.abs(b.verandering) - Math.abs(a.verandering));
  }, [aankopen, products]);

  if (prijsOntwikkelingData.length === 0) return null;

  return (
    <div className="dashboard-widget">
      <h4>Prijsontwikkeling Producten</h4>
      <div className="table-container-widget">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Verandering</th>
              <th>Eerste / Laatste Prijs</th>
            </tr>
          </thead>
          <tbody>
            {prijsOntwikkelingData.slice(0, 10).map(data => (
              <tr key={String(data.productId)}>
                <td>{data.productNaam} ({data.aantal}x)</td>
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
    </div>
  );
};

export default PrijsOntwikkeling;