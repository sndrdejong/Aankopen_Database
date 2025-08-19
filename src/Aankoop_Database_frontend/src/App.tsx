import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Aankoop_Database_backend as backend } from 'declarations/Aankoop_Database_backend';
import { Aankoop, BestePrijsInfo, Eenheid, Land, Product, Winkel } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';

// Helper component for collapsible sections
const CollapsibleSection = ({ title, children }: { title: string, children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
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

  // State for the new winkel form - corrected type
  const [formWinkel, setFormWinkel] = useState({ naam: '', keten: '', land: { NL: null } as Land });
  
  // State for the new product form - corrected type
  const [formProduct, setFormProduct] = useState({ naam: '', merk: '', trefwoorden: '', standaardEenheid: { STUK: null } as Eenheid });

  // State for the new aankoop form
  const [formAankoop, setFormAankoop] = useState({ productId: '', winkelId: '', bonOmschrijving: '', prijs: '', hoeveelheid: '' });

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

  // Handler to add a new Winkel
  const handleAddWinkel = async (e: React.FormEvent) => {
    e.preventDefault();
    const { naam, keten, land } = formWinkel;
    if (!naam || !keten || !land) {
        alert("Vul alle velden voor de winkel in!");
        return;
    }
    await backend.addWinkel(naam, keten, land);
    alert("Winkel succesvol toegevoegd!");
    setFormWinkel({ naam: '', keten: '', land: { NL: null } as Land }); // Corrected reset state
    fetchAllData();
  };

  // Handler to add a new Product
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const { naam, merk, trefwoorden, standaardEenheid } = formProduct;
    if (!naam || !merk || !standaardEenheid) {
        alert("Naam, merk en eenheid zijn verplicht!");
        return;
    }
    const trefwoordenArray = trefwoorden.split(',').map(t => t.trim()).filter(t => t);
    await backend.addProduct(naam, merk, trefwoordenArray, standaardEenheid);
    alert("Product succesvol toegevoegd!");
    setFormProduct({ naam: '', merk: '', trefwoorden: '', standaardEenheid: { STUK: null } as Eenheid }); // Corrected reset state
    fetchAllData();
  };

  // Handler to add a new Aankoop
  const handleAddAankoop = async (e: React.FormEvent) => {
    e.preventDefault();
    const { productId, winkelId, bonOmschrijving, prijs, hoeveelheid } = formAankoop;
    if (!productId || !winkelId || !bonOmschrijving || !prijs || !hoeveelheid) {
        alert("Vul alle velden voor de aankoop in!");
        return;
    }
    await backend.addAankoop(
      BigInt(productId),
      BigInt(winkelId),
      bonOmschrijving,
      parseFloat(prijs),
      parseFloat(hoeveelheid)
    );
    alert("Aankoop succesvol toegevoegd!");
    setFormAankoop({ productId: '', winkelId: '', bonOmschrijving: '', prijs: '', hoeveelheid: '' });
    fetchAllData();
  };

  // Handler to delete an Aankoop
  const handleDeleteAankoop = async (id: bigint) => {
    if (window.confirm("Weet je zeker dat je deze aankoop wilt verwijderen?")) {
        await backend.deleteAankoop(id);
        fetchAllData();
    }
  };

  // Handler to find the best price for a product
  const handleFindBestPrice = async (productId: bigint) => {
    const result = await backend.findBestPrice(productId);
    const bestPriceInfo = result[0];

    if (bestPriceInfo) {
        setBestPrices(prev => new Map(prev).set(productId, bestPriceInfo));
    } else {
        alert("Geen prijsinformatie gevonden voor dit product.");
    }
  };

  // Helper to format the Eenheid enum for display
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
      </CollapsibleSection>

      <CollapsibleSection title="Beheer: Product Toevoegen">
        <form onSubmit={handleAddProduct} style={formStyle}>
            <input type="text" placeholder="Naam product" value={formProduct.naam} onChange={e => setFormProduct({...formProduct, naam: e.target.value})} required />
            <input type="text" placeholder="Merk" value={formProduct.merk} onChange={e => setFormProduct({...formProduct, merk: e.target.value})} required />
            <input type="text" placeholder="Trefwoorden (komma-gescheiden)" value={formProduct.trefwoorden} onChange={e => setFormProduct({...formProduct, trefwoorden: e.target.value})} />
            <select 
              value={Object.keys(formProduct.standaardEenheid)[0]} 
              onChange={e => {
                const newEenheid = e.target.value as typeof eenheidOptions[number];
                setFormProduct({...formProduct, standaardEenheid: { [newEenheid]: null } as Eenheid});
              }} 
              required
            >
                {eenheidOptions.map(key => <option key={key} value={key}>{key.charAt(0) + key.slice(1).toLowerCase()}</option>)}
            </select>
            <button type="submit">Voeg Product Toe</button>
        </form>
      </CollapsibleSection>
      
      {/* --- Add Purchase Section --- */}
      <CollapsibleSection title="Nieuwe Aankoop Toevoegen">
        <form onSubmit={handleAddAankoop} style={formStyle}>
            <select value={formAankoop.productId} onChange={e => setFormAankoop({...formAankoop, productId: e.target.value})} required>
                <option value="">-- Selecteer Product --</option>
                {products.map(p => <option key={Number(p.id)} value={Number(p.id)}>{p.naam} ({p.merk})</option>)}
            </select>
            <select value={formAankoop.winkelId} onChange={e => setFormAankoop({...formAankoop, winkelId: e.target.value})} required>
                <option value="">-- Selecteer Winkel --</option>
                {winkels.map(w => <option key={Number(w.id)} value={Number(w.id)}>{w.naam} ({w.keten})</option>)}
            </select>
            <input type="text" placeholder="Bon omschrijving" value={formAankoop.bonOmschrijving} onChange={e => setFormAankoop({...formAankoop, bonOmschrijving: e.target.value})} required />
            <input type="number" step="0.01" placeholder="Prijs (€)" value={formAankoop.prijs} onChange={e => setFormAankoop({...formAankoop, prijs: e.target.value})} required />
            <input type="number" step="0.001" placeholder="Hoeveelheid" value={formAankoop.hoeveelheid} onChange={e => setFormAankoop({...formAankoop, hoeveelheid: e.target.value})} required />
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
                  .slice() // Create a shallow copy to avoid mutating the original state
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
const formStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '10px' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const thStyle: React.CSSProperties = { border: '1px solid #ddd', padding: '8px', textAlign: 'left', backgroundColor: '#f2f2f2' };
const tdStyle: React.CSSProperties = { border: '1px solid #ddd', padding: '8px' };

export default App;
