import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Aankoop_Database_backend as backend } from 'declarations/Aankoop_Database_backend';
import { Aankoop, BestePrijsInfo, Eenheid, Land, Product, Winkel } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';

// Helper component for collapsible sections
const CollapsibleSection = ({ title, children, startOpen = false }: { title: string, children: React.ReactNode, startOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(startOpen);
  return (
    <section style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <button onClick={() => setIsOpen(!isOpen)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', fontSize: '1.5em', cursor: 'pointer', padding: '0 0 10px 0', borderBottom: isOpen ? '1px solid #eee' : 'none', marginBottom: isOpen ? '20px' : '0' }}>
        {isOpen ? '➖' : '➕'} {title}
      </button>
      {isOpen && children}
    </section>
  );
};

// Type definition for the extended purchase object, which includes product and store names
type AankoopExtended = [Aankoop, string, string];

// Define possible Eenheid options for the dropdown menu
const eenheidOptions = [
    'STUK', 'METER', 'KILOGRAM', 'GRAM', 'LITER', 'MILLILITER', 'ROL', 'TABLET'
] as const;

function App() {
  const [winkels, setWinkels] = useState<Winkel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [aankopen, setAankopen] = useState<AankoopExtended[]>([]);
  const [bestPrices, setBestPrices] = useState<Map<bigint, BestePrijsInfo>>(new Map());

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


  // Fetch all data from the backend canister
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
    // Set brand to "n.v.t." if it's empty
    const finalMerk = merk.trim() === '' ? 'n.v.t.' : merk;
    // Keywords are hidden and will be saved as "n.v.t." for new products.
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
     if (!naam) { // Merk is optional now
      alert("Naam mag niet leeg zijn.");
      return;
    }
    const finalMerk = merk.trim() === '' ? 'n.v.t.' : merk;
    // Keywords are preserved but not edited.
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
        // Keywords are loaded into state to be preserved on update, but are not shown in the UI.
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
    // Reset form and search fields
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

  // --- OTHER ---
  const handleFindBestPrice = async (productId: bigint) => {
    const result = await backend.findBestPrice(productId);
    const bestPriceInfo = result[0];
    if (bestPriceInfo) {
        setBestPrices(prev => new Map(prev).set(productId, bestPriceInfo));
    } else {
        alert("Geen prijsinformatie gevonden voor dit product.");
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

  const selectedProductForAankoop = formAankoop.productId ? products.find(p => p.id === BigInt(formAankoop.productId)) : null;
  
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '1200px', margin: 'auto' }}>
      <h1>🛒 Boodschappen Tracker</h1>

      {/* --- Management Sections --- */}
      <CollapsibleSection title="Beheer: Winkel Toevoegen">
        <form onSubmit={handleAddWinkel} style={formStyle}>
            <input type="text" placeholder="Naam winkel" value={formWinkel.naam} onChange={e => setFormWinkel({...formWinkel, naam: e.target.value})} required />
            <input type="text" placeholder="Keten (bv. Albert Heijn)" value={formWinkel.keten} onChange={e => setFormWinkel({...formWinkel, keten: e.target.value})} required />
            <select value={Object.keys(formWinkel.land)[0]} onChange={e => setFormWinkel({...formWinkel, land: { [e.target.value]: null } as Land})} required>
                <option value="NL">Nederland</option>
                <option value="ES">Spanje</option>
            </select>
            <button type="submit">Voeg Winkel Toe</button>
        </form>
        
        <CollapsibleSection title="Bekijk Bestaande Winkels">
            <table style={tableStyle}>
                <thead>
                    <tr>
                        <th style={thStyle}>Land</th>
                        <th style={thStyle}>Naam</th>
                        <th style={thStyle}>Keten</th>
                        <th style={thStyle}>Acties</th>
                    </tr>
                </thead>
                <tbody>
                    {winkels.slice().sort((a, b) => a.naam.localeCompare(b.naam)).map(w => (
                        <tr key={Number(w.id)}>
                            {editingWinkelId === w.id ? (
                                <>
                                    <td style={tdStyle}>
                                        <select 
                                            value={Object.keys(editingWinkelData.land)[0]} 
                                            onChange={e => setEditingWinkelData({...editingWinkelData, land: { [e.target.value]: null } as Land })}>
                                            <option value="NL">NL</option>
                                            <option value="ES">ES</option>
                                        </select>
                                    </td>
                                    <td style={tdStyle}><input type="text" value={editingWinkelData.naam} onChange={e => setEditingWinkelData({...editingWinkelData, naam: e.target.value})} /></td>
                                    <td style={tdStyle}><input type="text" value={editingWinkelData.keten} onChange={e => setEditingWinkelData({...editingWinkelData, keten: e.target.value})} /></td>
                                    <td style={tdStyle}>
                                        <button onClick={() => handleUpdateWinkel(w.id)} style={{color: 'green'}}>Opslaan</button>
                                        <button onClick={() => setEditingWinkelId(null)}>Annuleren</button>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td style={tdStyle}>{Object.keys(w.land)[0]}</td>
                                    <td style={tdStyle}>{w.naam}</td>
                                    <td style={tdStyle}>{w.keten}</td>
                                    <td style={tdStyle}>
                                        <button onClick={() => startEditingWinkel(w)}>Wijzig</button>
                                        <button onClick={() => handleDeleteWinkel(w.id)} style={{color: 'red'}}>Verwijder</button>
                                    </td>
                                </>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </CollapsibleSection>
      </CollapsibleSection>

      <CollapsibleSection title="Beheer: Product Toevoegen">
        <form onSubmit={handleAddProduct} style={formStyle}>
            <input type="text" placeholder="Naam product" value={formProduct.naam} onChange={e => setFormProduct({...formProduct, naam: e.target.value})} required />
            <input type="text" placeholder="Merk (optioneel)" value={formProduct.merk} onChange={e => setFormProduct({...formProduct, merk: e.target.value})} />
            <select 
              value={Object.keys(formProduct.standaardEenheid)[0]} 
              onChange={e => {
                const newEenheid = e.target.value as typeof eenheidOptions[number];
                setFormProduct({...formProduct, standaardEenheid: { [newEenheid]: null } as Eenheid});
              }} 
              required
            >
                {[...eenheidOptions].sort().map(key => <option key={key} value={key}>{key.charAt(0) + key.slice(1).toLowerCase()}</option>)}
            </select>
            <button type="submit">Voeg Product Toe</button>
        </form>

        <CollapsibleSection title="Bekijk Bestaande Producten">
            <table style={tableStyle}>
                <thead>
                    <tr>
                        <th style={thStyle}>Naam</th>
                        <th style={thStyle}>Merk</th>
                        <th style={thStyle}>Standaard Eenheid</th>
                        <th style={thStyle}>Acties</th>
                    </tr>
                </thead>
                <tbody>
                    {products.slice().sort((a, b) => a.naam.localeCompare(b.naam)).map(p => (
                         <tr key={Number(p.id)}>
                            {editingProductId === p.id ? (
                                <>
                                    <td style={tdStyle}><input type="text" value={editingProductData.naam} onChange={e => setEditingProductData({ ...editingProductData, naam: e.target.value })} /></td>
                                    <td style={tdStyle}><input type="text" placeholder="Merk (optioneel)" value={editingProductData.merk} onChange={e => setEditingProductData({ ...editingProductData, merk: e.target.value })} /></td>
                                    {/* Eenheid is no longer editable */}
                                    <td style={tdStyle}>{formatEenheid(editingProductData.standaardEenheid).replace('per ', '')}</td>
                                    <td style={tdStyle}>
                                        <button onClick={() => handleUpdateProduct(p.id)} style={{color: 'green'}}>Opslaan</button>
                                        <button onClick={() => setEditingProductId(null)}>Annuleren</button>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td style={tdStyle}>{p.naam}</td>
                                    <td style={tdStyle}>{p.merk}</td>
                                    <td style={tdStyle}>{formatEenheid(p.standaardEenheid).replace('per ', '')}</td>
                                    <td style={tdStyle}>
                                        <button onClick={() => startEditingProduct(p)}>Wijzig</button>
                                        <button onClick={() => handleDeleteProduct(p.id)} style={{color: 'red'}}>Verwijder</button>
                                    </td>
                                </>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </CollapsibleSection>
      </CollapsibleSection>
      
      {/* --- Add Purchase Section --- */}
      <CollapsibleSection title="Nieuwe Aankoop Toevoegen" startOpen={true}>
        <form onSubmit={handleAddAankoop} style={formStyle}>
            {/* Searchable Product Dropdown */}
            <input 
              list="product-options"
              value={productSearch}
              onChange={e => {
                const value = e.target.value;
                setProductSearch(value);
                const selectedProd = products.find(p => `${p.naam} (${p.merk})` === value);
                setFormAankoop(prev => ({ ...prev, productId: selectedProd ? String(selectedProd.id) : '' }));
              }}
              placeholder="-- Selecteer Product --"
              required
              style={{ flexGrow: 1 }}
            />
            <datalist id="product-options">
              {products.slice().sort((a, b) => a.naam.localeCompare(b.naam)).map(p => 
                <option key={Number(p.id)} value={`${p.naam} (${p.merk})`} />
              )}
            </datalist>
            
            {/* Searchable Winkel Dropdown */}
            <input 
              list="winkel-options"
              value={winkelSearch}
              onChange={e => {
                const value = e.target.value;
                setWinkelSearch(value);
                const selectedWinkel = winkels.find(w => `${Object.keys(w.land)[0]} - ${w.naam} (${w.keten})` === value);
                setFormAankoop(prev => ({...prev, winkelId: selectedWinkel ? String(selectedWinkel.id) : ''}));
              }}
              placeholder="-- Selecteer Winkel --"
              required
              style={{ flexGrow: 1 }}
            />
            <datalist id="winkel-options">
               {winkels
                  .slice()
                  .sort((a, b) => {
                    const landA = Object.keys(a.land)[0];
                    const landB = Object.keys(b.land)[0];
                    if (landA.localeCompare(landB) !== 0) return landA.localeCompare(landB);
                    return a.naam.localeCompare(b.naam);
                  })
                  .map(w => (
                    <option key={Number(w.id)} value={`${Object.keys(w.land)[0]} - ${w.naam} (${w.keten})`} />
                  ))}
            </datalist>

            <input type="text" placeholder="Bon omschrijving" value={formAankoop.bonOmschrijving} onChange={e => setFormAankoop({...formAankoop, bonOmschrijving: e.target.value})} required />
            <input type="number" step="0.01" placeholder="Prijs (€)" value={formAankoop.prijs} onChange={e => setFormAankoop({...formAankoop, prijs: e.target.value})} required />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexGrow: 1 }}>
                <input type="number" step="0.001" placeholder="Hoeveelheid" value={formAankoop.hoeveelheid} onChange={e => setFormAankoop({...formAankoop, hoeveelheid: e.target.value})} required style={{ width: '100px' }} />
                <span style={{ fontWeight: 'bold' }}>
                    {selectedProductForAankoop ? formatEenheid(selectedProductForAankoop.standaardEenheid).replace('per ', '') : '...'}
                </span>
            </div>
            <button type="submit">Voeg Aankoop Toe</button>
        </form>
      </CollapsibleSection>

      {/* --- Price Finder Section --- */}
      <section style={sectionStyle}>
        <h2>Boodschappenlijst & Beste Prijs Vinder</h2>
        <table style={tableStyle}>
            <thead>
                <tr><th style={thStyle}>Product</th><th style={thStyle}>Actie</th><th style={thStyle}>Beste Keuze</th></tr>
            </thead>
            <tbody>
                {products.map(p => (
                    <tr key={Number(p.id)}>
                        <td style={tdStyle}>{p.naam} ({p.merk})</td>
                        <td style={tdStyle}><button onClick={() => handleFindBestPrice(p.id)}>Vind Beste Prijs</button></td>
                        <td style={tdStyle}>
                            {bestPrices.has(p.id) ? 
                                `${bestPrices.get(p.id)!.winkelNaam}: €${bestPrices.get(p.id)!.eenheidsprijs.toFixed(2)} ${formatEenheid(bestPrices.get(p.id)!.eenheid)}` 
                                : 'Nog niet gezocht'}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </section>

      {/* --- History Section --- */}
      <section style={sectionStyle}>
        <h2>Aankopen Historie</h2>
        <table style={tableStyle}>
            <thead>
                <tr>
                    <th style={thStyle}>Product</th><th style={thStyle}>Winkel</th><th style={thStyle}>Prijs</th><th style={thStyle}>Hoeveelheid</th><th style={thStyle}>Datum</th><th style={thStyle}>Actie</th>
                </tr>
            </thead>
            <tbody>
                {aankopen
                  .slice()
                  .sort(([a], [b]) => Number(b.datum) - Number(a.datum))
                  .map(([aankoop, prodNaam, winkelNaam]) => (
                    <tr key={Number(aankoop.id)}>
                        <td style={tdStyle}>{prodNaam}</td>
                        <td style={tdStyle}>{winkelNaam}</td>
                        <td style={tdStyle}>€{aankoop.prijs.toFixed(2)}</td>
                        <td style={tdStyle}>{aankoop.hoeveelheid}</td>
                        <td style={tdStyle}>{new Date(Number(aankoop.datum) / 1_000_000).toLocaleDateString()}</td>
                        <td style={tdStyle}><button onClick={() => handleDeleteAankoop(aankoop.id)} style={{color: 'red'}}>Verwijder</button></td>
                    </tr>
                ))}
            </tbody>
        </table>
      </section>
    </div>
  );
}

// Reusable styles
const sectionStyle: React.CSSProperties = { marginBottom: '40px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' };
const formStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const thStyle: React.CSSProperties = { border: '1px solid #ddd', padding: '8px', textAlign: 'left', backgroundColor: '#f2f2f2' };
const tdStyle: React.CSSProperties = { border: '1px solid #ddd', padding: '8px' };

export default App;