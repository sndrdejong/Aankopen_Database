import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Aankoop_Database_backend as backend } from 'declarations/Aankoop_Database_backend';
import { Aankoop, BestePrijsInfo, Eenheid, Land, Product, Winkel, AllBestPricesResult } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';
import './App.css';
import DashboardStats from './DashboardStats';

// Helper component for collapsible sections
const CollapsibleSection = ({ title, children, startOpen = false }: { title: string, children: React.ReactNode, startOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(startOpen);
  return (
    <section className="collapsible-section">
      <button onClick={() => setIsOpen(!isOpen)} className="collapsible-header">
        <span className="collapsible-icon">{isOpen ? '➖' : '➕'}</span>
        {title}
      </button>
      {isOpen && <div className="collapsible-content">{children}</div>}
    </section>
  );
};

// Type definition for the extended purchase object, which includes product and store names
type AankoopExtended = [Aankoop, string, string];

// New type to store best prices per country for a single product ID
type BestPriceByCountry = {
  NL?: BestePrijsInfo;
  ES?: BestePrijsInfo;
};

// Define possible Eenheid options for the dropdown menu
const eenheidOptions = [
  'STUK', 'METER', 'KILOGRAM', 'GRAM', 'LITER', 'MILLILITER', 'ROL', 'TABLET'
] as const;

// Icon mapping for units
const eenheidIcons: Record<typeof eenheidOptions[number], string> = {
  STUK: '📦',
  METER: '📏',
  KILOGRAM: '⚖️',
  GRAM: '⚖️',
  LITER: '💧',
  MILLILITER: '💧',
  ROL: '🧻',
  TABLET: '🧼',
};

// Helper function to format units with an optional icon
const formatEenheid = (eenheid?: object, withIcon = true): string => {
  if (!eenheid) return '';
  const key = Object.keys(eenheid)[0] as typeof eenheidOptions[number];
  if (!key) return '';

  const icon = withIcon ? `${eenheidIcons[key] || ''} ` : '';
  let text = '';

  switch (key) {
    case 'STUK': text = 'per stuk'; break;
    case 'KILOGRAM': text = 'per kg'; break;
    case 'GRAM': text = 'per gram'; break;
    case 'LITER': text = 'per liter'; break;
    case 'MILLILITER': text = 'per ml'; break;
    case 'ROL': text = 'per rol'; break;
    case 'TABLET': text = 'per tablet'; break;
    case 'METER': text = 'per meter'; break;
    default: text = '';
  }

  return `${icon}${text}`;
};

// Standalone component for the price finder table
const PriceFinderTable = ({
  countryCode,
  products,
  bestPrices,
  selectedProducts,
  onSelectionChange,
  winkels,
  selectedStoreIds,
  searchTerm,
  setSearchTerm
}: {
  countryCode: 'NL' | 'ES',
  products: Product[],
  bestPrices: Map<bigint, BestPriceByCountry>,
  selectedProducts: Set<string>,
  onSelectionChange: (productId: bigint, countryCode: 'NL' | 'ES') => void,
  winkels: Winkel[],
  selectedStoreIds: Set<bigint>,
  searchTerm: string,
  setSearchTerm: (value: string) => void
}) => {

  const displayableProducts = useMemo(() => {
    return products
      .filter(p => {
        const bestPriceInCountry = bestPrices.get(p.id)?.[countryCode];
        if (!bestPriceInCountry) {
          return false;
        }

        const winkelOfBestPrice = winkels.find(w => w.naam === bestPriceInCountry.winkelNaam && Object.keys(w.land)[0] === countryCode);
        const isStoreVisible = selectedStoreIds.size === 0 || (winkelOfBestPrice && selectedStoreIds.has(winkelOfBestPrice.id));

        return isStoreVisible;
      })
      .sort((a, b) => a.naam.localeCompare(b.naam));
  }, [products, bestPrices, countryCode, winkels, selectedStoreIds]);

  // Enhanced search logic: searches across all visible columns
  const finalFilteredProducts = useMemo(() => {
    const lowerCaseSearchTerms = searchTerm.toLowerCase().split(' ').filter(Boolean);
    if (lowerCaseSearchTerms.length === 0) return displayableProducts;

    return displayableProducts.filter(p => {
      const bestPriceInCountry = bestPrices.get(p.id)?.[countryCode];
      if (!bestPriceInCountry) return false;

      const searchableText = [
        p.naam,
        p.merk,
        bestPriceInCountry.winkelNaam,
        `€${bestPriceInCountry.eenheidsprijs.toFixed(2)}`,
        formatEenheid(bestPriceInCountry.eenheid, false) // Also search on unit text
      ].join(' ').toLowerCase();

      return lowerCaseSearchTerms.every(term => searchableText.includes(term));
    });
  }, [displayableProducts, searchTerm, bestPrices, countryCode]);

  const formatAndConvertPrice = (priceInfo: BestePrijsInfo): string => {
    const unitKey = Object.keys(priceInfo.eenheid)[0];
    const originalPrice = priceInfo.eenheidsprijs;

    if (unitKey === 'GRAM') {
      const pricePerKg = originalPrice * 1000;
      return `${eenheidIcons['GRAM']} €${pricePerKg.toFixed(2)} per kg`;
    }

    if (unitKey === 'MILLILITER') {
      const pricePerLiter = originalPrice * 1000;
      return `${eenheidIcons['MILLILITER']} €${pricePerLiter.toFixed(2)} per liter`;
    }

    return `€${originalPrice.toFixed(2)} ${formatEenheid(priceInfo.eenheid)}`;
  };

  return (
    <div className="table-container">
      <div className="filter-controls">
        <input
          type="text"
          placeholder="Zoek op product, merk, winkel of prijs..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <button onClick={() => setSearchTerm('')} className="button-secondary">Reset</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>✓</th>
            <th>Product</th>
            <th>Merk</th>
            <th>Winkel</th>
            <th>Prijs</th>
          </tr>
        </thead>
        <tbody>
          {finalFilteredProducts.map(p => {
            const bestPriceInCountry = bestPrices.get(p.id)?.[countryCode];
            const selectionId = `${p.id}-${countryCode}`;
            const isSelected = selectedProducts.has(selectionId);

            if (!bestPriceInCountry) return null; // Should not happen due to filter

            return (
              <tr key={Number(p.id)} className={isSelected ? 'selected-row' : ''}>
                <td data-label="Selecteer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSelectionChange(p.id, countryCode)}
                    className="selection-checkbox"
                  />
                </td>
                <td data-label="Product">{p.naam}</td>
                <td data-label="Merk">{p.merk}</td>
                <td data-label="Winkel">{bestPriceInCountry.winkelNaam}</td>
                <td data-label="Prijs">{formatAndConvertPrice(bestPriceInCountry)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {finalFilteredProducts.length === 0 && (
        <p style={{ textAlign: 'center', padding: '1rem' }}>
          Geen producten gevonden die voldoen aan de zoekopdracht of de geselecteerde filters.
        </p>
      )}
    </div>
  );
};


function App() {
  const [winkels, setWinkels] = useState<Winkel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [aankopen, setAankopen] = useState<AankoopExtended[]>([]);
  const [bestPrices, setBestPrices] = useState<Map<bigint, BestPriceByCountry>>(new Map());

  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<bigint | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<bigint | null>(null);

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  const [winkelSearchTerm, setWinkelSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [aankoopSearchTerm, setAankoopSearchTerm] = useState('');
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<bigint>>(new Set());
  const [storeFilterSearchTerm, setStoreFilterSearchTerm] = useState('');
  const [priceFinderNlSearch, setPriceFinderNlSearch] = useState('');
  const [priceFinderEsSearch, setPriceFinderEsSearch] = useState('');

  const [formWinkel, setFormWinkel] = useState({ naam: '', keten: '', land: { NL: null } as Land });
  const [formProduct, setFormProduct] = useState({ naam: '', merk: '', standaardEenheid: { STUK: null } as Eenheid });
  const [formAankoop, setFormAankoop] = useState({ productId: '', winkelId: '', bonOmschrijving: '', prijs: '', hoeveelheid: '' });

  const [productSearch, setProductSearch] = useState('');
  const [winkelSearch, setWinkelSearch] = useState('');

  const [suggestedFields, setSuggestedFields] = useState<Set<string>>(new Set());

  const [editingWinkelId, setEditingWinkelId] = useState<bigint | null>(null);
  const [editingWinkelData, setEditingWinkelData] = useState<Omit<Winkel, 'id'>>({ naam: '', keten: '', land: { NL: null } });

  const [editingProductId, setEditingProductId] = useState<bigint | null>(null);
  const [editingProductData, setEditingProductData] = useState<Omit<Product, 'id' | 'trefwoorden'> & { trefwoorden: string }>({ naam: '', merk: '', trefwoorden: '', standaardEenheid: { STUK: null } });

  const [productWarning, setProductWarning] = useState<string>('');

  const fetchBestPrices = async () => {
    setIsLoadingPrices(true);
    try {
      const results: AllBestPricesResult[] = await backend.findAllBestPrices();
      const newBestPrices = new Map<bigint, BestPriceByCountry>();
      for (const item of results) {
        const entry: BestPriceByCountry = {};
        if (item.nl.length > 0) entry.NL = item.nl[0];
        if (item.es.length > 0) entry.ES = item.es[0];
        newBestPrices.set(item.productId, entry);
      }
      setBestPrices(newBestPrices);
    } catch (error) {
      console.error("Error fetching best prices:", error);
      alert("Something went wrong while calculating prices.");
    } finally {
      setIsLoadingPrices(false);
    }
  };

  const fetchAllData = useCallback(async () => {
    try {
      setWinkels(await backend.getWinkels());
      setProducts(await backend.getProducts());
      setAankopen(await backend.getAankopen());
      await fetchBestPrices();
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const sortWinkels = (a: Winkel, b: Winkel) => {
    const landA = Object.keys(a.land)[0];
    const landB = Object.keys(b.land)[0];
    if (landA < landB) return -1;
    if (landA > landB) return 1;
    return a.naam.localeCompare(b.naam);
  };

  useEffect(() => {
    const checkProductExistence = () => {
      const cleanNaam = formProduct.naam.trim().toLowerCase();
      if (!cleanNaam) {
        setProductWarning('');
        return;
      }
      for (const p of products) {
        const existingName = p.naam.trim().toLowerCase();
        if ((existingName.includes(cleanNaam) || cleanNaam.includes(existingName)) && existingName !== cleanNaam) {
          setProductWarning(`⚠️ This product is similar to "${p.naam}". Check existing products before adding.`);
          return;
        }
      }
      setProductWarning('');
    };
    checkProductExistence();
  }, [formProduct.naam, products]);

  useEffect(() => {
    const findLastPurchase = () => {
      const { productId, winkelId } = formAankoop;
      if (productId && winkelId) {
        const matchingPurchases = aankopen
          .map(a => a[0])
          .filter(a => String(a.productId) === productId && String(a.winkelId) === winkelId)
          .sort((a, b) => Number(b.datum) - Number(a.datum));

        if (matchingPurchases.length > 0) {
          const lastPurchase = matchingPurchases[0];
          setFormAankoop(prev => ({
            ...prev,
            bonOmschrijving: lastPurchase.bonOmschrijving,
            prijs: String(lastPurchase.prijs),
            hoeveelheid: String(lastPurchase.hoeveelheid),
          }));
          setSuggestedFields(new Set(['bonOmschrijving', 'prijs', 'hoeveelheid']));
        } else {
          setSuggestedFields(new Set());
        }
      }
    };
    findLastPurchase();
  }, [formAankoop.productId, formAankoop.winkelId, aankopen]);

  const handleAddWinkel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await backend.addWinkel(formWinkel.naam, formWinkel.keten, formWinkel.land);
      alert("Winkel toegevoegd!");
      setFormWinkel({ naam: '', keten: '', land: { NL: null } as Land });
      fetchAllData();
    } catch (error) {
      alert("Fout bij toevoegen winkel.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWinkel = async (id: bigint) => {
    if (window.confirm("Weet je zeker dat je deze winkel wilt verwijderen?")) {
      setDeletingItemId(id);
      try {
        const result = await backend.deleteWinkel(id);
        if ('ok' in result) {
          alert("Winkel verwijderd.");
          fetchAllData();
        } else {
          alert(`Fout: ${result.err}`);
        }
      } catch (error) {
        alert("Fout bij verwijderen winkel.");
        console.error(error);
      } finally {
        setDeletingItemId(null);
      }
    }
  };

  const handleUpdateWinkel = async (id: bigint) => {
    const { naam, keten, land } = editingWinkelData;
    setUpdatingItemId(id);
    try {
      await backend.updateWinkel(id, naam, keten, land);
      alert("Winkel bijgewerkt.");
      setEditingWinkelId(null);
      fetchAllData();
    } catch (error) {
      alert("Fout bij bijwerken winkel.");
      console.error(error);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const startEditingWinkel = (winkel: Winkel) => {
    setEditingWinkelId(winkel.id);
    setEditingWinkelData({ naam: winkel.naam, keten: winkel.keten, land: winkel.land });
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNaam = formProduct.naam.trim().toLowerCase();
    const finalMerk = formProduct.merk.trim() === '' ? 'n.v.t.' : formProduct.merk;
    const cleanMerk = finalMerk.toLowerCase();

    if (products.some(p => p.naam.trim().toLowerCase() === cleanNaam && p.merk.trim().toLowerCase() === cleanMerk)) {
      if (!window.confirm("Dit product met dit merk bestaat al. Toch toevoegen?")) return;
    }

    setIsSubmitting(true);
    try {
      await backend.addProduct(formProduct.naam, finalMerk, ['n.v.t.'], formProduct.standaardEenheid);
      alert("Product toegevoegd!");
      setFormProduct({ naam: '', merk: '', standaardEenheid: { STUK: null } as Eenheid });
      fetchAllData();
    } catch (error) {
      alert("Fout bij toevoegen product.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: bigint) => {
    if (window.confirm("Weet je zeker dat je dit product wilt verwijderen?")) {
      setDeletingItemId(id);
      try {
        const result = await backend.deleteProduct(id);
        if ('ok' in result) {
          alert("Product verwijderd.");
          fetchAllData();
        } else {
          alert(`Fout: ${result.err}`);
        }
      } catch (error) {
        alert("Fout bij verwijderen product.");
        console.error(error);
      } finally {
        setDeletingItemId(null);
      }
    }
  };

  const handleUpdateProduct = async (id: bigint) => {
    if (aankopen.filter(([a]) => a.productId === id).length > 2) {
      alert("Product kan niet gewijzigd worden met meer dan 2 aankopen.");
      return;
    }
    const { naam, merk, trefwoorden, standaardEenheid } = editingProductData;
    const finalMerk = merk.trim() === '' ? 'n.v.t.' : merk;
    if (products.some(p => p.id !== id && p.naam.trim().toLowerCase() === naam.trim().toLowerCase() && p.merk.trim().toLowerCase() === finalMerk.trim().toLowerCase())) {
      if (!window.confirm("Dit product lijkt al te bestaan. Toch bijwerken?")) return;
    }
    setUpdatingItemId(id);
    try {
      const trefwoordenArray = trefwoorden.split(',').map(t => t.trim()).filter(Boolean);
      await backend.updateProduct(id, naam, finalMerk, trefwoordenArray, standaardEenheid);
      alert("Product bijgewerkt.");
      setEditingProductId(null);
      fetchAllData();
    } catch (error) {
      alert("Fout bij bijwerken product.");
      console.error(error);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const startEditingProduct = (product: Product) => {
    setEditingProductId(product.id);
    setEditingProductData({
      naam: product.naam,
      merk: product.merk,
      trefwoorden: product.trefwoorden.join(', '),
      standaardEenheid: product.standaardEenheid
    });
  };

  const handleAddAankoop = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { productId, winkelId, bonOmschrijving, prijs, hoeveelheid } = formAankoop;
      await backend.addAankoop(BigInt(productId), BigInt(winkelId), bonOmschrijving, parseFloat(prijs), parseFloat(hoeveelheid));
      alert("Aankoop toegevoegd!");
      setFormAankoop({ productId: '', winkelId: '', bonOmschrijving: '', prijs: '', hoeveelheid: '' });
      setProductSearch('');
      setWinkelSearch('');
      setSuggestedFields(new Set());
      await fetchAllData();
    } catch (error) {
      alert("Fout bij toevoegen aankoop.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAankoop = async (id: bigint) => {
    const aankoopToDelete = aankopen.find(([a]) => a.id === id)?.[0];
    if (aankoopToDelete) {
      const isOlderThan5Minutes = (Date.now() * 1_000_000 - Number(aankoopToDelete.datum)) > 300_000_000_000;
      if (isOlderThan5Minutes) {
        alert("Aankoop kan niet verwijderd worden na 5 minuten.");
        return;
      }
    }
    if (window.confirm("Weet je zeker dat je deze aankoop wilt verwijderen?")) {
      setDeletingItemId(id);
      try {
        await backend.deleteAankoop(id);
        await fetchAllData();
      } catch (error) {
        alert("Fout bij verwijderen aankoop.");
        console.error(error);
      } finally {
        setDeletingItemId(null);
      }
    }
  };

  const handleFindAllBestPrices = async () => {
    await fetchBestPrices();
    alert("Beste prijzen zijn opnieuw berekend!");
  };

  const handleSelectionChange = (productId: bigint, countryCode: 'NL' | 'ES') => {
    const selectionId = `${productId}-${countryCode}`;
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(selectionId)) {
      newSelection.delete(selectionId);
    } else {
      newSelection.add(selectionId);
    }
    setSelectedProducts(newSelection);
  };

  const handleExportSelection = () => {
    if (selectedProducts.size === 0) {
      alert("Selecteer eerst producten om te exporteren.");
      return;
    }
    const selectionData: { product: Product, priceInfo?: BestePrijsInfo, country: string }[] = [];
    selectedProducts.forEach(selectionId => {
      const [idStr, country] = selectionId.split('-');
      const product = products.find(p => p.id === BigInt(idStr));
      if (product) {
        const priceEntry = bestPrices.get(product.id);
        const priceInfo = country === 'NL' ? priceEntry?.NL : priceEntry?.ES;
        selectionData.push({ product, priceInfo, country });
      }
    });

    const sortedSelection = selectionData.sort((a, b) => {
      const winkelA = a.priceInfo?.winkelNaam ?? 'ZZZ';
      const winkelB = b.priceInfo?.winkelNaam ?? 'ZZZ';
      if (winkelA !== winkelB) return winkelA.localeCompare(winkelB);
      return a.product.naam.localeCompare(b.product.naam);
    });

    let exportText = "🛒 Mijn Boodschappenlijstje\n";
    let currentWinkel = "";
    sortedSelection.forEach(({ product, priceInfo }) => {
      const winkelNaam = priceInfo?.winkelNaam;
      if (winkelNaam && winkelNaam !== currentWinkel) {
        currentWinkel = winkelNaam;
        exportText += `\n--- ${currentWinkel} ---\n`;
      }
      const priceString = priceInfo ? `€${priceInfo.eenheidsprijs.toFixed(2)} ${formatEenheid(priceInfo.eenheid)}` : '';
      exportText += `- ${product.naam} (${product.merk}) ${priceString}\n`;
    });

    navigator.clipboard.writeText(exportText).then(() => {
      alert("Boodschappenlijst gekopieerd naar klembord!");
    }).catch(err => {
      alert("Kopiëren mislukt.");
      console.error(err);
    });
  };

  // Enhanced search logic for stores
  const filteredWinkels = useMemo(() => {
    const lowerCaseSearchTerms = winkelSearchTerm.toLowerCase().split(' ').filter(Boolean);
    if (lowerCaseSearchTerms.length === 0) return winkels;
    return winkels.filter(w => {
      const searchableText = [w.naam, w.keten, Object.keys(w.land)[0]].join(' ').toLowerCase();
      return lowerCaseSearchTerms.every(term => searchableText.includes(term));
    });
  }, [winkels, winkelSearchTerm]);

  // Enhanced search logic for store selection filter
  const filteredStoreSelection = useMemo(() => {
    const lowerCaseSearchTerms = storeFilterSearchTerm.toLowerCase().split(' ').filter(Boolean);
    if (lowerCaseSearchTerms.length === 0) return winkels;
    return winkels.filter(w => {
      const searchableText = [w.naam, w.keten, Object.keys(w.land)[0]].join(' ').toLowerCase();
      return lowerCaseSearchTerms.every(term => searchableText.includes(term));
    });
  }, [winkels, storeFilterSearchTerm]);

  // Enhanced search logic for products
  const filteredProducts = useMemo(() => {
    const lowerCaseSearchTerms = productSearchTerm.toLowerCase().split(' ').filter(Boolean);
    if (lowerCaseSearchTerms.length === 0) return products;
    return products.filter(p => {
      const searchableText = [p.naam, p.merk, formatEenheid(p.standaardEenheid, false)].join(' ').toLowerCase();
      return lowerCaseSearchTerms.every(term => searchableText.includes(term));
    });
  }, [products, productSearchTerm]);

  const filteredAankopenByStore = useMemo(() => {
    if (selectedStoreIds.size === 0) return aankopen;
    return aankopen.filter(([aankoop]) => selectedStoreIds.has(aankoop.winkelId));
  }, [aankopen, selectedStoreIds]);

  // Enhanced search logic for purchase history
  const searchedAankopen = useMemo(() => {
    const lowerCaseSearchTerms = aankoopSearchTerm.toLowerCase().split(' ').filter(Boolean);
    if (lowerCaseSearchTerms.length === 0) return filteredAankopenByStore;

    return filteredAankopenByStore.filter(([aankoop, prodNaam, winkelNaam]) => {
      const winkel = winkels.find(w => w.id === aankoop.winkelId);
      const product = products.find(p => p.id === aankoop.productId);

      const searchableText = [
        prodNaam,
        winkelNaam,
        winkel ? Object.keys(winkel.land)[0] : '',
        `€${aankoop.prijs.toFixed(2)}`,
        String(aankoop.hoeveelheid),
        product ? formatEenheid(product.standaardEenheid, false) : '',
        new Date(Number(aankoop.datum) / 1_000_000).toLocaleString()
      ].join(' ').toLowerCase();

      return lowerCaseSearchTerms.every(term => searchableText.includes(term));
    });
  }, [filteredAankopenByStore, aankoopSearchTerm, winkels, products]);

  const filteredWinkelsForPurchaseForm = useMemo(() => {
    if (selectedStoreIds.size === 0) return winkels;
    return winkels.filter(w => selectedStoreIds.has(w.id));
  }, [winkels, selectedStoreIds]);

  const selectedProductForAankoop = formAankoop.productId ? products.find(p => p.id === BigInt(formAankoop.productId)) : null;

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🛒 Boodschappen Tracker</h1>
      </header>

      <DashboardStats
        aankopenCount={aankopen.length}
        productsCount={products.length}
        winkelsCount={winkels.length}
        bestPrices={bestPrices}
      />

      <main>
        <CollapsibleSection title="Beheer: Selecteer Winkels" startOpen={true}>
          <div className="button-group" style={{ marginBottom: '1rem' }}>
            <button onClick={() => setSelectedStoreIds(new Set(winkels.map(w => w.id)))} className="button-secondary">Selecteer Alles</button>
            <button onClick={() => setSelectedStoreIds(new Set())} className="button-secondary">Deselecteer Alles</button>
          </div>
          <div className="filter-controls">
            <input
              type="text"
              placeholder="Zoek winkel op naam, plaats of land..."
              value={storeFilterSearchTerm}
              onChange={e => setStoreFilterSearchTerm(e.target.value)}
            />
            <button onClick={() => setStoreFilterSearchTerm('')} className="button-secondary">Reset</button>
          </div>
          <div className="checkbox-grid">
            {filteredStoreSelection.slice().sort(sortWinkels).map(winkel => (
              <div key={Number(winkel.id)} className="checkbox-item">
                <input
                  type="checkbox"
                  id={`store-filter-${winkel.id}`}
                  checked={selectedStoreIds.has(winkel.id)}
                  onChange={e => {
                    const newSelection = new Set(selectedStoreIds);
                    if (e.target.checked) newSelection.add(winkel.id);
                    else newSelection.delete(winkel.id);
                    setSelectedStoreIds(newSelection);
                  }}
                />
                <label htmlFor={`store-filter-${winkel.id}`}>
                  {`${Object.keys(winkel.land)[0]} - ${winkel.naam} (${winkel.keten})`}
                </label>
              </div>
            ))}
          </div>
          {selectedStoreIds.size > 0 && <p className="filter-info">{selectedStoreIds.size} van de {winkels.length} winkels geselecteerd.</p>}
        </CollapsibleSection>

        <CollapsibleSection title="Beheer: Winkels">
          <form onSubmit={handleAddWinkel} className="form-grid">
            <input type="text" placeholder="Naam winkel" value={formWinkel.naam} onChange={e => setFormWinkel({ ...formWinkel, naam: e.target.value })} required />
            <input type="text" placeholder="Plaatsnaam" value={formWinkel.keten} onChange={e => setFormWinkel({ ...formWinkel, keten: e.target.value })} required />
            <select value={Object.keys(formWinkel.land)[0]} onChange={e => setFormWinkel({ ...formWinkel, land: { [e.target.value]: null } as Land })} required>
              <option value="NL">Nederland</option>
              <option value="ES">Spanje</option>
            </select>
            <button type="submit" className="button-primary" disabled={isSubmitting}>{isSubmitting ? 'Bezig...' : 'Voeg Winkel Toe'}</button>
          </form>

          <CollapsibleSection title="Bekijk Bestaande Winkels">
            <div className="filter-controls">
              <input type="text" placeholder="Zoek op naam, plaats of land..." value={winkelSearchTerm} onChange={e => setWinkelSearchTerm(e.target.value)} />
              <button onClick={() => setWinkelSearchTerm('')} className="button-secondary">Reset</button>
            </div>
            <div className="table-container">
              <table>
                <thead><tr><th>Land</th><th>Naam</th><th>Keten</th><th>Acties</th></tr></thead>
                <tbody>
                  {filteredWinkels.slice().sort(sortWinkels).map(w => (
                    <tr key={Number(w.id)}>
                      {editingWinkelId === w.id ? (
                        <>
                          <td data-label="Land"><select value={Object.keys(editingWinkelData.land)[0]} onChange={e => setEditingWinkelData({ ...editingWinkelData, land: { [e.target.value]: null } as Land })}><option value="NL">NL</option><option value="ES">ES</option></select></td>
                          <td data-label="Naam"><input type="text" value={editingWinkelData.naam} onChange={e => setEditingWinkelData({ ...editingWinkelData, naam: e.target.value })} /></td>
                          <td data-label="Keten"><input type="text" value={editingWinkelData.keten} onChange={e => setEditingWinkelData({ ...editingWinkelData, keten: e.target.value })} /></td>
                          <td data-label="Acties" className="action-buttons">
                            <button onClick={() => handleUpdateWinkel(w.id)} className="button-success" disabled={updatingItemId === w.id}>{updatingItemId === w.id ? 'Opslaan...' : 'Opslaan'}</button>
                            <button onClick={() => setEditingWinkelId(null)} className="button-secondary">Annuleren</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td data-label="Land">{Object.keys(w.land)[0]}</td>
                          <td data-label="Naam">{w.naam}</td>
                          <td data-label="Keten">{w.keten}</td>
                          <td data-label="Acties" className="action-buttons">
                            <button onClick={() => startEditingWinkel(w)} className="button-secondary">Wijzig</button>
                            <button onClick={() => handleDeleteWinkel(w.id)} className="button-danger" disabled={deletingItemId === w.id}>{deletingItemId === w.id ? '...' : 'Verwijder'}</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        </CollapsibleSection>

        <CollapsibleSection title="Beheer: Producten">
          <form onSubmit={handleAddProduct} className="form-grid">
            <input type="text" placeholder="Naam product" value={formProduct.naam} onChange={e => setFormProduct({ ...formProduct, naam: e.target.value })} required />
            <input type="text" placeholder="Merk (optioneel)" value={formProduct.merk} onChange={e => setFormProduct({ ...formProduct, merk: e.target.value })} />
            <select value={Object.keys(formProduct.standaardEenheid)[0]} onChange={e => setFormProduct({ ...formProduct, standaardEenheid: { [e.target.value as typeof eenheidOptions[number]]: null } as Eenheid })} required>
              {[...eenheidOptions].sort().map(key => (<option key={key} value={key}>{`${eenheidIcons[key]} ${key.charAt(0) + key.slice(1).toLowerCase()}`}</option>))}
            </select>
            {productWarning && (<p className="warning">{productWarning}</p>)}
            <div className="product-preview">
              <h4>Preview:</h4>
              <p><strong>Naam:</strong> {formProduct.naam || '—'}</p>
              <p><strong>Merk:</strong> {formProduct.merk || 'n.v.t.'}</p>
              <p><strong>Eenheid:</strong> {formatEenheid(formProduct.standaardEenheid)}</p>
            </div>
            <button type="submit" className="button-primary" disabled={isSubmitting}>{isSubmitting ? 'Bezig...' : 'Voeg Product Toe'}</button>
          </form>

          <CollapsibleSection title="Bekijk Bestaande Producten">
            <div className="filter-controls">
              <input type="text" placeholder="Zoek op naam, merk of eenheid..." value={productSearchTerm} onChange={e => setProductSearchTerm(e.target.value)} />
              <button onClick={() => setProductSearchTerm('')} className="button-secondary">Reset</button>
            </div>
            <div className="table-container">
              <table>
                <thead><tr><th>Naam</th><th>Merk</th><th>Eenheid</th><th>Acties</th></tr></thead>
                <tbody>
                  {filteredProducts.slice().sort((a, b) => a.naam.localeCompare(b.naam)).map(p => {
                    const purchaseCount = aankopen.filter(([a]) => a.productId === p.id).length;
                    return (
                      <tr key={Number(p.id)}>
                        {editingProductId === p.id ? (
                          <>
                            <td data-label="Naam"><input type="text" value={editingProductData.naam} onChange={e => setEditingProductData({ ...editingProductData, naam: e.target.value })} /></td>
                            <td data-label="Merk"><input type="text" placeholder="Merk (optioneel)" value={editingProductData.merk} onChange={e => setEditingProductData({ ...editingProductData, merk: e.target.value })} /></td>
                            <td data-label="Eenheid">{formatEenheid(editingProductData.standaardEenheid).replace('per ', '')}</td>
                            <td data-label="Acties" className="action-buttons">
                              <button onClick={() => handleUpdateProduct(p.id)} className="button-success" disabled={updatingItemId === p.id}>{updatingItemId === p.id ? 'Opslaan...' : 'Opslaan'}</button>
                              <button onClick={() => setEditingProductId(null)} className="button-secondary">Annuleren</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td data-label="Naam">{p.naam}</td>
                            <td data-label="Merk">{p.merk}</td>
                            <td data-label="Eenheid">{formatEenheid(p.standaardEenheid).replace('per ', '')}</td>
                            <td data-label="Acties" className="action-buttons">
                              <button onClick={() => startEditingProduct(p)} className="button-secondary" disabled={purchaseCount > 2} title={purchaseCount > 2 ? "Kan niet wijzigen met >2 aankopen" : ""}>Wijzig</button>
                              <button onClick={() => handleDeleteProduct(p.id)} className="button-danger" disabled={deletingItemId === p.id}>{deletingItemId === p.id ? '...' : 'Verwijder'}</button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        </CollapsibleSection>

        <CollapsibleSection title="Nieuwe Aankoop Toevoegen">
          <form onSubmit={handleAddAankoop} className="form-grid">
            <div className="form-field">
              <label htmlFor="product-select">Product:</label>
              <input id="product-select" list="product-options" value={productSearch} onChange={e => {
                const value = e.target.value;
                setProductSearch(value);
                const selectedProd = products.find(p => `${p.naam} (${p.merk})` === value);
                setSuggestedFields(new Set());
                setFormAankoop(prev => ({ ...prev, productId: selectedProd ? String(selectedProd.id) : '', bonOmschrijving: '', prijs: '', hoeveelheid: '' }));
              }} placeholder="-- Selecteer Product --" required />
            </div>
            <datalist id="product-options">
              {products.slice().sort((a, b) => a.naam.localeCompare(b.naam)).map(p => <option key={Number(p.id)} value={`${p.naam} (${p.merk})`} />)}
            </datalist>
            <div className="form-field">
              <label htmlFor="winkel-select">Winkel:</label>
              <input id="winkel-select" list="winkel-options" value={winkelSearch} onChange={e => {
                const value = e.target.value;
                setWinkelSearch(value);
                const selectedWinkel = filteredWinkelsForPurchaseForm.find(w => `${Object.keys(w.land)[0]} - ${w.naam} (${w.keten})` === value);
                setSuggestedFields(new Set());
                setFormAankoop(prev => ({ ...prev, winkelId: selectedWinkel ? String(selectedWinkel.id) : '', bonOmschrijving: '', prijs: '', hoeveelheid: '' }));
              }} placeholder="-- Selecteer Winkel --" required />
            </div>
            <datalist id="winkel-options">
              {filteredWinkelsForPurchaseForm.slice().sort(sortWinkels).map(w => <option key={Number(w.id)} value={`${Object.keys(w.land)[0]} - ${w.naam} (${w.keten})`} />)}
            </datalist>
            <div className="form-field">
              <label htmlFor="bon-omschrijving">Bon omschrijving:</label>
              <input id="bon-omschrijving" type="text" placeholder="Bon omschrijving" value={formAankoop.bonOmschrijving} onChange={e => setFormAankoop({ ...formAankoop, bonOmschrijving: e.target.value })} required className={suggestedFields.has('bonOmschrijving') ? 'suggested-input' : ''} onInput={() => suggestedFields.delete('bonOmschrijving') && setSuggestedFields(new Set(suggestedFields))} />
            </div>
            <div className="form-field">
              <label htmlFor="prijs">Prijs (€):</label>
              <input id="prijs" type="number" step="0.01" placeholder="Prijs (€)" value={formAankoop.prijs} onChange={e => setFormAankoop({ ...formAankoop, prijs: e.target.value })} required className={suggestedFields.has('prijs') ? 'suggested-input' : ''} onInput={() => suggestedFields.delete('prijs') && setSuggestedFields(new Set(suggestedFields))} />
            </div>
            <div className="form-field">
              <label htmlFor="hoeveelheid">Hoeveelheid:</label>
              <div className="hoeveelheid-input">
                <input id="hoeveelheid" type="number" step="0.001" placeholder="Hoeveelheid" value={formAankoop.hoeveelheid} onChange={e => setFormAankoop({ ...formAankoop, hoeveelheid: e.target.value })} required className={suggestedFields.has('hoeveelheid') ? 'suggested-input' : ''} onInput={() => suggestedFields.delete('hoeveelheid') && setSuggestedFields(new Set(suggestedFields))} />
                <span>{selectedProductForAankoop ? formatEenheid(selectedProductForAankoop.standaardEenheid).replace('per ', '') : '...'}</span>
              </div>
            </div>
            <div className="form-field"><button type="submit" className="button-primary full-width" disabled={isSubmitting}>{isSubmitting ? 'Bezig...' : 'Voeg Aankoop Toe'}</button></div>
          </form>
        </CollapsibleSection>

        <section className="card">
          <h2>Beste Prijs Vinder</h2>
          <div className="button-group">
            <button onClick={handleFindAllBestPrices} disabled={isLoadingPrices} className="button-primary">{isLoadingPrices ? 'Berekenen...' : 'Ververs Prijzen'}</button>
            {selectedProducts.size > 0 && (
              <>
                <button onClick={handleExportSelection} className="button-success">Exporteer Lijst ({selectedProducts.size})</button>
                <button onClick={() => setSelectedProducts(new Set())} className="button-danger">Reset Selectie</button>
              </>
            )}
          </div>

          <CollapsibleSection title="Nederland" startOpen={true}>
            <PriceFinderTable countryCode="NL" products={products} bestPrices={bestPrices} selectedProducts={selectedProducts} onSelectionChange={handleSelectionChange} winkels={winkels} selectedStoreIds={selectedStoreIds} searchTerm={priceFinderNlSearch} setSearchTerm={setPriceFinderNlSearch} />
          </CollapsibleSection>
          <CollapsibleSection title="Spanje">
            <PriceFinderTable countryCode="ES" products={products} bestPrices={bestPrices} selectedProducts={selectedProducts} onSelectionChange={handleSelectionChange} winkels={winkels} selectedStoreIds={selectedStoreIds} searchTerm={priceFinderEsSearch} setSearchTerm={setPriceFinderEsSearch} />
          </CollapsibleSection>
        </section>

        <CollapsibleSection title="Aankopen Historie">
          <div className="filter-controls">
            <input type="text" placeholder="Zoek op alle kolommen..." value={aankoopSearchTerm} onChange={e => setAankoopSearchTerm(e.target.value)} />
            <button onClick={() => setAankoopSearchTerm('')} className="button-secondary">Reset</button>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Product</th><th>Winkel</th><th>Land</th><th>Prijs</th><th>Hoeveelheid</th><th>Eenheid</th><th>Datum</th><th>Actie</th></tr></thead>
              <tbody>
                {searchedAankopen.slice().sort(([a], [b]) => Number(b.datum) - Number(a.datum)).map(([aankoop, prodNaam, winkelNaam]) => {
                  const winkel = winkels.find(w => w.id === aankoop.winkelId);
                  const product = products.find(p => p.id === aankoop.productId);
                  const isOlderThan5Minutes = (Date.now() * 1_000_000 - Number(aankoop.datum)) > 300_000_000_000;
                  return (
                    <tr key={Number(aankoop.id)}>
                      <td data-label="Product">{prodNaam}</td>
                      <td data-label="Winkel">{winkelNaam}</td>
                      <td data-label="Land">{winkel ? Object.keys(winkel.land)[0] : 'n/a'}</td>
                      <td data-label="Prijs">€{aankoop.prijs.toFixed(2)}</td>
                      <td data-label="Hoeveelheid">{aankoop.hoeveelheid}</td>
                      <td data-label="Eenheid">{product ? formatEenheid(product.standaardEenheid, false).replace('per ', '') : 'n/a'}</td>
                      <td data-label="Datum">{new Date(Number(aankoop.datum) / 1_000_000).toLocaleString()}</td>
                      <td data-label="Actie">
                        <button onClick={() => handleDeleteAankoop(aankoop.id)} className="button-danger" disabled={deletingItemId === aankoop.id || isOlderThan5Minutes} title={isOlderThan5Minutes ? "Kan niet verwijderen na 5 minuten" : ""}>
                          {deletingItemId === aankoop.id ? '...' : 'Verwijder'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      </main>
    </div>
  );
}

export default App;