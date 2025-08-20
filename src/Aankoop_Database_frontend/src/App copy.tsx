import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Aankoop_Database_backend as backend } from 'declarations/Aankoop_Database_backend';
import { Aankoop, BestePrijsInfo, Eenheid, Land, Product, Winkel, AllBestPricesResult } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';
import './App.css'; // Importeer de nieuwe stylesheet

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
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  // State for forms
  const [formWinkel, setFormWinkel] = useState({ naam: '', keten: '', land: { NL: null } as Land });
  const [formProduct, setFormProduct] = useState({ naam: '', merk: '', standaardEenheid: { STUK: null } as Eenheid });
  const [formAankoop, setFormAankoop] = useState({ productId: '', winkelId: '', bonOmschrijving: '', prijs: '', hoeveelheid: '' });
  
  // State for searchable dropdown inputs
  const [productSearch, setProductSearch] = useState('');
  const [winkelSearch, setWinkelSearch] = useState('');

  // State for editing items
  const [editingWinkelId, setEditingWinkelId] = useState<bigint | null>(null);
  const [editingWinkelData, setEditingWinkelData] = useState<Omit<Winkel, 'id'>>({ naam: '', keten: '', land: { NL: null } });
  
  const [editingProductId, setEditingProductId] = useState<bigint | null>(null);
  const [editingProductData, setEditingProductData] = useState<Omit<Product, 'id' | 'trefwoorden'> & { trefwoorden: string }>({ naam: '', merk: '', trefwoorden: '', standaardEenheid: { STUK: null } });

  const fetchAllData = useCallback(async () => {
    try {
        setWinkels(await backend.getWinkels());
        setProducts(await backend.getProducts());
        setAankopen(await backend.getAankopen());
    } catch (error) {
        console.error("Failed to fetch data:", error);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // --- WINKEL HANDLERS ---
  const handleAddWinkel = async (e: React.FormEvent) => {
    e.preventDefault();
    await backend.addWinkel(formWinkel.naam, formWinkel.keten, formWinkel.land);
    alert("Winkel succesvol toegevoegd!");
    setFormWinkel({ naam: '', keten: '', land: { NL: null } as Land });
    fetchAllData();
  };

  const handleDeleteWinkel = async (id: bigint) => {
    if (window.confirm("Weet je zeker dat je deze winkel wilt verwijderen? Dit kan alleen als er geen aankopen aan gekoppeld zijn.")) {
      const result = await backend.deleteWinkel(id);
      if ('ok' in result) {
        alert("Winkel succesvol verwijderd.");
        fetchAllData();
      } else {
        alert(`Fout bij verwijderen: ${result.err}`);
      }
    }
  };
  
  const handleUpdateWinkel = async (id: bigint) => {
    const { naam, keten, land } = editingWinkelData;
    if (!naam || !keten) {
      alert("Naam en keten mogen niet leeg zijn.");
      return;
    }
    const result = await backend.updateWinkel(id, naam, keten, land);
    if ('ok' in result) {
      alert("Winkel succesvol bijgewerkt.");
      setEditingWinkelId(null);
      fetchAllData();
    } else {
      alert(`Fout bij bijwerken: ${result.err}`);
    }
  };

  const startEditingWinkel = (winkel: Winkel) => {
    setEditingWinkelId(winkel.id);
    setEditingWinkelData({ naam: winkel.naam, keten: winkel.keten, land: winkel.land });
  };

  // --- PRODUCT HANDLERS ---
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const { naam, merk, standaardEenheid } = formProduct;
    const finalMerk = merk.trim() === '' ? 'n.v.t.' : merk;
    const trefwoordenArray: string[] = ['n.v.t.']; 
    await backend.addProduct(naam, finalMerk, trefwoordenArray, standaardEenheid);
    alert("Product succesvol toegevoegd!");
    setFormProduct({ naam: '', merk: '', standaardEenheid: { STUK: null } as Eenheid });
    fetchAllData();
  };
  
  const handleDeleteProduct = async (id: bigint) => {
    if (window.confirm("Weet je zeker dat je dit product wilt verwijderen? Dit kan alleen als er geen aankopen aan gekoppeld zijn.")) {
      const result = await backend.deleteProduct(id);
      if ('ok' in result) {
        alert("Product succesvol verwijderd.");
        fetchAllData();
      } else {
        alert(`Fout bij verwijderen: ${result.err}`);
      }
    }
  };

  const handleUpdateProduct = async (id: bigint) => {
    const { naam, merk, trefwoorden, standaardEenheid } = editingProductData;
     if (!naam) {
      alert("Naam mag niet leeg zijn.");
      return;
    }
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
    const { productId, winkelId, bonOmschrijving, prijs, hoeveelheid } = formAankoop;
    await backend.addAankoop(
      BigInt(productId), BigInt(winkelId), bonOmschrijving, parseFloat(prijs), parseFloat(hoeveelheid)
    );
    alert("Aankoop succesvol toegevoegd!");
    setFormAankoop({ productId: '', winkelId: '', bonOmschrijving: '', prijs: '', hoeveelheid: '' });
    setProductSearch('');
    setWinkelSearch('');
    fetchAllData();
  };

  const handleDeleteAankoop = async (id: bigint) => {
    if (window.confirm("Weet je zeker dat je deze aankoop wilt verwijderen?")) {
        await backend.deleteAankoop(id);
        fetchAllData();
    }
  };

  // --- BEST PRICE FINDER LOGIC (VERNIEUWD) ---
  const handleFindAllBestPrices = async () => {
    setIsLoadingPrices(true);
    try {
      // 1. Roep de nieuwe, simpele backend functie aan
      const results: AllBestPricesResult[] = await backend.findAllBestPrices();

      // 2. Transformeer de data naar de structuur die de state verwacht
      const newBestPrices = new Map<bigint, BestPriceByCountry>();
      for (const item of results) {
        const entry: BestPriceByCountry = {};
        // Optionele waarden komen als arrays terug uit Motoko
        if (item.nl.length > 0) {
          entry.NL = item.nl[0];
        }
        if (item.es.length > 0) {
          entry.ES = item.es[0];
        }
        newBestPrices.set(item.productId, entry);
      }

      // 3. Update de state
      setBestPrices(newBestPrices);
      alert("Beste prijzen zijn opnieuw berekend!");

    } catch (error) {
      console.error("Fout bij het ophalen van beste prijzen:", error);
      alert("Er is iets misgegaan bij het berekenen van de prijzen.");
    } finally {
      setIsLoadingPrices(false);
    }
  };

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

  const PriceFinderTable = ({ countryCode }: { countryCode: 'NL' | 'ES' }) => {
    const sortedProducts = useMemo(() => {
        return products.slice().sort((a, b) => a.naam.localeCompare(b.naam));
    }, [products]);
    return (
        <div className="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Beste Keuze in {countryCode}</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedProducts.map(p => {
                        const pricesForProduct = bestPrices.get(p.id);
                        const bestPriceInCountry = pricesForProduct?.[countryCode];
                        return (
                            <tr key={Number(p.id)}>
                                <td data-label="Product">{p.naam} <span className="merk-text">({p.merk})</span></td>
                                <td data-label={`Beste Keuze in ${countryCode}`}>
                                    {bestPriceInCountry ? 
                                        `${bestPriceInCountry.winkelNaam}: €${bestPriceInCountry.eenheidsprijs.toFixed(2)} ${formatEenheid(bestPriceInCountry.eenheid)}` 
                                        : '-'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
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
              <input type="text" placeholder="Naam winkel" value={formWinkel.naam} onChange={e => setFormWinkel({...formWinkel, naam: e.target.value})} required />
              <input type="text" placeholder="Plaatsnaam" value={formWinkel.keten} onChange={e => setFormWinkel({...formWinkel, keten: e.target.value})} required />
              <select value={Object.keys(formWinkel.land)[0]} onChange={e => setFormWinkel({...formWinkel, land: { [e.target.value]: null } as Land})} required>
                  <option value="NL">Nederland</option>
                  <option value="ES">Spanje</option>
              </select>
              <button type="submit" className="button-primary">Voeg Winkel Toe</button>
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
                                          <select value={Object.keys(editingWinkelData.land)[0]} onChange={e => setEditingWinkelData({...editingWinkelData, land: { [e.target.value]: null } as Land })}>
                                              <option value="NL">NL</option><option value="ES">ES</option>
                                          </select>
                                      </td>
                                      <td data-label="Naam"><input type="text" value={editingWinkelData.naam} onChange={e => setEditingWinkelData({...editingWinkelData, naam: e.target.value})} /></td>
                                      <td data-label="Keten"><input type="text" value={editingWinkelData.keten} onChange={e => setEditingWinkelData({...editingWinkelData, keten: e.target.value})} /></td>
                                      <td data-label="Acties" className="action-buttons">
                                          <button onClick={() => handleUpdateWinkel(w.id)} className="button-success">Opslaan</button>
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
                                          <button onClick={() => handleDeleteWinkel(w.id)} className="button-danger">Verwijder</button>
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
              <input type="text" placeholder="Naam product" value={formProduct.naam} onChange={e => setFormProduct({...formProduct, naam: e.target.value})} required />
              <input type="text" placeholder="Merk (optioneel)" value={formProduct.merk} onChange={e => setFormProduct({...formProduct, merk: e.target.value})} />
              <select value={Object.keys(formProduct.standaardEenheid)[0]} onChange={e => {
                  const newEenheid = e.target.value as typeof eenheidOptions[number];
                  setFormProduct({...formProduct, standaardEenheid: { [newEenheid]: null } as Eenheid});
                }} required>
                  {[...eenheidOptions].sort().map(key => <option key={key} value={key}>{key.charAt(0) + key.slice(1).toLowerCase()}</option>)}
              </select>
              <button type="submit" className="button-primary">Voeg Product Toe</button>
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
                                          <button onClick={() => handleUpdateProduct(p.id)} className="button-success">Opslaan</button>
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
                                          <button onClick={() => handleDeleteProduct(p.id)} className="button-danger">Verwijder</button>
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
              <input list="product-options" value={productSearch} onChange={e => {
                  const value = e.target.value;
                  setProductSearch(value);
                  const selectedProd = products.find(p => `${p.naam} (${p.merk})` === value);
                  setFormAankoop(prev => ({ ...prev, productId: selectedProd ? String(selectedProd.id) : '' }));
                }} placeholder="-- Selecteer Product --" required />
              <datalist id="product-options">
                {products.slice().sort((a, b) => a.naam.localeCompare(b.naam)).map(p => 
                  <option key={Number(p.id)} value={`${p.naam} (${p.merk})`} />
                )}
              </datalist>
              
              <input list="winkel-options" value={winkelSearch} onChange={e => {
                  const value = e.target.value;
                  setWinkelSearch(value);
                  const selectedWinkel = winkels.find(w => `${Object.keys(w.land)[0]} - ${w.naam} (${w.keten})` === value);
                  setFormAankoop(prev => ({...prev, winkelId: selectedWinkel ? String(selectedWinkel.id) : ''}));
                }} placeholder="-- Selecteer Winkel --" required />
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

              <input type="text" placeholder="Bon omschrijving" value={formAankoop.bonOmschrijving} onChange={e => setFormAankoop({...formAankoop, bonOmschrijving: e.target.value})} required />
              <input type="number" step="0.01" placeholder="Prijs (€)" value={formAankoop.prijs} onChange={e => setFormAankoop({...formAankoop, prijs: e.target.value})} required />
              
              <div className="hoeveelheid-input">
                  <input type="number" step="0.001" placeholder="Hoeveelheid" value={formAankoop.hoeveelheid} onChange={e => setFormAankoop({...formAankoop, hoeveelheid: e.target.value})} required />
                  <span>
                      {selectedProductForAankoop ? formatEenheid(selectedProductForAankoop.standaardEenheid).replace('per ', '') : '...'}
                  </span>
              </div>
              <button type="submit" className="button-primary">Voeg Aankoop Toe</button>
          </form>
        </CollapsibleSection>

        <section className="card">
          <h2>Beste Prijs Vinder</h2>
          <button onClick={handleFindAllBestPrices} disabled={isLoadingPrices} className="button-primary full-width">
              {isLoadingPrices ? 'Bezig met berekenen...' : 'Vind Alle Beste Prijzen'}
          </button>
          <CollapsibleSection title="Nederland" startOpen={true}>
            <PriceFinderTable countryCode="NL" />
          </CollapsibleSection>
          <CollapsibleSection title="Spanje">
            <PriceFinderTable countryCode="ES" />
          </CollapsibleSection>
        </section>

        <section className="card">
          <h2>Aankopen Historie</h2>
          <div className="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Product</th><th>Winkel</th><th>Prijs</th><th>Hoeveelheid</th><th>Datum</th><th>Actie</th>
                    </tr>
                </thead>
                <tbody>
                    {aankopen.slice().sort(([a], [b]) => Number(b.datum) - Number(a.datum)).map(([aankoop, prodNaam, winkelNaam]) => (
                      <tr key={Number(aankoop.id)}>
                          <td data-label="Product">{prodNaam}</td>
                          <td data-label="Winkel">{winkelNaam}</td>
                          <td data-label="Prijs">€{aankoop.prijs.toFixed(2)}</td>
                          <td data-label="Hoeveelheid">{aankoop.hoeveelheid}</td>
                          <td data-label="Datum">{new Date(Number(aankoop.datum) / 1_000_000).toLocaleDateString()}</td>
                          <td data-label="Actie"><button onClick={() => handleDeleteAankoop(aankoop.id)} className="button-danger">Verwijder</button></td>
                      </tr>
                    ))}
                </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;