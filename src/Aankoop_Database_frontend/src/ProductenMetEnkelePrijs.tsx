// src/ProductenMetEnkelePrijs.tsx
import React, { useMemo } from 'react';
import { Aankoop, Product, Winkel } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';

type AankoopExtended = [Aankoop, string, string];

interface Props {
  aankopen: AankoopExtended[];
  products: Product[];
  winkels: Winkel[];
  selectedStoreIds: Set<bigint>;
}

const ProductenMetEnkelePrijs: React.FC<Props> = ({ aankopen, products, winkels, selectedStoreIds }) => {
  const productenData = useMemo(() => {
    const filteredAankopen = selectedStoreIds.size > 0
      ? aankopen.filter(([a]) => selectedStoreIds.has(a.winkelId))
      : aankopen;

    const aankopenPerProduct = new Map<bigint, Aankoop[]>();

    filteredAankopen.forEach(([aankoop]) => {
      if (!aankopenPerProduct.has(aankoop.productId)) {
        aankopenPerProduct.set(aankoop.productId, []);
      }
      aankopenPerProduct.get(aankoop.productId)?.push(aankoop);
    });

    const result: any[] = [];
    aankopenPerProduct.forEach((aankopenLijst, productId) => {
      // We tellen het aantal unieke winkels voor dit product
      const uniekeWinkelIds = new Set(aankopenLijst.map(a => a.winkelId));
      if (uniekeWinkelIds.size === 1) {
        const laatsteAankoop = aankopenLijst.sort((a,b) => Number(b.datum) - Number(a.datum))[0];
        const product = products.find(p => p.id === productId);
        const winkel = winkels.find(w => w.id === laatsteAankoop.winkelId);

        if (product && winkel) {
          result.push({
            key: `${productId}-${winkel.id}`,
            productNaam: `${product.naam} (${product.merk})`,
            winkelNaam: `${winkel.naam} (${winkel.keten})`,
            land: Object.keys(winkel.land)[0],
          });
        }
      }
    });

    // Sorteer op productnaam
    return result.sort((a, b) => a.productNaam.localeCompare(b.productNaam));

  }, [aankopen, products, winkels, selectedStoreIds]);

  if (productenData.length === 0) {
    return <p>Alle producten hebben al een prijsvergelijking. Goed bezig!</p>;
  }

  return (
    <div className="table-container-widget">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Winkel</th>
            <th>Land</th>
          </tr>
        </thead>
        <tbody>
          {productenData.map(data => (
            <tr key={data.key}>
              <td>{data.productNaam}</td>
              <td>{data.winkelNaam}</td>
              <td>{data.land}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductenMetEnkelePrijs;