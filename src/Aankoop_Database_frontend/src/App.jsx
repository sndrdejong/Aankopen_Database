import React, { useEffect, useState } from 'react';
import { backend } from '../../declarations/backend';
// Let op: in een echt project moet je 'dfx generate' draaien om de type definities bij te werken.
import { Product, Winkel, Aankoop, BestePrijsInfo } from '../../declarations/backend/backend.did';

type AankoopExtended = [Aankoop, string, string]; // [Aankoop, productNaam, winkelNaam]

function App() {
  // State management
  const [winkels, setWinkels] = useState<Winkel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [aankopen, setAankopen] = useState<AankoopExtended[]>([]);
  const [bestPrices, setBestPrices] = useState<Map<bigint, BestePrijsInfo>>(new Map());

  // Wijziging 4: Form state aangepast ('gekochteHoeveelheid' is nu 'hoeveelheid')
  const [formAankoop, setFormAankoop] = useState({ productId: '', winkelId: '', bonOmschrijving: '', prijs: '', hoeveelheid: '' });

  // Functie om alle data op te halen
  const fetchAllData = async () => {
    setWinkels(await backend.getWinkels());
    setProducts(await backend.getProducts());
    setAankopen(await backend.getAankopen());
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // --- Handlers ---
  const handleAddAankoop = async (e: React.FormEvent) => {
    e.preventDefault();
    // Wijziging 5: 'hoeveelheid' is nu verplicht.
    const { productId, winkelId, bonOmschrijving, prijs, hoeveelheid } = formAankoop;
    
    if (!productId || !winkelId || !bonOmschrijving || !prijs || !hoeveelheid) {
        alert("Vul alle velden in!");
        return;
    }

    // Wijziging 6: Backend aanroep gebruikt nu de nieuwe functie-signatuur.
    await backend.addAankoop(
      BigInt(productId),
      BigInt(winkelId),
      bonOmschrijving,
      parseFloat(prijs),
      parseFloat(hoeveelheid) // Direct doorgegeven, geen optionele array meer
    );
    
    // Reset form en haal data opnieuw op
    setFormAankoop({ productId: '', winkelId: '', bonOmschrijving: '', prijs: '', hoeveelheid: '' });
    fetchAllData();
  };

  const handleDeleteAankoop = async (id: bigint) => {
    if (window.confirm("Weet je zeker dat je deze aankoop wilt verwijderen?")) {
        await backend.deleteAankoop(id);
        fetchAllData();
    }
  };

  const handleFindBestPrice = async (productId: bigint) => {
    const result = await backend.findBestPrice(productId);
    if (result && result.length > 0) {
        const newBestPrices = new Map(bestPrices);
        newBestPrices.set(productId, result[0]);
        setBestPrices(newBestPrices);
    } else {
        alert("Geen prijsinformatie gevonden voor dit product.");
    }
  };

  const formatEenheid = (eenheid: any) => {
    if ('#STUK' in eenheid) return 'per stuk';
    if ('#KILOGRAM' in eenheid) return 'per kg';
    if ('#LITER' in eenheid) return 'per liter';
    return '';
  }
  
  // --- Render ---
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <h1>🛒 Boodschappen Tracker</h1>

      {/* SECTIE: AANKOOP TOEVOEGEN (GEWIJZIGD) */}
      <section style={{ marginBottom: '40px', padding: '20px', border: '1px solid #ccc' }}>
        <h2>Nieuwe Aankoop Toevoegen</h2>
        <form onSubmit={handleAddAankoop}>
            <select value={formAankoop.productId} onChange={e => setFormAankoop({...formAankoop, productId: e.target.value})} required>
                <option value="">-- Selecteer Product --</option>
                {products.map(p => <option key={Number(p.id)} value={Number(p.id)}>{p.naam}</option>)}
            </select>
            <select value={formAankoop.winkelId} onChange={e => setFormAankoop({...formAankoop, winkelId: e.target.value})} required>
                <option value="">-- Selecteer Winkel --</option>
                {winkels.map(w => <option key={Number(w.id)} value={Number(w.id)}>{w.naam}</option>)}
            </select>
            <input type="text" placeholder="Bon omschrijving" value={formAankoop.bonOmschrijving} onChange={e => setFormAankoop({...formAankoop, bonOmschrijving: e.target.value})} required />
            <input type="number" step="0.01" placeholder="Prijs (€)" value={formAankoop.prijs} onChange={e => setFormAankoop({...formAankoop, prijs: e.target.value})} required />
            {/* Wijziging 7: Input veld is nu verplicht en heet 'hoeveelheid'. */}
            <input type="number" step="0.001" placeholder="Hoeveelheid (kg, liter, stuks)" value={formAankoop.hoeveelheid} onChange={e => setFormAankoop({...formAankoop, hoeveelheid: e.target.value})} required />
            <button type="submit">Voeg Aankoop Toe</button>
        </form>
      </section>

      {/* SECTIE: BOODSCHAPPENLIJST & BESTE PRIJS */}
      <section style={{ marginBottom: '40px', padding: '20px', border: '1px solid #ccc' }}>
        <h2>Boodschappenlijst & Beste Prijs Vinder</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                                `${bestPrices.get(p.id)!.productNaam} voor €${bestPrices.get(p.id)!.eenheidsprijs.toFixed(2)} ${formatEenheid(bestPrices.get(p.id)!.eenheid)} bij ${bestPrices.get(p.id)!.winkelNaam}` 
                                : 'Nog niet gezocht'}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </section>

      {/* SECTIE: AANKOPEN HISTORIE */}
      <section>
        <h2>Aankopen Historie</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
                <tr>
                    <th style={thStyle}>Product</th><th style={thStyle}>Winkel</th><th style={thStyle}>Prijs</th><th style={thStyle}>Bon Omschrijving</th><th style={thStyle}>Actie</th>
                </tr>
            </thead>
            <tbody>
                {aankopen.map(([aankoop, prodNaam, winkelNaam]) => (
                    <tr key={Number(aankoop.id)}>
                        <td style={tdStyle}>{prodNaam}</td>
                        <td style={tdStyle}>{winkelNaam}</td>
                        <td style={tdStyle}>€{aankoop.prijs.toFixed(2)}</td>
                        <td style={tdStyle}>{aankoop.bonOmschrijving}</td>
                        <td style={tdStyle}><button onClick={() => handleDeleteAankoop(aankoop.id)} style={{color: 'red'}}>Verwijder</button></td>
                    </tr>
                ))}
            </tbody>
        </table>
      </section>
    </div>
  );
}

// Basic styling
const thStyle = { border: '1px solid #ddd', padding: '8px', textAlign: 'left', backgroundColor: '#f2f2f2' };
const tdStyle = { border: '1px solid #ddd', padding: '8px' };


export default App;