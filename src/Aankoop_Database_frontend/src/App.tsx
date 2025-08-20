import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Aankoop_Database_backend as backend } from 'declarations/Aankoop_Database_backend';
import { Aankoop, BestePrijsInfo, Eenheid, Land, Product, Winkel, AllBestPricesResult } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';
import './App.css'; // Importeer de stylesheet

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

function App() {
  const [winkels, setWinkels] = useState<Winkel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [aankopen, setAankopen] = useState<AankoopExtended[]>([]);
  const [bestPrices, setBestPrices] = useState<Map<bigint, BestPriceByCountry>>(new Map());

  // --- LOADING STATES ---
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<bigint | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<bigint | null>(null);

  // --- State voor selectie van beste prijzen ---
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // State for forms
  const [formWinkel, setFormWinkel] = useState({ naam: '', keten: '', land: { NL: null } as Land });
  const [formProduct, setFormProduct] = useState({ naam: '', merk: '', standaardEenheid: { STUK: null } as Eenheid });
  const [formAankoop, setFormAankoop] = useState({ productId: '', winkelId: '', bonOmschrijving: '', prijs: '', hoeveelheid: '' });

  // State for searchable dropdown inputs
  const [productSearch, setProductSearch] = useState('');
  const [winkelSearch, setWinkelSearch] = useState('');

  // NIEUW: State om bij te houden welke velden een suggestie bevatten
  const [suggestedFields, setSuggestedFields] = useState<Set<string>>(new Set());

  // State for editing items
  const [editingWinkelId, setEditingWinkelId] = useState<bigint | null>(null);
  const [editingWinkelData, setEditingWinkelData] = useState<Omit<Winkel, 'id'>>({ naam: '', keten: '', land: { NL: null } });

  const [editingProductId, setEditingProductId] = useState<bigint | null>(null);
  const [editingProductData, setEditingProductData] = useState<Omit<Product, 'id' | 'trefwoorden'> & { trefwoorden: string }>({ naam: '', merk: '', trefwoorden: '', standaardEenheid: { STUK: null } });

  // --- DATA FETCHING ---

  const fetchBestPrices = async () => {
    setIsLoadingPrices(true);
    try {
      const results: AllBestPricesResult[] = await backend.findAllBestPrices();
      const newBestPrices = new Map<bigint, BestPriceByCountry>();
      for (const item of results) {
        const entry: BestPriceByCountry = {};
        if (item.nl.length > 0) {
          entry.NL = item.nl[0];
        }
        if (item.es.length > 0) {
          entry.ES = item.es[0];
        }
        newBestPrices.set(item.productId, entry);
      }
      setBestPrices(newBestPrices);
    } catch (error) {
      console.error("Fout bij het ophalen van beste prijzen:", error);
      alert("Er is iets misgegaan bij het berekenen van de prijzen.");
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

  // --- EFFECT HOOK VOOR AUTOMATISCH INVULLEN LAATSTE AANKOOP ---
  useEffect(() => {
    const findLastPurchase = () => {
      const { productId, winkelId } = formAankoop;

      if (productId && winkelId) {
        const matchingPurchases = aankopen
          .map(a => a[0]) // We hebben alleen het Aankoop object nodig
          .filter(a => String(a.productId) === productId && String(a.winkelId) === winkelId);

        if (matchingPurchases.length > 0) {
          // Sorteer op datum (meest recente eerst)
          matchingPurchases.sort((a, b) => Number(b.datum) - Number(a.datum));
          const lastPurchase = matchingPurchases[0];

          // Vul het formulier met de data van de laatste aankoop
          setFormAankoop(prev => ({
            ...prev,
            bonOmschrijving: lastPurchase.bonOmschrijving,
            prijs: String(lastPurchase.prijs),
            hoeveelheid: String(lastPurchase.hoeveelheid),
          }));

          // Markeer de velden als 'voorgesteld'
          setSuggestedFields(new Set(['bonOmschrijving', 'prijs', 'hoeveelheid']));
        } else {
          // Als er geen match is, reset de suggesties
          setSuggestedFields(new Set());
        }
      }
    };

    findLastPurchase();
  }, [formAankoop.productId, formAankoop.winkelId, aankopen]);

  // --- WINKEL HANDLERS ---
  const handleAddWinkel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await backend.addWinkel(formWinkel.naam, formWinkel.keten, formWinkel.land);
      alert("Winkel succesvol toegevoegd!");
      setFormWinkel({ naam: '', keten: '', land: { NL: null } as Land });
      fetchAllData();
    } catch (error) {
      alert("Fout bij toevoegen van winkel.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWinkel = async (id: bigint) => {
    if (window.confirm("Weet je zeker dat je deze winkel wilt verwijderen? Dit kan alleen als er geen aankopen aan gekoppeld zijn.")) {
      setDeletingItemId(id);
      try {
        const result = await backend.deleteWinkel(id);
        if ('ok' in result) {
          alert("Winkel succesvol verwijderd.");
          fetchAllData();
        } else {
          alert(`Fout bij verwijderen: ${result.err}`);
        }
      } catch (error) {
        alert("Fout bij verwijderen van winkel.");
        console.error(error);
      } finally {
        setDeletingItemId(null);
      }
    }
  };

  const handleUpdateWinkel = async (id: bigint) => {
    const { naam, keten, land } = editingWinkelData;
    if (!naam || !keten) {
      alert("Naam en keten mogen niet leeg zijn.");
      return;
    }
    setUpdatingItemId(id);
    try {
      const result = await backend.updateWinkel(id, naam, keten, land);
      if ('ok' in result) {
        alert("Winkel succesvol bijgewerkt.");
        setEditingWinkelId(null);
        fetchAllData();
      } else {
        alert(`Fout bij bijwerken: ${result.err}`);
      }
    } catch (error) {
      alert("Fout bij bijwerken van winkel.");
      console.error(error);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const startEditingWinkel = (winkel: Winkel) => {
    setEditingWinkelId(winkel.id);
    setEditingWinkelData({ naam: winkel.naam, keten: winkel.keten, land: winkel.land });
  };

  // --- PRODUCT HANDLERS ---
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { naam, merk, standaardEenheid } = formProduct;
      const finalMerk = merk.trim() === '' ? 'n.v.t.' : merk;
      const trefwoordenArray: string[] = ['n.v.t.'];
      await backend.addProduct(naam, finalMerk, trefwoordenArray, standaardEenheid);
      alert("Product succesvol toegevoegd!");
      setFormProduct({ naam: '', merk: '', standaardEenheid: { STUK: null } as Eenheid });
      fetchAllData();
    } catch (error) {
      alert("Fout bij toevoegen van product.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: bigint) => {
    if (window.confirm("Weet je zeker dat je dit product wilt verwijderen? Dit kan alleen als er geen aankopen aan gekoppeld zijn.")) {
      setDeletingItemId(id);
      try {
        const result = await backend.deleteProduct(id);
        if ('ok' in result) {
          alert("Product succesvol verwijderd.");
          fetchAllData();
        } else {
          alert(`Fout bij verwijderen: ${result.err}`);
        }
      } catch (error) {
        alert("Fout bij verwijderen van product.");
        console.error(error);
      } finally {
        setDeletingItemId(null);
      }
    }
  };

  const handleUpdateProduct = async (id: bigint) => {
    const { naam, merk, trefwoorden, standaardEenheid } = editingProductData;
    if (!naam) {
      alert("Naam mag niet leeg zijn.");
      return;
    }
    setUpdatingItemId(id);
    try {
      const finalMerk = merk.trim() === '' ? 'n.v.t.' : merk;
      const trefwoordenArray = trefwoorden.split(',').map(t => t.trim()).filter(t => t);
      const result = await backend.updateProduct(id, naam, finalMerk, trefwoordenArray, standaardEenheid);

      if ('ok' in result) {
        alert("Product succesvol bijgewerkt.");
        setEditingProductId(null);
        fetchAllData();
      } else {
        alert(`Fout bij bijwerken: ${result.err}`);
      }
    } catch (error) {
      alert("Fout bij bijwerken van product.");
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

  // --- AANKOOP HANDLERS ---
  const handleAddAankoop = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { productId, winkelId, bonOmschrijving, prijs, hoeveelheid } = formAankoop;
      await backend.addAankoop(
        BigInt(productId), BigInt(winkelId), bonOmschrijving, parseFloat(prijs), parseFloat(hoeveelheid)
      );
      alert("Aankoop succesvol toegevoegd!");
      setFormAankoop({ productId: '', winkelId: '', bonOmschrijving: '', prijs: '', hoeveelheid: '' });
      setProductSearch('');
      setWinkelSearch('');
      setSuggestedFields(new Set()); // Reset suggesties na toevoegen
      await fetchAllData();
    } catch (error) {
      alert("Fout bij toevoegen van aankoop.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAankoop = async (id: bigint) => {
    if (window.confirm("Weet je zeker dat je deze aankoop wilt verwijderen?")) {
      setDeletingItemId(id);
      try {
        await backend.deleteAankoop(id);
        await fetchAllData();
      } catch (error) {
        alert("Fout bij verwijderen van aankoop.");
        console.error(error);
      } finally {
        setDeletingItemId(null);
      }
    }
  };

  // --- BEST PRICE FINDER LOGIC ---
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
      const productId = BigInt(idStr);
      const product = products.find(p => p.id === productId);

      if (product) {
        const priceEntry = bestPrices.get(productId);
        const priceInfo = country === 'NL' ? priceEntry?.NL : priceEntry?.ES;
        selectionData.push({ product, priceInfo, country });
      }
    });

    const sortedSelection = selectionData.sort((a, b) => {
      // Use a placeholder for items without a store to sort them last
      const winkelA = a.priceInfo?.winkelNaam ?? 'ZZZ_NO_WINKEL';
      const winkelB = b.priceInfo?.winkelNaam ?? 'ZZZ_NO_WINKEL';
      const winkelCompare = winkelA.localeCompare(winkelB);
      if (winkelCompare !== 0) {
        return winkelCompare;
      }
      return a.product.naam.localeCompare(b.product.naam);
    });

    let exportText = "🛒 Mijn Boodschappenlijstje\n";
    let currentWinkel = "";
    const noWinkelGroupName = "--- Overige producten ---";

    sortedSelection.forEach(({ product, priceInfo }) => {
      const winkelNaam = priceInfo?.winkelNaam;

      if (winkelNaam) {
        if (winkelNaam !== currentWinkel) {
          currentWinkel = winkelNaam;
          exportText += `\n--- ${currentWinkel} ---\n`;
        }
        const priceString = `€${priceInfo.eenheidsprijs.toFixed(2)} ${formatEenheid(priceInfo.eenheid)}`;
        exportText += `- ${product.naam} (${product.merk}): ${priceString}\n`;
      } else {
        // Handle products without a price
        if (currentWinkel !== noWinkelGroupName) {
          currentWinkel = noWinkelGroupName;
          exportText += `\n${noWinkelGroupName}\n`;
        }
        exportText += `- ${product.naam} (${product.merk})\n`;
      }
    });

    navigator.clipboard.writeText(exportText).then(() => {
      alert("Boodschappenlijst gekopieerd naar klembord!");
    }).catch(err => {
      console.error("Kon niet naar klembord kopiëren: ", err);
      alert("Er ging iets mis bij het kopiëren.");
    });
  };


  // --- HELPER & RENDER FUNCTIES ---
  const formatEenheid = (eenheid?: object): string => {
    if (!eenheid) return '';
    const key = Object.keys(eenheid)[0];
    switch (key) {
      case 'STUK': return 'per stuk';
      case 'KILOGRAM': return 'per kg';
      case 'GRAM': return 'per gram';
      case 'LITER': return 'per liter';
      case 'MILLILITER': return 'per ml';
      case 'ROL': return 'per rol';
      case 'TABLET': return 'per tablet';
      case 'METER': return 'per meter';
      default: return '';
    }
  };

  const PriceFinderTable = ({
    countryCode,
    selectedProducts,
    onSelectionChange
  }: {
    countryCode: 'NL' | 'ES',
    selectedProducts: Set<string>,
    onSelectionChange: (productId: bigint, countryCode: 'NL' | 'ES') => void
  }) => {
    const sortedProducts = useMemo(() => {
      return [...products] // Create a shallow copy to avoid mutating the original array
        .sort((a, b) => {
          const aHasPrice = bestPrices.has(a.id) && bestPrices.get(a.id)?.[countryCode] !== undefined;
          const bHasPrice = bestPrices.has(b.id) && bestPrices.get(b.id)?.[countryCode] !== undefined;

          // If one has a price and the other doesn't, the one with the price comes first
          if (aHasPrice && !bHasPrice) return -1;
          if (!aHasPrice && bHasPrice) return 1;

          // Otherwise (both have a price or both don't), sort alphabetically by product name
          return a.naam.localeCompare(b.naam);
        });
    }, [products, bestPrices, countryCode]);

    const hasAnyPriceForCountry = useMemo(() =>
      products.some(p => bestPrices.has(p.id) && bestPrices.get(p.id)?.[countryCode]),
      [products, bestPrices, countryCode]
    );

    return (
      <div className="table-container">
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
            {sortedProducts.map(p => {
              const bestPriceInCountry = bestPrices.get(p.id)?.[countryCode];
              const selectionId = `${p.id}-${countryCode}`;
              const isSelected = selectedProducts.has(selectionId);

              if (bestPriceInCountry) {
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
                    <td data-label="Prijs">{`€${bestPriceInCountry.eenheidsprijs.toFixed(2)} ${formatEenheid(bestPriceInCountry.eenheid)}`}</td>
                  </tr>
                );
              } else {
                return (
                  <tr key={Number(p.id)} className={`disabled-row ${isSelected ? 'selected-row' : ''}`}>
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
                    <td data-label="Winkel">N/A</td>
                    <td data-label="Prijs">Geen prijs bekend</td>
                  </tr>
                );
              }
            })}
          </tbody>
        </table>
        {!hasAnyPriceForCountry && (
          <p style={{ textAlign: 'center', padding: '1rem' }}>
            Nog geen prijzen gevonden voor {countryCode === 'NL' ? 'Nederland' : 'Spanje'}.
          </p>
        )}
      </div>
    );
  };

  const selectedProductForAankoop = formAankoop.productId ? products.find(p => p.id === BigInt(formAankoop.productId)) : null;

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🛒 Boodschappen Tracker</h1>
      </header>
      <main>
        <CollapsibleSection title="Beheer: Winkels">
          <form onSubmit={handleAddWinkel} className="form-grid">
            <input type="text" placeholder="Naam winkel" value={formWinkel.naam} onChange={e => setFormWinkel({ ...formWinkel, naam: e.target.value })} required />
            <input type="text" placeholder="Plaatsnaam" value={formWinkel.keten} onChange={e => setFormWinkel({ ...formWinkel, keten: e.target.value })} required />
            <select value={Object.keys(formWinkel.land)[0]} onChange={e => setFormWinkel({ ...formWinkel, land: { [e.target.value]: null } as Land })} required>
              <option value="NL">Nederland</option>
              <option value="ES">Spanje</option>
            </select>
            <button type="submit" className="button-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Bezig...' : 'Voeg Winkel Toe'}
            </button>
          </form>

          <CollapsibleSection title="Bekijk Bestaande Winkels">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Land</th><th>Naam</th><th>Keten</th><th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {winkels.slice().sort((a, b) => a.naam.localeCompare(b.naam)).map(w => (
                    <tr key={Number(w.id)}>
                      {editingWinkelId === w.id ? (
                        <>
                          <td data-label="Land">
                            <select value={Object.keys(editingWinkelData.land)[0]} onChange={e => setEditingWinkelData({ ...editingWinkelData, land: { [e.target.value]: null } as Land })}>
                              <option value="NL">NL</option><option value="ES">ES</option>
                            </select>
                          </td>
                          <td data-label="Naam"><input type="text" value={editingWinkelData.naam} onChange={e => setEditingWinkelData({ ...editingWinkelData, naam: e.target.value })} /></td>
                          <td data-label="Keten"><input type="text" value={editingWinkelData.keten} onChange={e => setEditingWinkelData({ ...editingWinkelData, keten: e.target.value })} /></td>
                          <td data-label="Acties" className="action-buttons">
                            <button onClick={() => handleUpdateWinkel(w.id)} className="button-success" disabled={updatingItemId === w.id}>
                              {updatingItemId === w.id ? 'Opslaan...' : 'Opslaan'}
                            </button>
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
                            <button onClick={() => handleDeleteWinkel(w.id)} className="button-danger" disabled={deletingItemId === w.id}>
                              {deletingItemId === w.id ? '...' : 'Verwijder'}
                            </button>
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
            <select value={Object.keys(formProduct.standaardEenheid)[0]} onChange={e => {
              const newEenheid = e.target.value as typeof eenheidOptions[number];
              setFormProduct({ ...formProduct, standaardEenheid: { [newEenheid]: null } as Eenheid });
            }} required>
              {[...eenheidOptions].sort().map(key => <option key={key} value={key}>{key.charAt(0) + key.slice(1).toLowerCase()}</option>)}
            </select>
            <button type="submit" className="button-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Bezig...' : 'Voeg Product Toe'}
            </button>
          </form>

          <CollapsibleSection title="Bekijk Bestaande Producten">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Naam</th><th>Merk</th><th>Eenheid</th><th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice().sort((a, b) => a.naam.localeCompare(b.naam)).map(p => (
                    <tr key={Number(p.id)}>
                      {editingProductId === p.id ? (
                        <>
                          <td data-label="Naam"><input type="text" value={editingProductData.naam} onChange={e => setEditingProductData({ ...editingProductData, naam: e.target.value })} /></td>
                          <td data-label="Merk"><input type="text" placeholder="Merk (optioneel)" value={editingProductData.merk} onChange={e => setEditingProductData({ ...editingProductData, merk: e.target.value })} /></td>
                          <td data-label="Eenheid">{formatEenheid(editingProductData.standaardEenheid).replace('per ', '')}</td>
                          <td data-label="Acties" className="action-buttons">
                            <button onClick={() => handleUpdateProduct(p.id)} className="button-success" disabled={updatingItemId === p.id}>
                              {updatingItemId === p.id ? 'Opslaan...' : 'Opslaan'}
                            </button>
                            <button onClick={() => setEditingProductId(null)} className="button-secondary">Annuleren</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td data-label="Naam">{p.naam}</td>
                          <td data-label="Merk">{p.merk}</td>
                          <td data-label="Eenheid">{formatEenheid(p.standaardEenheid).replace('per ', '')}</td>
                          <td data-label="Acties" className="action-buttons">
                            <button onClick={() => startEditingProduct(p)} className="button-secondary">Wijzig</button>
                            <button onClick={() => handleDeleteProduct(p.id)} className="button-danger" disabled={deletingItemId === p.id}>
                              {deletingItemId === p.id ? '...' : 'Verwijder'}
                            </button>
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

        <CollapsibleSection title="Nieuwe Aankoop Toevoegen">
          <form onSubmit={handleAddAankoop} className="form-grid">
            <div className="form-field">
              <label htmlFor="product-select">Product:</label>
              <input
                id="product-select"
                list="product-options"
                value={productSearch}
                onChange={e => {
                  const value = e.target.value;
                  setProductSearch(value);
                  const selectedProd = products.find(p => `${p.naam} (${p.merk})` === value);
                  // Reset suggesties bij nieuw product
                  setSuggestedFields(new Set());
                  setFormAankoop(prev => ({
                    ...prev,
                    productId: selectedProd ? String(selectedProd.id) : '',
                    bonOmschrijving: '',
                    prijs: '',
                    hoeveelheid: ''
                  }));
                }}
                placeholder="-- Selecteer Product --"
                required
              />
            </div>
            <datalist id="product-options">
              {products.slice().sort((a, b) => a.naam.localeCompare(b.naam)).map(p =>
                <option key={Number(p.id)} value={`${p.naam} (${p.merk})`} />
              )}
            </datalist>

            <div className="form-field">
              <label htmlFor="winkel-select">Winkel:</label>
              <input
                id="winkel-select"
                list="winkel-options"
                value={winkelSearch}
                onChange={e => {
                  const value = e.target.value;
                  setWinkelSearch(value);
                  const selectedWinkel = winkels.find(w => `${Object.keys(w.land)[0]} - ${w.naam} (${w.keten})` === value);
                  // Reset suggesties bij nieuwe winkel
                  setSuggestedFields(new Set());
                  setFormAankoop(prev => ({
                    ...prev,
                    winkelId: selectedWinkel ? String(selectedWinkel.id) : '',
                    bonOmschrijving: '',
                    prijs: '',
                    hoeveelheid: ''
                  }));
                }}
                placeholder="-- Selecteer Winkel --"
                required
              />
            </div>
            <datalist id="winkel-options">
              {winkels.slice().sort((a, b) => {
                const landA = Object.keys(a.land)[0];
                const landB = Object.keys(b.land)[0];
                if (landA.localeCompare(landB) !== 0) return landA.localeCompare(landB);
                return a.naam.localeCompare(b.naam);
              }).map(w => (
                <option key={Number(w.id)} value={`${Object.keys(w.land)[0]} - ${w.naam} (${w.keten})`} />
              ))}
            </datalist>

            <div className="form-field">
              <label htmlFor="bon-omschrijving">Bon omschrijving:</label>
              <input
                id="bon-omschrijving"
                type="text"
                placeholder="Bon omschrijving"
                value={formAankoop.bonOmschrijving}
                onChange={e => setFormAankoop({ ...formAankoop, bonOmschrijving: e.target.value })}
                required
                className={suggestedFields.has('bonOmschrijving') ? 'suggested-input' : ''}
                onInput={() => {
                  const newSuggestions = new Set(suggestedFields);
                  newSuggestions.delete('bonOmschrijving');
                  setSuggestedFields(newSuggestions);
                }}
              />
            </div>

            <div className="form-field">
              <label htmlFor="prijs">Prijs (€):</label>
              <input
                id="prijs"
                type="number"
                step="0.01"
                placeholder="Prijs (€)"
                value={formAankoop.prijs}
                onChange={e => setFormAankoop({ ...formAankoop, prijs: e.target.value })}
                required
                className={suggestedFields.has('prijs') ? 'suggested-input' : ''}
                onInput={() => {
                  const newSuggestions = new Set(suggestedFields);
                  newSuggestions.delete('prijs');
                  setSuggestedFields(newSuggestions);
                }}
              />
            </div>

            <div className="form-field">
              <label htmlFor="hoeveelheid">Hoeveelheid:</label>
              <div className="hoeveelheid-input">
                <input
                  id="hoeveelheid"
                  type="number"
                  step="0.001"
                  placeholder="Hoeveelheid"
                  value={formAankoop.hoeveelheid}
                  onChange={e => setFormAankoop({ ...formAankoop, hoeveelheid: e.target.value })}
                  required
                  className={suggestedFields.has('hoeveelheid') ? 'suggested-input' : ''}
                  onInput={() => {
                    const newSuggestions = new Set(suggestedFields);
                    newSuggestions.delete('hoeveelheid');
                    setSuggestedFields(newSuggestions);
                  }}
                />
                <span>
                  {selectedProductForAankoop ? formatEenheid(selectedProductForAankoop.standaardEenheid).replace('per ', '') : '...'}
                </span>
              </div>
            </div>

            <div className="form-field">
              <button type="submit" className="button-primary full-width" disabled={isSubmitting}>
                {isSubmitting ? 'Bezig...' : 'Voeg Aankoop Toe'}
              </button>
            </div>
          </form>
        </CollapsibleSection>

        <section className="card">
          <h2>Beste Prijs Vinder</h2>
          <div className="button-group">
            <button onClick={handleFindAllBestPrices} disabled={isLoadingPrices} className="button-primary">
              {isLoadingPrices ? 'Berekenen...' : 'Ververs Prijzen'}
            </button>
            {selectedProducts.size > 0 && (
              <button onClick={handleExportSelection} className="button-success">
                Exporteer Lijst ({selectedProducts.size})
              </button>
            )}
          </div>

          <CollapsibleSection title="Nederland" startOpen={true}>
            <PriceFinderTable
              countryCode="NL"
              selectedProducts={selectedProducts}
              onSelectionChange={handleSelectionChange}
            />
          </CollapsibleSection>
          <CollapsibleSection title="Spanje">
            <PriceFinderTable
              countryCode="ES"
              selectedProducts={selectedProducts}
              onSelectionChange={handleSelectionChange}
            />
          </CollapsibleSection>
        </section>

        <section className="card">
          <h2>Aankopen Historie</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Winkel</th>
                  <th>Land</th>
                  <th>Prijs</th>
                  <th>Hoeveelheid</th>
                  <th>Eenheid</th>
                  <th>Datum</th>
                  <th>Actie</th>
                </tr>
              </thead>
              <tbody>
                {aankopen.slice().sort(([a], [b]) => Number(b.datum) - Number(a.datum)).map(([aankoop, prodNaam, winkelNaam]) => {
                  const winkel = winkels.find(w => w.id === aankoop.winkelId);
                  const product = products.find(p => p.id === aankoop.productId);
                  const land = winkel ? Object.keys(winkel.land)[0] : 'n/a';
                  const eenheid = product ? formatEenheid(product.standaardEenheid).replace('per ', '') : 'n/a';

                  return (
                    <tr key={Number(aankoop.id)}>
                      <td data-label="Product">{prodNaam}</td>
                      <td data-label="Winkel">{winkelNaam}</td>
                      <td data-label="Land">{land}</td>
                      <td data-label="Prijs">€{aankoop.prijs.toFixed(2)}</td>
                      <td data-label="Hoeveelheid">{aankoop.hoeveelheid}</td>
                      <td data-label="Eenheid">{eenheid}</td>
                      <td data-label="Datum">{new Date(Number(aankoop.datum) / 1_000_000).toLocaleDateString()}</td>
                      <td data-label="Actie">
                        <button onClick={() => handleDeleteAankoop(aankoop.id)} className="button-danger" disabled={deletingItemId === aankoop.id}>
                          {deletingItemId === aankoop.id ? '...' : 'Verwijder'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;