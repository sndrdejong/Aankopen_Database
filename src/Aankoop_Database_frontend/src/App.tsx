import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Aankoop_Database_backend as backend } from 'declarations/Aankoop_Database_backend';
import { Aankoop, BestePrijsInfo, Eenheid, Land, Product, Winkel, AllBestPricesResult } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';
import './App.css'; // Importeer de stylesheet
import DashboardStats from './DashboardStats'; // Importeer de nieuwe component

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

// NIEUW: Icon mapping voor eenheden
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

// GEWIJZIGD: Helper functie om icoon toe te voegen
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


// =================================================================================================
// GEFIXED: PriceFinderTable is nu een opzichzelfstaande component buiten de App component.
// Dit voorkomt dat de component opnieuw wordt aangemaakt bij elke toetsaanslag,
// waardoor de input focus behouden blijft.
// =================================================================================================
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
  // WIJZIGING: Deze memo filtert producten op basis van of er een prijs is EN of de winkel is geselecteerd.
  const displayableProducts = useMemo(() => {
    return products
      .filter(p => {
        // Vereiste 3: Toon alleen producten met een bekende beste prijs in dit land.
        const bestPriceInCountry = bestPrices.get(p.id)?.[countryCode];
        if (!bestPriceInCountry) {
          return false;
        }

        // Vereiste 2: Verberg product als de winkel van de beste prijs is uitgefilterd.
        const winkelOfBestPrice = winkels.find(w => w.naam === bestPriceInCountry.winkelNaam && Object.keys(w.land)[0] === countryCode);
        const isStoreVisible = selectedStoreIds.size === 0 || (winkelOfBestPrice && selectedStoreIds.has(winkelOfBestPrice.id));

        return isStoreVisible;
      })
      .sort((a, b) => a.naam.localeCompare(b.naam));
  }, [products, bestPrices, countryCode, winkels, selectedStoreIds]);

  // WIJZIGING: Deze memo filtert de al zichtbare producten op basis van de zoekterm.
  const finalFilteredProducts = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    if (!lowerCaseSearchTerm) return displayableProducts;

    return displayableProducts.filter(p =>
      p.naam.toLowerCase().includes(lowerCaseSearchTerm) ||
      p.merk.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [displayableProducts, searchTerm]);

  // WIJZIGING: Functie om prijs te converteren en formatteren
  const formatAndConvertPrice = (priceInfo: BestePrijsInfo): string => {
    const unitKey = Object.keys(priceInfo.eenheid)[0];
    const originalPrice = priceInfo.eenheidsprijs;

    if (unitKey === 'GRAM') {
      const pricePerKg = originalPrice * 1000;
      // OPLOSSING: Voeg hier het icoon handmatig toe
      return `${eenheidIcons['GRAM']} €${pricePerKg.toFixed(2)} per kg`;
    }

    if (unitKey === 'MILLILITER') {
      const pricePerLiter = originalPrice * 1000;
      // OPLOSSING: Voeg hier het icoon handmatig toe
      return `${eenheidIcons['MILLILITER']} €${pricePerLiter.toFixed(2)} per liter`;
    }

    // Fallback voor alle andere eenheden (deze werkte al correct)
    return `€${originalPrice.toFixed(2)} ${formatEenheid(priceInfo.eenheid)}`;
  };

  return (
    <div className="table-container">
      <div className="filter-controls">
        <input
          type="text"
          placeholder="Zoek product op naam of merk..."
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
          {/* WIJZIGING: We itereren nu over de voorgefilterde lijst, dus geen 'disabled' rijen meer nodig. */}
          {finalFilteredProducts.map(p => {
            const bestPriceInCountry = bestPrices.get(p.id)?.[countryCode];
            const selectionId = `${p.id}-${countryCode}`;
            const isSelected = selectedProducts.has(selectionId);

            // We kunnen ervan uitgaan dat bestPriceInCountry bestaat door de filter in displayableProducts
            if (!bestPriceInCountry) return null;

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
      {/* WIJZIGING: Toon een bericht als er geen producten zijn na het toepassen van de filters. */}
      {displayableProducts.length === 0 && (
        <p style={{ textAlign: 'center', padding: '1rem' }}>
          Geen prijzen gevonden voor de geselecteerde winkels in {countryCode === 'NL' ? 'Nederland' : 'Spanje'}.
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

  // --- LOADING STATES ---
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<bigint | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<bigint | null>(null);

  // --- State voor selectie van beste prijzen ---
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // --- State voor filters ---
  const [winkelSearchTerm, setWinkelSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [aankoopSearchTerm, setAankoopSearchTerm] = useState(''); // WIJZIGING: State voor aankoop historie zoekbalk
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<bigint>>(new Set());
  const [storeFilterSearchTerm, setStoreFilterSearchTerm] = useState('');
  const [priceFinderNlSearch, setPriceFinderNlSearch] = useState('');
  const [priceFinderEsSearch, setPriceFinderEsSearch] = useState('');


  // State for forms
  const [formWinkel, setFormWinkel] = useState({ naam: '', keten: '', land: { NL: null } as Land });
  const [formProduct, setFormProduct] = useState({ naam: '', merk: '', standaardEenheid: { STUK: null } as Eenheid });
  const [formAankoop, setFormAankoop] = useState({ productId: '', winkelId: '', bonOmschrijving: '', prijs: '', hoeveelheid: '' });

  // State for searchable dropdown inputs
  const [productSearch, setProductSearch] = useState('');
  const [winkelSearch, setWinkelSearch] = useState('');

  // State om bij te houden welke velden een suggestie bevatten
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

  // --- WIJZIGING: State en effect voor dynamische productwaarschuwing ---
  const [productWarning, setProductWarning] = useState<string>('');

  useEffect(() => {
    const checkProductExistence = () => {
      const cleanNaam = formProduct.naam.trim().toLowerCase();
      if (!cleanNaam) {
        setProductWarning('');
        return;
      }

      // Zoek naar producten met dezelfde naam
      const matchingProductsByName = products.filter(p => p.naam.trim().toLowerCase() === cleanNaam);

      if (matchingProductsByName.length > 0) {
        // Naam bestaat al. Controleer nu het merk.
        const cleanMerk = formProduct.merk.trim().toLowerCase();
        const existingMerken = matchingProductsByName.map(p => p.merk.trim().toLowerCase());

        // Geef een waarschuwing als het merk leeg is of als het al bestaat voor dit product
        if (cleanMerk === '' || existingMerken.includes(cleanMerk)) {
          setProductWarning("⚠️ Dit product bestaat mogelijk al. Check bestaande producten!");
        } else {
          // De gebruiker vult een nieuw merk in, dus de waarschuwing kan weg
          setProductWarning('');
        }
      } else {
        // Productnaam is volledig nieuw, geen waarschuwing nodig
        setProductWarning('');
      }
    };

    checkProductExistence();
  }, [formProduct.naam, formProduct.merk, products]);


  // --- Effect hook voor automatisch invullen laatste aankoop ---
  useEffect(() => {
    const findLastPurchase = () => {
      const { productId, winkelId } = formAankoop;

      if (productId && winkelId) {
        const matchingPurchases = aankopen
          .map(a => a[0])
          .filter(a => String(a.productId) === productId && String(a.winkelId) === winkelId);

        if (matchingPurchases.length > 0) {
          matchingPurchases.sort((a, b) => Number(b.datum) - Number(a.datum));
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

    // Check voor een exacte duplicaat (naam + merk) bij het submitten
    const cleanNaam = formProduct.naam.trim().toLowerCase();
    const finalMerk = formProduct.merk.trim() === '' ? 'n.v.t.' : formProduct.merk;
    const cleanMerk = finalMerk.toLowerCase();

    const isExactDuplicate = products.some(product =>
      product.naam.trim().toLowerCase() === cleanNaam &&
      product.merk.trim().toLowerCase() === cleanMerk
    );

    if (isExactDuplicate) {
      if (!window.confirm("Dit product met dit merk bestaat al. Weet je zeker dat je het wilt toevoegen?")) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { naam, merk, standaardEenheid } = formProduct;
      // De finalMerk is hierboven al gedefinieerd
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

    const finalMerk = merk.trim() === '' ? 'n.v.t.' : merk;
    const isDuplicaat = products.some(product =>
      product.id !== id &&
      product.naam.trim().toLowerCase() === naam.trim().toLowerCase() &&
      product.merk.trim().toLowerCase() === finalMerk.trim().toLowerCase()
    );

    if (isDuplicaat) {
      if (!window.confirm("Dit product lijkt al te bestaan. Weet je zeker dat je het wilt bijwerken?")) {
        return;
      }
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
      setSuggestedFields(new Set());
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

  // --- FILTER LOGIC ---
  const filteredWinkels = useMemo(() => {
    return winkels.filter(w => {
      const searchTerm = winkelSearchTerm.toLowerCase();
      if (!searchTerm) return true;
      return w.naam.toLowerCase().includes(searchTerm) || w.keten.toLowerCase().includes(searchTerm);
    });
  }, [winkels, winkelSearchTerm]);

  const filteredStoreSelection = useMemo(() => {
    return winkels.filter(w => {
      const searchTerm = storeFilterSearchTerm.toLowerCase();
      if (!searchTerm) return true;
      return w.naam.toLowerCase().includes(searchTerm) || w.keten.toLowerCase().includes(searchTerm);
    });
  }, [winkels, storeFilterSearchTerm]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const searchTerm = productSearchTerm.toLowerCase();
      if (!searchTerm) return true;
      return p.naam.toLowerCase().includes(searchTerm) || p.merk.toLowerCase().includes(searchTerm);
    });
  }, [products, productSearchTerm]);

  const filteredAankopen = useMemo(() => {
    return aankopen.filter(([aankoop]) => {
      if (selectedStoreIds.size === 0) return true;
      return selectedStoreIds.has(aankoop.winkelId);
    });
  }, [aankopen, selectedStoreIds]);

  // WIJZIGING: Voegt een extra filterstap toe voor de zoekbalk in aankoopgeschiedenis
  const searchedAankopen = useMemo(() => {
    const searchTerm = aankoopSearchTerm.toLowerCase();
    if (!searchTerm) {
      return filteredAankopen;
    }
    return filteredAankopen.filter(([, prodNaam, winkelNaam]) =>
      prodNaam.toLowerCase().includes(searchTerm) ||
      winkelNaam.toLowerCase().includes(searchTerm)
    );
  }, [filteredAankopen, aankoopSearchTerm]);

  // WIJZIGING: Maak een gefilterde lijst van winkels voor het "Nieuwe aankoop" formulier.
  const filteredWinkelsForPurchaseForm = useMemo(() => {
    if (selectedStoreIds.size === 0) {
      return winkels; // Als er geen filter is, toon alle winkels.
    }
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
            <button onClick={() => {
              const allIds = new Set(winkels.map(w => w.id));
              setSelectedStoreIds(allIds);
            }} className="button-secondary">Selecteer Alles</button>
            <button onClick={() => setSelectedStoreIds(new Set())} className="button-secondary">Deselecteer Alles</button>
          </div>
          <div className="filter-controls">
            <input
              type="text"
              placeholder="Zoek winkel op naam of plaats..."
              value={storeFilterSearchTerm}
              onChange={e => setStoreFilterSearchTerm(e.target.value)}
            />
            <button onClick={() => setStoreFilterSearchTerm('')} className="button-secondary">Reset</button>
          </div>
          <div className="checkbox-grid">
            {filteredStoreSelection.slice().sort((a, b) => a.naam.localeCompare(b.naam)).map(winkel => (
              <div key={Number(winkel.id)} className="checkbox-item">
                <input
                  type="checkbox"
                  id={`store-filter-${winkel.id}`}
                  checked={selectedStoreIds.has(winkel.id)}
                  onChange={e => {
                    const newSelection = new Set(selectedStoreIds);
                    if (e.target.checked) {
                      newSelection.add(winkel.id);
                    } else {
                      newSelection.delete(winkel.id);
                    }
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
            <button type="submit" className="button-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Bezig...' : 'Voeg Winkel Toe'}
            </button>
          </form>

          <CollapsibleSection title="Bekijk Bestaande Winkels">
            <div className="filter-controls">
              <input
                type="text"
                placeholder="Zoek op naam of plaats..."
                value={winkelSearchTerm}
                onChange={e => setWinkelSearchTerm(e.target.value)}
              />
              <button onClick={() => setWinkelSearchTerm('')} className="button-secondary">Reset</button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Land</th><th>Naam</th><th>Keten</th><th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWinkels.slice().sort((a, b) => a.naam.localeCompare(b.naam)).map(w => (
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
            <input
              type="text"
              placeholder="Naam product"
              value={formProduct.naam}
              onChange={e => setFormProduct({ ...formProduct, naam: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Merk (optioneel)"
              value={formProduct.merk}
              onChange={e => setFormProduct({ ...formProduct, merk: e.target.value })}
            />
            {/* GEWIJZIGD: Dropdown toont nu iconen */}
            <select
              value={Object.keys(formProduct.standaardEenheid)[0]}
              onChange={e => {
                const newEenheid = e.target.value as typeof eenheidOptions[number];
                setFormProduct({ ...formProduct, standaardEenheid: { [newEenheid]: null } as Eenheid });
              }}
              required
            >
              {[...eenheidOptions].sort().map(key => (
                <option key={key} value={key}>
                  {`${eenheidIcons[key]} ${key.charAt(0) + key.slice(1).toLowerCase()}`}
                </option>
              ))}
            </select>

            {/* WIJZIGING: Gebruik van de nieuwe state voor de waarschuwing */}
            {productWarning && (
              <p className="warning">{productWarning}</p>
            )}

            <div className="product-preview">
              <h4>Preview:</h4>
              <p><strong>Naam:</strong> {formProduct.naam || '—'}</p>
              <p><strong>Merk:</strong> {formProduct.merk || 'n.v.t.'}</p>
              <p><strong>Eenheid:</strong> {formatEenheid(formProduct.standaardEenheid)}</p>
            </div>

            <button type="submit" className="button-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Bezig...' : 'Voeg Product Toe'}
            </button>
          </form>

          <CollapsibleSection title="Bekijk Bestaande Producten">
            <div className="filter-controls">
              <input
                type="text"
                placeholder="Zoek op naam of merk..."
                value={productSearchTerm}
                onChange={e => setProductSearchTerm(e.target.value)}
              />
              <button onClick={() => setProductSearchTerm('')} className="button-secondary">Reset</button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Naam</th><th>Merk</th><th>Eenheid</th><th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.slice().sort((a, b) => a.naam.localeCompare(b.naam)).map(p => (
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
                  // WIJZIGING: Zoek in de gefilterde lijst
                  const selectedWinkel = filteredWinkelsForPurchaseForm.find(w => `${Object.keys(w.land)[0]} - ${w.naam} (${w.keten})` === value);
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
            {/* WIJZIGING: Gebruik de gefilterde lijst voor de dropdown-opties */}
            <datalist id="winkel-options">
              {filteredWinkelsForPurchaseForm.slice().sort((a, b) => {
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
                {/* De eenheid hier zal nu ook het icoon tonen */}
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
          <h2>Beste Prijs Vinder (o.b.v. toegevoegde aankopen)</h2>
          <div className="button-group">
            <button onClick={handleFindAllBestPrices} disabled={isLoadingPrices} className="button-primary">
              {isLoadingPrices ? 'Berekenen...' : 'Ververs Prijzen'}
            </button>
            {selectedProducts.size > 0 && (
              <>
                <button onClick={handleExportSelection} className="button-success">
                  Exporteer Lijst ({selectedProducts.size})
                </button>
                <button onClick={() => setSelectedProducts(new Set())} className="button-danger">
                  Reset Selectie
                </button>
              </>
            )}
          </div>

          <CollapsibleSection title="Nederland" startOpen={true}>
            <PriceFinderTable
              countryCode="NL"
              products={products}
              bestPrices={bestPrices}
              selectedProducts={selectedProducts}
              onSelectionChange={handleSelectionChange}
              winkels={winkels}
              selectedStoreIds={selectedStoreIds}
              searchTerm={priceFinderNlSearch}
              setSearchTerm={setPriceFinderNlSearch}
            />
          </CollapsibleSection>
          <CollapsibleSection title="Spanje">
            <PriceFinderTable
              countryCode="ES"
              products={products}
              bestPrices={bestPrices}
              selectedProducts={selectedProducts}
              onSelectionChange={handleSelectionChange}
              winkels={winkels}
              selectedStoreIds={selectedStoreIds}
              searchTerm={priceFinderEsSearch}
              setSearchTerm={setPriceFinderEsSearch}
            />
          </CollapsibleSection>
        </section>

        <CollapsibleSection title="Aankopen Historie">
          {/* WIJZIGING: Zoekbalk toegevoegd */}
          <div className="filter-controls">
            <input
              type="text"
              placeholder="Zoek op product of winkel..."
              value={aankoopSearchTerm}
              onChange={e => setAankoopSearchTerm(e.target.value)}
            />
            <button onClick={() => setAankoopSearchTerm('')} className="button-secondary">Reset</button>
          </div>
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
                {/* WIJZIGING: Gebruikt de nieuwe gefilterde lijst 'searchedAankopen' */}
                {searchedAankopen.slice().sort(([a], [b]) => Number(b.datum) - Number(a.datum)).map(([aankoop, prodNaam, winkelNaam]) => {
                  const winkel = winkels.find(w => w.id === aankoop.winkelId);
                  const product = products.find(p => p.id === aankoop.productId);
                  const land = winkel ? Object.keys(winkel.land)[0] : 'n/a';
                  // De eenheid hier zal nu ook het icoon tonen
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
        </CollapsibleSection>
      </main>
    </div>
  );
}

export default App;