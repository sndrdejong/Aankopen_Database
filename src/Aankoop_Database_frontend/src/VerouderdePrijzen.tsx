// src/VerouderdePrijzen.tsx
import React, { useMemo } from 'react';
import { Aankoop, Product, Winkel } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';

type AankoopExtended = [Aankoop, string, string];

interface Props {
  aankopen: AankoopExtended[];
  products: Product[];
  winkels: Winkel[];
  selectedStoreIds: Set<bigint>;
}

const VerouderdePrijzen: React.FC<Props> = ({ aankopen, products, winkels, selectedStoreIds }) => {
  const verouderdeProducten = useMemo(() => {
    const TWEE_WEKEN_IN_MS = 14 * 24 * 60 * 60 * 1000;
    const nu = new Date().getTime();

    const laatsteAankoopPerProduct = new Map<bigint, Aankoop>();

    const filteredAankopen = selectedStoreIds.size > 0
      ? aankopen.filter(([a]) => selectedStoreIds.has(a.winkelId))
      : aankopen;

    filteredAankopen.forEach(([aankoop]) => {
      const bestaande = laatsteAankoopPerProduct.get(aankoop.productId);
      if (!bestaande || aankoop.datum > bestaande.datum) {
        laatsteAankoopPerProduct.set(aankoop.productId, aankoop);
      }
    });

    const result: any[] = [];
    laatsteAankoopPerProduct.forEach((aankoop, productId) => {
      const aankoopDatum = new Date(Number(aankoop.datum) / 1_000_000).getTime();
      if (nu - aankoopDatum > TWEE_WEKEN_IN_MS) {
        const product = products.find(p => p.id === productId);
        const winkel = winkels.find(w => w.id === aankoop.winkelId);

        if (product && winkel) {
          result.push({
            key: `${productId}-${winkel.id}`,
            productNaam: `${product.naam} (${product.merk})`,
            winkelNaam: `${winkel.naam} (${winkel.keten})`,
            land: Object.keys(winkel.land)[0],
            laatsteDatum: new Date(Number(aankoop.datum) / 1_000_000),
          });
        }
      }
    });

    // Sorteer op oudste datum eerst
    return result.sort((a, b) => a.laatsteDatum.getTime() - b.laatsteDatum.getTime());

  }, [aankopen, products, winkels, selectedStoreIds]);

  if (verouderdeProducten.length === 0) {
    return <p>Alle prijzen zijn recent bijgewerkt. Top!</p>;
  }

  return (
    <div className="table-container-widget">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Winkel</th>
            <th>Laatst gezien</th>
            <th>Actie</th>
          </tr>
        </thead>
        <tbody>
          {verouderdeProducten.map(data => (
            <tr key={data.key}>
              <td>{data.productNaam}</td>
              <td>{data.winkelNaam}</td>
              <td>{data.laatsteDatum.toLocaleDateString()}</td>
              <td>Update mij!</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default VerouderdePrijzen;