// src/App.tsx

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Aankoop_Database_backend as backend } from 'declarations/Aankoop_Database_backend';
import { Aankoop, BestePrijsInfo, Eenheid, Land, Product, Winkel, AllBestPricesResult } from 'declarations/Aankoop_Database_backend/Aankoop_Database_backend.did';
import './App.css';
import DashboardStats from './DashboardStats';
import Dashboard from './Dashboard';
import profanityWordList from './profanity-list.json';

// --- START: Profanity Filter Implementatie ---

/**
 * Controleert de invoer op scheldwoorden, inclusief pogingen tot omzeiling,
 * en voorkomt false positives zoals 'pikant'.
 * @param inputText De te controleren tekst.
 * @param profanitySet Een Set met scheldwoorden in kleine letters.
 * @returns {boolean} True als een scheldwoord is gevonden, anders false.
 */
const containsProfanity = (inputText: string, profanitySet: Set<string>): boolean => {
  if (!inputText) return false;

  const lowercasedText = inputText.toLowerCase();

  // --- Stap 1: Controleer op normale, volledige woorden ---
  const words = lowercasedText.replace(/[.,!?\-_]/g, ' ').split(/\s+/);
  for (const word of words) {
    if (profanitySet.has(word)) {
      return true;
    }
  }

  // --- Stap 2: Gecorrigeerde controle op bypass-pogingen (zoals l-u-l) ---
  const condensedText = lowercasedText.replace(/[^a-z]/g, '');
  if (words.includes(condensedText)) {
    return false;
  }
  if (profanitySet.has(condensedText)) {
    return true;
  }

  return false;
};

// --- EINDE: Profanity Filter Implementatie ---


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

// Type definition for the extended purchase object
type AankoopExtended = [Aankoop, string, string];

// Type to store best prices per country for a single product ID
type BestPriceByCountry = {
  NL?: BestePrijsInfo;
  ES?: BestePrijsInfo;
};

// Define Eenheid options for the dropdown menu
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

// Helper function to format units
const formatEenheid = (eenheid?: object, withIcon = true): string => {
  if (!eenheid || Object.keys(eenheid).length === 0) return '';
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
        formatEenheid(bestPriceInCountry.eenheid, false)
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
          onBlur={e => setSearchTerm(e.target.value.trimEnd())}
          maxLength={100}
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
      {finalFilteredProducts.length === 0 && (
        <p style={{ textAlign: 'center', padding: '1rem' }}>
          Geen producten gevonden die voldoen aan de zoekopdracht of de geselecteerde filters.
        </p>
      )}
    </div>
  );
};

// Component for the user manual
const UserManual = ({ onAdminLogin }: { onAdminLogin: () => void }) => (
  <CollapsibleSection title="📖 Gebruikershandleiding Boodschappen Tracker dApp 🛒">
    <div style={{ padding: '0.5rem', lineHeight: '1.6' }}>
      <p>Welkom bij de Boodschappen Tracker! Deze handleiding helpt je op weg om het maximale uit deze decentrale en collaboratieve applicatie (dApp) te halen. Samen bouwen we aan een openbare prijsdatabase!</p>
      {/* ... (rest van de handleiding blijft hetzelfde) ... */}

      <h4>Inhoudsopgave</h4>
      <ul>
        <li>Doel van de Applicatie</li>
        <li>De Kracht van Gedeelde Data</li>
        <li>Hoofdscherm & Algemene Statistieken</li>
        <li>Beheer: Winkels en Producten Toevoegen</li>
        <li>Nieuwe Aankoop / Update Toevoegen (Bijdragen aan de Database)</li>
        <li>Beste Prijs Vinder (Gebaseerd op Ieders Input)</li>
        <li>Aankopen Historie (Openbaar Logboek)</li>
        <li>Dashboard: Collectieve Inzichten</li>
        <li>Belangrijke Opmerking</li>
      </ul>

      <hr />

      <h4>Doel van de Applicatie</h4>
      <p>De Boodschappen Tracker is een <strong>openbaar en gezamenlijk platform</strong> om boodschappenprijzen te volgen. In plaats van een persoonlijke database, bouwt <strong>iedere gebruiker</strong> mee aan één centrale, openbare database. Het doel is om collectief:</p>
      <ul>
        <li>Prijzen te vergelijken tussen verschillende winkels.</li>
        <li>Prijsontwikkelingen van producten in kaart te brengen.</li>
        <li>De goedkoopste opties voor boodschappen te vinden op basis van recente, door de gemeenschap aangeleverde data.</li>
        <li>Een boodschappenlijst samen te stellen en te exporteren.</li>
      </ul>
      <p>Deze applicatie draait volledig decentraal op de <strong>Internet Computer blockchain</strong>. Dit betekent dat de data van iedereen is, transparant wordt beheerd en de applicatie stabiel en onafhankelijk draait.</p>

      <hr />

      <h4>De Kracht van Gedeelde Data</h4>
      <p>Deze applicatie is zo krachtig als de data die <strong>we met z'n allen invoeren</strong>. De waarde en nauwkeurigheid van de inzichten groeien naarmate meer mensen aankopen registreren.</p>
      <ul>
        <li><strong>Samenwerking is cruciaal:</strong> Iedere bijdrage, hoe klein ook, helpt de database nauwkeuriger te maken voor iedereen.</li>
        <li><strong>Consistentie is essentieel:</strong> Voer productnamen en merken consequent in. De app helpt hierbij door suggesties te doen en te waarschuwen voor duplicaten, wat helpt om de gedeelde database schoon te houden.</li>
        <li><strong>Geduld loont:</strong> In het begin moeten de meest voorkomende winkels en producten door de eerste gebruikers worden toegevoegd. Naarmate de database groeit, wordt het voor iedereen makkelijker om aankopen toe te voegen en de collectieve data te gebruiken voor slimmere boodschappenkeuzes.</li>
      </ul>

      <hr />

      <h4>Hoofdscherm & Algemene Statistieken</h4>
      <p>Bovenaan de pagina vind je een overzicht met kernstatistieken die een snel beeld geven van de gehele database, gevuld door alle gebruikers.</p>
      <ul>
        <li><strong>Geregistreerde Prijzen:</strong> Het totale aantal aankopen dat door de hele gemeenschap is ingevoerd.</li>
        <li><strong>Unieke Producten:</strong> Het aantal unieke producten dat in de database staat.</li>
        <li><strong>Aangemaakte Winkels:</strong> Het aantal winkels dat in de database is aangemaakt.</li>
        <li><strong>Producten met Prijsdata:</strong> Dit toont hoeveel van de aangemaakte producten ten minste één geregistreerde prijs hebben, gebaseerd op alle data.</li>
      </ul>

      <hr />

      <h4>Beheer: Winkels en Producten Toevoegen</h4>
      <p>Iedereen kan bijdragen aan de lijst van winkels en producten. Deze worden gedeeld met alle gebruikers.</p>
      <h5>Winkels Selecteren voor Focus</h5>
      <p>Met de sectie "Beheer: Selecteer Winkels" kun je de weergave in de hele applicatie filteren voor je eigen overzicht. Als je bijvoorbeeld alleen prijzen van supermarkten in Nederland wilt zien, kun je deze hier selecteren. Dit beïnvloedt de "Beste Prijs Vinder" en andere overzichten.</p>
      <h5>Winkels Toevoegen en Beheren</h5>
      <p>In de sectie "Beheer: Winkels" kan iedereen:</p>
      <ul>
        <li><strong>Een nieuwe winkel toevoegen:</strong> Vul de naam, de plaatsnaam (als 'keten'), en het land in. Deze winkel wordt dan beschikbaar voor alle gebruikers. De app blokkeert het toevoegen van een winkel die al exact zo bestaat.</li>
        <li><strong>Bestaande winkels bekijken:</strong> Je ziet een lijst van alle winkels die ooit zijn ingevoerd.</li>
        <li><strong>Wijzigen en verwijderen:</strong> Om de data-integriteit te waarborgen, kunnen winkels alleen gewijzigd (met max. 2 aankopen) of verwijderd (zonder aankopen) worden.</li>
      </ul>
      <h5>Producten Toevoegen en Beheren</h5>
      <p>In "Beheer: Producten" voeg je producten toe aan de centrale database:</p>
      <ul>
        <li><strong>Een nieuw product toevoegen:</strong> Voer de naam, het merk en de standaard eenheid in. De app waarschuwt als een product met dezelfde naam al bestaat om de gedeelde lijst zo schoon mogelijk te houden (Blijf wel altijd zelf kritisch).</li>
        <li><strong>Slimme suggesties:</strong> De app stelt automatisch een eenheid voor op basis van hoe vergelijkbare producten door andere gebruikers zijn ingevoerd (Blijf wel altijd zelf kritisch).</li>
        <li><strong>Wijzigen en verwijderen:</strong> Net als bij winkels, zijn er restricties op het aanpassen van producten om de consistentie van de openbare data te bewaren.</li>
      </ul>

      <hr />

      <h4>Nieuwe Aankoop / Update Toevoegen (Bijdragen aan de Database)</h4>
      <p>Dit is de kern van de collectieve inspanning. In deze sectie registreer je een aankoop en deel je deze prijsinformatie met iedereen. Het mag natuurlijk ook een simpele prijs update zijn als je die actief wilt toevoegen.</p>
      <ul>
        <li><strong>Product en Winkel selecteren:</strong> Kies uit de lijsten die door de gemeenschap zijn opgebouwd.</li>
        <li><strong>Automatisch invullen:</strong> De app vult de velden op basis van de <strong>laatst door énige gebruiker ingevoerde aankoop</strong> voor die product-winkelcombinatie (Blijf zelf goed controleren). Dit versnelt het invoerproces en bevordert consistentie.</li>
        <li><strong>Prijs- en Hoeveelheidvalidatie:</strong> Om de kwaliteit van de openbare data te beschermen, bevat de app slimme controles die waarschuwen of blokkeren bij onrealistische prijzen.</li>
        <li><strong>Adviesprijs, geen aanbiedingen:</strong> Voer de standaard adviesprijs in, niet de prijs van een tijdelijke aanbieding. Dit houdt de data zuiver en stelt je in staat de analyse te gebruiken om te beoordelen of een aanbieding écht een goede deal is.</li>
      </ul>

      <hr />

      <h4>Beste Prijs Vinder (Gebaseerd op Ieders Input)</h4>
      <p>Deze krachtige tool maakt gebruik van de <strong>collectieve kennis van alle gebruikers</strong>. Voor elk product toont de "Beste Prijs Vinder" de winkel waar de <strong>laatst geregistreerde laagste eenheidsprijs door iemand in de gemeenschap</strong> is betaald, opgesplitst per land.</p>
      <ul>
        <li><strong>Boodschappenlijst maken:</strong> Vink de producten aan die je nodig hebt.</li>
        <li><strong>Exporteren:</strong> Klik op "Exporteer Lijst" om een overzichtelijke boodschappenlijst te genereren, gegroepeerd per winkel, gebaseerd op de collectieve prijsdata.</li>
      </ul>

      <hr />

      <h4>Aankopen Historie (Openbaar Logboek)</h4>
      <p>In deze sectie vind je een <strong>openbaar en transparant overzicht</strong> van alle aankopen / registraties die door alle gebruikers zijn ingevoerd, gesorteerd op datum (nieuwste eerst). Een invoer kan alleen binnen 5 minuten worden verwijderd om de data-integriteit te waarborgen.</p>

      <hr />

      <h4>Dashboard: Collectieve Inzichten</h4>
      <p>Het Dashboard visualiseert de data van de <strong>gehele gemeenschap</strong>. Deze widgets worden krachtiger naarmate er meer data wordt ingevoerd.</p>
      <ul>
        <li><strong>Prijsontwikkeling Producten per Winkel:</strong> Toont de procentuele prijsverandering van een product in een winkel, berekend op basis van de eerste en laatste aankoop die ooit door iemand zijn ingevoerd in de database.</li>
        <li><strong>Goedkoopste Winkels per Product:</strong> Vergelijkt de meest recente eenheidsprijzen van een product over verschillende winkels, gebaseerd op de laatste invoer van alle gebruikers. Dit geeft een actueel beeld van waar producten het voordeligst zijn dankzij de inspanningen van de gemeenschap.</li>
      </ul>

      <hr />

      <h4>Belangrijke Opmerking</h4>
      <p>Alle berekeningen, vergelijkingen en "beste prijs"-aanbevelingen zijn <strong>uitsluitend gebaseerd op de data die door alle gebruikers gezamenlijk is ingevoerd</strong>. De getoonde prijzen zijn dus niet gegarandeerd de actuele prijzen in de winkel, maar een afspiegeling van de door de gemeenschap geregistreerde aankoopgeschiedenis. De kwaliteit van de inzichten is een directe reflectie van de nauwkeurigheid en volledigheid van ieders bijdrage.</p>

      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button onClick={onAdminLogin} className="button-secondary">Admin Login</button>
      </div>
    </div>
  </CollapsibleSection>
);

// Component for the donation section
const DonationSection = () => {
  const donationLinks = {
    1: 'https://www.ing.nl/payreq/m/?trxid=3NQCaQu9RYj5QICQRUnUeSLM36cekNSO',
    2: 'https://www.ing.nl/payreq/m/?trxid=YJSv7nrbs6WGQiTHifTJtjhP2TtB1UbP',
    5: 'https://www.ing.nl/payreq/m/?trxid=Vi9O4QBqTgXnIV2td9BXsWyPvCmLqjSx',
    10: 'https://www.ing.nl/payreq/m/?trxid=sG9PgoUdIayPUgEYOTtIJsEyohC20Xl8',
    25: 'https://www.ing.nl/payreq/m/?trxid=WLefV0dvtBr4kkyD7ao299y9WKyTXOt1',
  };

  return (
    <CollapsibleSection title="Ondersteun de Applicatie met een donatie ❤️">
      <div style={{ padding: '0.5rem', lineHeight: '1.6' }}>
        <h4>Ondersteun deze Decentrale Applicatie</h4>
        <p>
          Bedankt dat je gebruikmaakt van de Boodschappen Tracker!
        </p>
        <p>
          Deze applicatie is anders dan de meeste apps: hij draait volledig decentraal op de <strong>Internet Computer blockchain</strong>. Dit betekent dat er geen centrale servers van een groot bedrijf zijn en de applicatie stabiel zal draaien on chain.
        </p>
        <p>
          Er zitten behoorlijk wat development uren in deze dapp en om de dapp draaiende te houden is rekenkracht nodig welke niet gratis is. Als je de meerwaarde van de applicatie waardeert ben ik je ontzettend dankbaar voor je bijdrage.
        </p>
        <p>
          Elke bijdrage wordt enorm gewaardeerd en helpt om de applicatie draaiend te houden.
        </p>
        <p><strong>Hartelijk dank voor je steun!</strong></p>

        <div className="button-group" style={{ marginTop: '1.5rem', justifyContent: 'center' }}>
          {Object.entries(donationLinks).map(([amount, link]) => (
            <button key={amount} className="button-primary" onClick={() => window.open(link, '_blank')}>
              €{amount}
            </button>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
};

// Admin banner component
const AdminBanner = ({ onLogout }: { onLogout: () => void }) => (
  <div className="admin-banner">
    <span>🛡️ Admin Modus Actief</span>
    <button onClick={onLogout} className="button-danger">Logout</button>
  </div>
);


const DEVIATION_WARNING_THRESHOLD = 50;
const DEVIATION_BLOCK_THRESHOLD = 200;
const MIN_PURCHASES_FOR_AVERAGE = 2;

const ABSOLUTE_PRICE_THRESHOLDS: Record<string, number> = {
  KILOGRAM: 100,
  LITER: 80,
  STUK: 50,
  METER: 50,
  ROL: 25,
  TABLET: 25,
};

const ABSOLUTE_MIN_PRICE_THRESHOLDS: Record<string, number> = {
  KILOGRAM: 0.10,
  LITER: 0.10,
  STUK: 0.05,
  METER: 0.10,
  ROL: 0.10,
  TABLET: 0.05,
};

function App() {
  // Gebruik useMemo om de profanity Set eenmalig aan te maken voor optimale performance.
  const profanitySet = useMemo(() => new Set(profanityWordList), []);

  const [winkels, setWinkels] = useState<Winkel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [aankopen, setAankopen] = useState<AankoopExtended[]>([]);
  const [bestPrices, setBestPrices] = useState<Map<bigint, BestPriceByCountry>>(new Map());

  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<bigint | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<bigint | null>(null);

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [exportWithDescription, setExportWithDescription] = useState(false);

  // --- START: Admin Mode State ---
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminPassword, setAdminPassword] = useState<[string] | []>([]); // Use array for optional param
  // --- END: Admin Mode State ---

  const [winkelSearchTerm, setWinkelSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [aankoopSearchTerm, setAankoopSearchTerm] = useState('');
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<bigint>>(new Set());
  const [storeFilterSearchTerm, setStoreFilterSearchTerm] = useState('');
  const [priceFinderNlSearch, setPriceFinderNlSearch] = useState('');
  const [priceFinderEsSearch, setPriceFinderEsSearch] = useState('');

  const [formWinkel, setFormWinkel] = useState({ naam: '', keten: '', land: { NL: null } as Land });
  const [formProduct, setFormProduct] = useState({ naam: '', merk: '', standaardEenheid: {} as Eenheid });
  const [formAankoop, setFormAankoop] = useState({ productId: '', winkelId: '', bonOmschrijving: '', prijs: '', hoeveelheid: '' });

  const [productSearch, setProductSearch] = useState('');
  const [winkelSearch, setWinkelSearch] = useState('');

  const [suggestedFields, setSuggestedFields] = useState<Set<string>>(new Set());

  const [editingWinkelId, setEditingWinkelId] = useState<bigint | null>(null);
  const [editingWinkelData, setEditingWinkelData] = useState<Omit<Winkel, 'id'>>({ naam: '', keten: '', land: { NL: null } });

  const [editingProductId, setEditingProductId] = useState<bigint | null>(null);
  const [editingProductData, setEditingProductData] = useState<Omit<Product, 'id' | 'trefwoorden'> & { trefwoorden: string }>({ naam: '', merk: '', trefwoorden: '', standaardEenheid: { STUK: null } });

  const [productWarning, setProductWarning] = useState<string>('');
  const [winkelWarning, setWinkelWarning] = useState<string>('');
  const [isWinkelDuplicate, setIsWinkelDuplicate] = useState<boolean>(false);
  const [isWinkelSimilar, setIsWinkelSimilar] = useState<boolean>(false);
  const [priceWarning, setPriceWarning] = useState<string>('');
  const [isSubmissionBlocked, setIsSubmissionBlocked] = useState<boolean>(false);

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const handleAdminLogin = () => {
    const pass = window.prompt("Voer het admin-wachtwoord in:");
    if (pass === "172638421") {
      setIsAdmin(true);
      setAdminPassword([pass]);
      alert("Admin-modus geactiveerd.");
    } else if (pass) {
      alert("Incorrect wachtwoord.");
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setAdminPassword([]);
    alert("Admin-modus gedeactiveerd.");
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (containsProfanity(value, profanitySet) && !isAdmin) { // Admin mag scheldwoorden gebruiken
      setFormErrors(prev => ({ ...prev, [name]: 'Ongepast taalgebruik is niet toegestaan.' }));
    } else {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const hasWinkelFormErrors = !!(formErrors.winkelNaam || formErrors.winkelKeten);
  const hasProductFormErrors = !!(formErrors.productNaam || formErrors.productMerk);
  const hasAankoopFormErrors = !!formErrors.bonOmschrijving;

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

  const sortWinkels = (a: Winkel, b: Winkel) => {
    const landA = Object.keys(a.land)[0];
    const landB = Object.keys(b.land)[0];
    if (landA < landB) return -1;
    if (landA > landB) return 1;
    return a.naam.localeCompare(b.naam);
  };

  useEffect(() => {
    const checkWinkelExistence = () => {
      const cleanNaam = formWinkel.naam.trim().toLowerCase();
      const cleanKeten = formWinkel.keten.trim().toLowerCase();

      if (!cleanNaam || !cleanKeten) {
        setWinkelWarning('');
        setIsWinkelDuplicate(false);
        setIsWinkelSimilar(false); // Reset hier ook
        return;
      }

      const exactMatch = winkels.some(w =>
        w.naam.trim().toLowerCase() === cleanNaam &&
        w.keten.trim().toLowerCase() === cleanKeten
      );

      if (exactMatch) {
        setWinkelWarning('FOUT: Deze winkel bestaat al. Toevoegen is niet mogelijk.');
        setIsWinkelDuplicate(true);
        setIsWinkelSimilar(false); // Het is een exacte match, geen vergelijkbare
        return;
      }

      const similarMatch = winkels.some(w =>
        w.naam.trim().toLowerCase() === cleanNaam ||
        w.keten.trim().toLowerCase() === cleanKeten
      );

      if (similarMatch) {
        setWinkelWarning('⚠️ Deze winkel lijkt al te bestaan. Controleer de lijst voordat je hem toevoegt.');
        setIsWinkelSimilar(true); // Stel de nieuwe state in
      } else {
        setWinkelWarning('');
        setIsWinkelSimilar(false); // Reset als er geen vergelijkbare match is
      }
      setIsWinkelDuplicate(false); // Dit blijft false, want het is geen exacte match
    };

    checkWinkelExistence();
  }, [formWinkel.naam, formWinkel.keten, winkels]);

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
          setProductWarning(`⚠️ Dit product lijkt sterk op "${p.naam}". Controleer bestaande producten voordat je het toevoegt.`);
          return;
        }
      }
      setProductWarning('');
    };
    checkProductExistence();
  }, [formProduct.naam, products]);

  useEffect(() => {
    const suggestEenheid = () => {
      const inputNaam = formProduct.naam.trim().toLowerCase();

      if (inputNaam.length < 3) {
        if (suggestedFields.has('standaardEenheid')) {
          setFormProduct(prev => ({ ...prev, standaardEenheid: {} as Eenheid }));
          const newSuggestions = new Set(suggestedFields);
          newSuggestions.delete('standaardEenheid');
          setSuggestedFields(newSuggestions);
        }
        return;
      }

      if (Object.keys(formProduct.standaardEenheid).length > 0) {
        return;
      }

      const inputWords = new Set(inputNaam.split(' ').filter(w => w.length > 2));
      for (const p of products) {
        const existingWords = p.naam.trim().toLowerCase().split(' ');
        for (const word of existingWords) {
          if (inputWords.has(word)) {
            setFormProduct(prev => ({ ...prev, standaardEenheid: p.standaardEenheid }));
            setSuggestedFields(prev => new Set(prev).add('standaardEenheid'));
            return;
          }
        }
      }
    };
    suggestEenheid();
  }, [formProduct.naam, products, formProduct.standaardEenheid, suggestedFields]);

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

  useEffect(() => {
    if (isAdmin) { // Sla prijscontroles over voor admin
        setPriceWarning('');
        setIsSubmissionBlocked(false);
        return;
    }
    
    const { productId, prijs, hoeveelheid } = formAankoop;
    const priceNum = parseFloat(prijs);
    const qtyNum = parseFloat(hoeveelheid);

    if (!productId || !prijs || !hoeveelheid || isNaN(priceNum) || isNaN(qtyNum) || qtyNum <= 0) {
      setPriceWarning('');
      setIsSubmissionBlocked(false);
      return;
    }

    const selectedProd = products.find(p => p.id === BigInt(productId));
    if (!selectedProd) return;

    const historicalPurchases = aankopen
      .map(a => a[0])
      .filter(a => a.productId === BigInt(productId));

    const newUnitPrice = priceNum / qtyNum;

    if (historicalPurchases.length >= MIN_PURCHASES_FOR_AVERAGE) {
      const unitPrices = historicalPurchases.map(a => a.prijs / a.hoeveelheid);
      const averageUnitPrice = unitPrices.reduce((sum, p) => sum + p, 0) / unitPrices.length;

      const deviation = Math.abs((newUnitPrice - averageUnitPrice) / averageUnitPrice) * 100;

      if (deviation > DEVIATION_BLOCK_THRESHOLD) {
        setPriceWarning(`FOUT: Prijs per eenheid (€${newUnitPrice.toFixed(2)}) wijkt meer dan ${DEVIATION_BLOCK_THRESHOLD}% af van het gemiddelde (€${averageUnitPrice.toFixed(2)}).`);
        setIsSubmissionBlocked(true);
      } else if (deviation > DEVIATION_WARNING_THRESHOLD) {
        setPriceWarning(`WAARSCHUWING: Prijs per eenheid (€${newUnitPrice.toFixed(2)}) wijkt meer dan ${DEVIATION_WARNING_THRESHOLD}% af van het gemiddelde (€${averageUnitPrice.toFixed(2)}).`);
        setIsSubmissionBlocked(false);
      } else {
        setPriceWarning('');
        setIsSubmissionBlocked(false);
      }
    }
    else {
      const unit = Object.keys(selectedProd.standaardEenheid)[0];
      let standardizedPrice = newUnitPrice;
      let standardizedUnit = unit;

      if (unit === 'GRAM') {
        standardizedPrice *= 1000;
        standardizedUnit = 'KILOGRAM';
      } else if (unit === 'MILLILITER') {
        standardizedPrice *= 1000;
        standardizedUnit = 'LITER';
      }

      const maxThreshold = ABSOLUTE_PRICE_THRESHOLDS[standardizedUnit];
      const minThreshold = ABSOLUTE_MIN_PRICE_THRESHOLDS[standardizedUnit];

      if (maxThreshold && standardizedPrice > maxThreshold) {
        setPriceWarning(`WAARSCHUWING: De prijs (€${standardizedPrice.toFixed(2)} per ${standardizedUnit.toLowerCase()}) lijkt ongebruikelijk hoog. Klopt dit?`);
        setIsSubmissionBlocked(false);
      }
      else if (minThreshold && standardizedPrice > 0 && standardizedPrice < minThreshold) {
        setPriceWarning(`WAARSCHUWING: De prijs (€${standardizedPrice.toFixed(2)} per ${standardizedUnit.toLowerCase()}) lijkt ongebruikelijk laag. Klopt dit?`);
        setIsSubmissionBlocked(false);
      }
      else {
        setPriceWarning('');
        setIsSubmissionBlocked(false);
      }
    }
  }, [formAankoop.productId, formAankoop.prijs, formAankoop.hoeveelheid, aankopen, products, isAdmin]);

  const handleAddWinkel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasWinkelFormErrors || (isWinkelDuplicate && !isAdmin)) {
      alert("Los eerst de validatiefouten op.");
      return;
    }

    if (isWinkelSimilar && !isAdmin) {
      if (!window.confirm("Deze winkel lijkt al te bestaan. Weet u zeker dat u deze wilt toevoegen?")) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await backend.addWinkel(formWinkel.naam.trim(), formWinkel.keten.trim(), formWinkel.land);
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
    if (window.confirm("Weet je zeker dat je deze winkel wilt verwijderen? Dit kan niet ongedaan worden gemaakt.")) {
      setDeletingItemId(id);
      try {
        const result = await backend.deleteWinkel(id, adminPassword);
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
      // @ts-ignore: Adding optional parameter for admin password
      await backend.updateWinkel(id, naam.trim(), keten.trim(), land, adminPassword);
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
    if (hasProductFormErrors) {
      alert("Los eerst de validatiefouten op.");
      return;
    }
    if (Object.keys(formProduct.standaardEenheid).length === 0) {
      alert("Selecteer een eenheid voor het product.");
      return;
    }

    const cleanNaam = formProduct.naam.trim().toLowerCase();
    const finalMerk = formProduct.merk.trim() === '' ? 'n.v.t.' : formProduct.merk.trim();
    const cleanMerk = finalMerk.toLowerCase();
    const newUnitKey = Object.keys(formProduct.standaardEenheid)[0];

    const isDuplicate = products.some(p =>
      p.naam.trim().toLowerCase() === cleanNaam &&
      p.merk.trim().toLowerCase() === cleanMerk &&
      Object.keys(p.standaardEenheid)[0] === newUnitKey
    );

    if (isDuplicate && !isAdmin) {
      alert("Een product met deze exacte naam, merk en eenheid bestaat al. Toevoegen is niet toegestaan.");
      return;
    }

    if (products.some(p => p.naam.trim().toLowerCase() === cleanNaam && p.merk.trim().toLowerCase() === cleanMerk) && !isAdmin) {
      if (!window.confirm("Dit product met dit merk (maar een andere eenheid) bestaat al. Toch toevoegen?")) return;
    }

    setIsSubmitting(true);
    try {
      await backend.addProduct(formProduct.naam.trim(), finalMerk, ['n.v.t.'], formProduct.standaardEenheid);
      alert("Product toegevoegd!");
      setFormProduct({ naam: '', merk: '', standaardEenheid: {} as Eenheid });
      setProductSearchTerm('');
      fetchAllData();
    } catch (error) {
      alert("Fout bij toevoegen product.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: bigint) => {
    if (window.confirm("Weet je zeker dat je dit product wilt verwijderen? Dit kan niet ongedaan worden gemaakt.")) {
      setDeletingItemId(id);
      try {
        const result = await backend.deleteProduct(id, adminPassword);
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
    const purchaseCount = aankopen.filter(([a]) => a.productId === id).length;
    if (purchaseCount > 2 && !isAdmin) {
      alert("Product kan niet gewijzigd worden met meer dan 2 aankopen.");
      return;
    }
    const { naam, merk, trefwoorden, standaardEenheid } = editingProductData;
    const finalMerk = merk.trim() === '' ? 'n.v.t.' : merk.trim();
    if (products.some(p => p.id !== id && p.naam.trim().toLowerCase() === naam.trim().toLowerCase() && p.merk.trim().toLowerCase() === finalMerk.toLowerCase()) && !isAdmin) {
      if (!window.confirm("Dit product lijkt al te bestaan. Toch bijwerken?")) return;
    }
    setUpdatingItemId(id);
    try {
      const trefwoordenArray = trefwoorden.split(',').map(t => t.trim()).filter(Boolean);
      // @ts-ignore: Adding optional parameter for admin password
      await backend.updateProduct(id, naam.trim(), finalMerk, trefwoordenArray, standaardEenheid, adminPassword);
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
    if (hasAankoopFormErrors) {
      alert("Los eerst de validatiefouten op.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { productId, winkelId, bonOmschrijving, prijs, hoeveelheid } = formAankoop;
      await backend.addAankoop(BigInt(productId), BigInt(winkelId), bonOmschrijving.trim(), parseFloat(prijs), parseFloat(hoeveelheid));
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
    if (window.confirm("Weet je zeker dat je deze aankoop wilt verwijderen?")) {
      setDeletingItemId(id);
      try {
        const result = await backend.deleteAankoop(id, adminPassword);
         if ('ok' in result) {
          alert("Aankoop verwijderd.");
          fetchAllData();
        } else {
          alert(`Fout: ${result.err}`);
        }
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
    sortedSelection.forEach(({ product, priceInfo, country }) => {
      const winkelNaam = priceInfo?.winkelNaam;
      if (winkelNaam && winkelNaam !== currentWinkel) {
        currentWinkel = winkelNaam;
        exportText += `\n--- ${currentWinkel} ---\n`;
      }

      let bonOmschrijving = '';
      if (exportWithDescription && priceInfo) {
        const winkel = winkels.find(w => w.naam === priceInfo.winkelNaam && Object.keys(w.land)[0] === country.toUpperCase());
        if (winkel) {
          const latestPurchase = aankopen
            .map(a => a[0])
            .filter(a => a.productId === product.id && a.winkelId === winkel.id)
            .sort((a, b) => Number(b.datum) - Number(a.datum))[0];
          if (latestPurchase) {
            bonOmschrijving = ` (${latestPurchase.bonOmschrijving})`;
          }
        }
      }

      let priceString = '';
      if (priceInfo) {
        const unitKey = Object.keys(priceInfo.eenheid)[0];
        const originalPrice = priceInfo.eenheidsprijs;

        if (unitKey === 'GRAM') {
          const pricePerKg = originalPrice * 1000;
          priceString = ` - €${pricePerKg.toFixed(2)} per kg`;
        } else if (unitKey === 'MILLILITER') {
          const pricePerLiter = originalPrice * 1000;
          priceString = ` - €${pricePerLiter.toFixed(2)} per liter`;
        } else {
          priceString = ` - €${originalPrice.toFixed(2)} ${formatEenheid(priceInfo.eenheid)}`;
        }
      }

      exportText += `- ${product.naam} (${product.merk})${bonOmschrijving}${priceString}\n`;
    });

    navigator.clipboard.writeText(exportText).then(() => {
      alert("Boodschappenlijst gekopieerd naar klembord!");
    }).catch(err => {
      alert("Kopiëren mislukt.");
      console.error(err);
    });
  };

  const getVisibleProductsForSelectAll = (countryCode: 'NL' | 'ES', searchTerm: string) => {
    const displayable = products.filter(p => {
      const bestPriceInCountry = bestPrices.get(p.id)?.[countryCode];
      if (!bestPriceInCountry) return false;
      const winkelOfBestPrice = winkels.find(w => w.naam === bestPriceInCountry.winkelNaam && Object.keys(w.land)[0] === countryCode);
      return selectedStoreIds.size === 0 || (winkelOfBestPrice && selectedStoreIds.has(winkelOfBestPrice.id));
    });

    const lowerCaseSearchTerms = searchTerm.toLowerCase().split(' ').filter(Boolean);
    if (lowerCaseSearchTerms.length === 0) return displayable;

    return displayable.filter(p => {
      const bestPriceInCountry = bestPrices.get(p.id)?.[countryCode];
      if (!bestPriceInCountry) return false;
      const searchableText = [
        p.naam, p.merk, bestPriceInCountry.winkelNaam,
        `€${bestPriceInCountry.eenheidsprijs.toFixed(2)}`,
        formatEenheid(bestPriceInCountry.eenheid, false)
      ].join(' ').toLowerCase();
      return lowerCaseSearchTerms.every(term => searchableText.includes(term));
    });
  };

  const handleSelectAll = () => {
    const hasNlSelection = [...selectedProducts].some(id => id.endsWith('-NL'));
    const hasEsSelection = [...selectedProducts].some(id => id.endsWith('-ES'));

    const newSelection = new Set(selectedProducts);

    if (hasNlSelection) {
      const visibleNl = getVisibleProductsForSelectAll('NL', priceFinderNlSearch);
      visibleNl.forEach(p => newSelection.add(`${p.id}-NL`));
    }

    if (hasEsSelection) {
      const visibleEs = getVisibleProductsForSelectAll('ES', priceFinderEsSearch);
      visibleEs.forEach(p => newSelection.add(`${p.id}-ES`));
    }

    setSelectedProducts(newSelection);
  };


  const filteredStoreSelection = useMemo(() => {
    const lowerCaseSearchTerms = storeFilterSearchTerm.toLowerCase().split(' ').filter(Boolean);
    if (lowerCaseSearchTerms.length === 0) return winkels;
    return winkels.filter(w => {
      const searchableText = [w.naam, w.keten, Object.keys(w.land)[0]].join(' ').toLowerCase();
      return lowerCaseSearchTerms.every(term => searchableText.includes(term));
    });
  }, [winkels, storeFilterSearchTerm]);

  const filteredAndSelectedWinkels = useMemo(() => {
    const baseList = selectedStoreIds.size > 0
      ? winkels.filter(w => selectedStoreIds.has(w.id))
      : winkels;

    const lowerCaseSearchTerms = winkelSearchTerm.toLowerCase().split(' ').filter(Boolean);
    if (lowerCaseSearchTerms.length === 0) return baseList;

    return baseList.filter(w => {
      const searchableText = [w.naam, w.keten, Object.keys(w.land)[0]].join(' ').toLowerCase();
      return lowerCaseSearchTerms.every(term => searchableText.includes(term));
    });
  }, [winkels, selectedStoreIds, winkelSearchTerm]);

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

  const searchedAankopen = useMemo(() => {
    const lowerCaseSearchTerms = aankoopSearchTerm.toLowerCase().split(' ').filter(Boolean);
    if (lowerCaseSearchTerms.length === 0) return filteredAankopenByStore;

    return filteredAankopenByStore.filter(([aankoop, prodNaam, winkelNaam]) => {
      const winkel = winkels.find(w => w.id === aankoop.winkelId);
      const product = products.find(p => p.id === aankoop.productId);

      const searchableText = [
        prodNaam,
        aankoop.bonOmschrijving,
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
      <header className={`app-header ${isAdmin ? 'admin-mode' : ''}`}>
        <h1>🛒 Boodschappen Tracker</h1>
      </header>
      
      {isAdmin && <AdminBanner onLogout={handleAdminLogout} />}

      <DashboardStats
        aankopenCount={aankopen.length}
        productsCount={products.length}
        winkelsCount={winkels.length}
        bestPrices={bestPrices}
      />

      <DonationSection />

      <UserManual onAdminLogin={handleAdminLogin} />

      <main>
        <CollapsibleSection title="Beheer: Selecteer Winkels">
          <div className="button-group" style={{ marginBottom: '1rem' }}>
            <button onClick={() => setSelectedStoreIds(new Set(winkels.map(w => w.id)))} className="button-secondary">Selecteer Alles</button>
            <button
              onClick={() => setSelectedStoreIds(prev => new Set([...prev, ...filteredStoreSelection.map(w => w.id)]))}
              className="button-secondary"
            >
              Voeg Gevonden Toe
            </button>
            <button
              onClick={() => {
                const newSelection = new Set(selectedStoreIds);
                filteredStoreSelection.forEach(w => newSelection.delete(w.id));
                setSelectedStoreIds(newSelection);
              }}
              className="button-secondary"
            >
              Verwijder Gevonden
            </button>
            <button onClick={() => setSelectedStoreIds(new Set())} className="button-secondary">Deselecteer Alles</button>
          </div>
          <div className="filter-controls">
            <input
              type="text"
              placeholder="Zoek winkel op naam, plaats of land..."
              value={storeFilterSearchTerm}
              onChange={e => setStoreFilterSearchTerm(e.target.value)}
              onBlur={e => setStoreFilterSearchTerm(e.target.value.trimEnd())}
              maxLength={100}
            />
            <button onClick={() => setStoreFilterSearchTerm('')} className="button-secondary">Reset</button>
          </div>
          <p className="filter-info">{selectedStoreIds.size} van de {winkels.length} winkels geselecteerd.</p>
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
        </CollapsibleSection>

        <CollapsibleSection title="Beheer: Winkels">
          <form onSubmit={handleAddWinkel} className="form-grid">
            <div className="form-field-vertical">
              <input
                name="winkelNaam"
                type="text"
                placeholder="Naam winkel"
                value={formWinkel.naam}
                onChange={e => setFormWinkel({ ...formWinkel, naam: e.target.value })}
                onBlur={e => {
                  handleBlur(e);
                  setFormWinkel(current => ({ ...current, naam: current.naam.trimEnd() }));
                }}
                className={formErrors.winkelNaam ? 'input-error' : ''}
                required
                maxLength={100}
              />
              {formErrors.winkelNaam && <p className="error-text">{formErrors.winkelNaam}</p>}
            </div>
            <div className="form-field-vertical">
              <input
                name="winkelKeten"
                type="text"
                placeholder="Plaatsnaam"
                value={formWinkel.keten}
                onChange={e => setFormWinkel({ ...formWinkel, keten: e.target.value })}
                onBlur={e => {
                  handleBlur(e);
                  setFormWinkel(current => ({ ...current, keten: current.keten.trimEnd() }));
                }}
                className={formErrors.winkelKeten ? 'input-error' : ''}
                required
                maxLength={100}
              />
              {formErrors.winkelKeten && <p className="error-text">{formErrors.winkelKeten}</p>}
            </div>
            <select value={Object.keys(formWinkel.land)[0]} onChange={e => setFormWinkel({ ...formWinkel, land: { [e.target.value]: null } as Land })} required>
              <option value="NL">Nederland</option>
              <option value="ES">Spanje</option>
            </select>
            <button type="submit" className="button-primary" disabled={isSubmitting || hasWinkelFormErrors || isWinkelDuplicate}>{isSubmitting ? 'Bezig...' : 'Voeg Winkel Toe'}</button>
            {winkelWarning && (
              <p className={`warning ${isWinkelDuplicate ? 'error-text' : ''}`} style={{ gridColumn: '1 / -1', margin: 0 }}>
                {winkelWarning}
              </p>
            )}
          </form>

          <CollapsibleSection title="Bekijk Bestaande Winkels">
            <div className="filter-controls">
              <input type="text" placeholder="Zoek op naam, plaats of land..." value={winkelSearchTerm} onChange={e => setWinkelSearchTerm(e.target.value)} onBlur={e => setWinkelSearchTerm(e.target.value.trimEnd())} maxLength={100} />
              <button onClick={() => setWinkelSearchTerm('')} className="button-secondary">Reset</button>
            </div>
            <div className="table-container">
              <table>
                <thead><tr><th>Land</th><th>Naam</th><th>Keten</th><th>Acties</th></tr></thead>
                <tbody>
                  {filteredAndSelectedWinkels.slice().sort(sortWinkels).map(w => {
                    const purchaseCount = aankopen.filter(([a]) => a.winkelId === w.id).length;
                    return (
                      <tr key={Number(w.id)}>
                        {editingWinkelId === w.id ? (
                          <>
                            <td data-label="Land"><select value={Object.keys(editingWinkelData.land)[0]} onChange={e => setEditingWinkelData({ ...editingWinkelData, land: { [e.target.value]: null } as Land })}><option value="NL">NL</option><option value="ES">ES</option></select></td>
                            <td data-label="Naam"><input type="text" value={editingWinkelData.naam} onChange={e => setEditingWinkelData({ ...editingWinkelData, naam: e.target.value })} onBlur={e => setEditingWinkelData(d => ({ ...d, naam: e.target.value.trimEnd() }))} maxLength={100} /></td>
                            <td data-label="Keten"><input type="text" value={editingWinkelData.keten} onChange={e => setEditingWinkelData({ ...editingWinkelData, keten: e.target.value })} onBlur={e => setEditingWinkelData(d => ({ ...d, keten: e.target.value.trimEnd() }))} maxLength={100} /></td>
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
                              <button onClick={() => startEditingWinkel(w)} className="button-secondary" disabled={!isAdmin && purchaseCount > 2} title={!isAdmin && purchaseCount > 2 ? "Kan niet wijzigen met >2 aankopen" : ""}>Wijzig</button>
                              <button onClick={() => handleDeleteWinkel(w.id)} className="button-danger" disabled={deletingItemId === w.id}>{deletingItemId === w.id ? '...' : 'Verwijder'}</button>
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        </CollapsibleSection>

        <CollapsibleSection title="Beheer: Producten">
          <form onSubmit={handleAddProduct} className="form-grid">
            <div className="form-field-vertical">
              <input
                name="productNaam"
                type="text"
                placeholder="Naam product"
                value={formProduct.naam}
                onChange={e => {
                  const value = e.target.value;
                  setFormProduct({ ...formProduct, naam: value });
                  setProductSearchTerm(value);
                }}
                onBlur={e => {
                  handleBlur(e);
                  const trimmedValue = e.target.value.trimEnd();
                  setFormProduct(current => ({ ...current, naam: trimmedValue }));
                  setProductSearchTerm(trimmedValue);
                }}
                className={formErrors.productNaam ? 'input-error' : ''}
                required
                maxLength={100}
              />
              {formErrors.productNaam && <p className="error-text">{formErrors.productNaam}</p>}
            </div>
            <div className="form-field-vertical">
              <input
                name="productMerk"
                type="text"
                placeholder="Merk (optioneel)"
                value={formProduct.merk}
                onChange={e => setFormProduct({ ...formProduct, merk: e.target.value })}
                onBlur={e => {
                  handleBlur(e);
                  setFormProduct(current => ({ ...current, merk: current.merk.trimEnd() }));
                }}
                className={formErrors.productMerk ? 'input-error' : ''}
                maxLength={100}
              />
              {formErrors.productMerk && <p className="error-text">{formErrors.productMerk}</p>}
            </div>
            <select
              value={Object.keys(formProduct.standaardEenheid)[0] || ''}
              onChange={e => {
                if (suggestedFields.has('standaardEenheid')) {
                  const newSuggestions = new Set(suggestedFields);
                  newSuggestions.delete('standaardEenheid');
                  setSuggestedFields(newSuggestions);
                }
                setFormProduct({ ...formProduct, standaardEenheid: { [e.target.value as typeof eenheidOptions[number]]: null } as Eenheid })
              }}
              required
              className={suggestedFields.has('standaardEenheid') ? 'suggested-input' : ''}
            >
              <option value="" disabled>-- Selecteer Eenheid --</option>
              {[...eenheidOptions].sort().map(key => (<option key={key} value={key}>{`${eenheidIcons[key]} ${key.charAt(0) + key.slice(1).toLowerCase()}`}</option>))}
            </select>
            {productWarning && (<p className="warning">{productWarning}</p>)}
            <div className="product-preview">
              <h4>Preview:</h4>
              <p><strong>Naam:</strong> {formProduct.naam || '—'}</p>
              <p><strong>Merk:</strong> {formProduct.merk || 'n.v.t.'}</p>
              <p><strong>Eenheid:</strong> {formatEenheid(formProduct.standaardEenheid) || '—'}</p>
            </div>
            <button type="submit" className="button-primary" disabled={isSubmitting || hasProductFormErrors}>{isSubmitting ? 'Bezig...' : 'Voeg Product Toe'}</button>
          </form>

          <CollapsibleSection title="Bekijk Bestaande Producten">
            <div className="filter-controls">
              <input type="text" placeholder="Zoek op naam, merk of eenheid..." value={productSearchTerm} onChange={e => setProductSearchTerm(e.target.value)} onBlur={e => setProductSearchTerm(e.target.value.trimEnd())} maxLength={100} />
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
                            <td data-label="Naam"><input type="text" value={editingProductData.naam} onChange={e => setEditingProductData({ ...editingProductData, naam: e.target.value })} onBlur={e => setEditingProductData(d => ({ ...d, naam: e.target.value.trimEnd() }))} maxLength={100} /></td>
                            <td data-label="Merk"><input type="text" placeholder="Merk (optioneel)" value={editingProductData.merk} onChange={e => setEditingProductData({ ...editingProductData, merk: e.target.value })} onBlur={e => setEditingProductData(d => ({ ...d, merk: e.target.value.trimEnd() }))} maxLength={100} /></td>
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
                              <button onClick={() => startEditingProduct(p)} className="button-secondary" disabled={!isAdmin && purchaseCount > 2} title={!isAdmin && purchaseCount > 2 ? "Kan niet wijzigen met >2 aankopen" : ""}>Wijzig</button>
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

        <CollapsibleSection title="Nieuwe Aankoop / Update Toevoegen">
          <form onSubmit={handleAddAankoop} className="form-grid">
            <div className="form-field">
              <label htmlFor="product-select">Product:</label>
              <input id="product-select" list="product-options" value={productSearch} onChange={e => {
                const value = e.target.value;
                setProductSearch(value);
                const selectedProd = products.find(p => `${p.naam} (${p.merk})` === value);
                setPriceWarning('');
                setIsSubmissionBlocked(false);
                setSuggestedFields(new Set());
                setFormAankoop(prev => ({ ...prev, productId: selectedProd ? String(selectedProd.id) : '', bonOmschrijving: '', prijs: '', hoeveelheid: '' }));
              }}
                onBlur={e => setProductSearch(e.target.value.trimEnd())}
                placeholder="-- Selecteer Product --" required maxLength={100} />
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
                setPriceWarning('');
                setIsSubmissionBlocked(false);
                setSuggestedFields(new Set());
                setFormAankoop(prev => ({ ...prev, winkelId: selectedWinkel ? String(selectedWinkel.id) : '', bonOmschrijving: '', prijs: '', hoeveelheid: '' }));
              }}
                onBlur={e => setWinkelSearch(e.target.value.trimEnd())}
                placeholder="-- Selecteer Winkel --" required maxLength={100} />
            </div>
            <datalist id="winkel-options">
              {filteredWinkelsForPurchaseForm.slice().sort(sortWinkels).map(w => <option key={Number(w.id)} value={`${Object.keys(w.land)[0]} - ${w.naam} (${w.keten})`} />)}
            </datalist>
            <div className="form-field">
              <label htmlFor="bon-omschrijving">Bon omschrijving:</label>
              <input
                id="bon-omschrijving"
                name="bonOmschrijving"
                type="text"
                placeholder="Bon omschrijving"
                value={formAankoop.bonOmschrijving}
                onChange={e => setFormAankoop({ ...formAankoop, bonOmschrijving: e.target.value })}
                onBlur={e => {
                  handleBlur(e);
                  setFormAankoop(current => ({ ...current, bonOmschrijving: current.bonOmschrijving.trimEnd() }));
                }}
                required
                className={`${suggestedFields.has('bonOmschrijving') ? 'suggested-input' : ''} ${formErrors.bonOmschrijving ? 'input-error' : ''}`}
                onInput={() => suggestedFields.delete('bonOmschrijving') && setSuggestedFields(new Set(suggestedFields))}
                maxLength={100}
              />
              {formErrors.bonOmschrijving && <p className="error-text" style={{ gridColumn: 'span 1' }}>{formErrors.bonOmschrijving}</p>}
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
            {priceWarning && (
              <div className="form-field-full">
                <p className={`warning ${isSubmissionBlocked ? 'error-text' : ''}`}>
                  {priceWarning}
                </p>
              </div>
            )}
            <div className="form-field">
              <button type="submit" className="button-primary full-width" disabled={isSubmitting || isSubmissionBlocked || hasAankoopFormErrors}>
                {isSubmitting ? 'Bezig...' : 'Voeg Aankoop Toe'}
              </button>
            </div>
          </form>
        </CollapsibleSection>

        <section className="card">
          <h2>Beste Prijs Vinder</h2>
          <div className="button-group" style={{ marginBottom: '1rem' }}>
            <button onClick={handleFindAllBestPrices} disabled={isLoadingPrices} className="button-primary">{isLoadingPrices ? 'Berekenen...' : 'Ververs Prijzen'}</button>
            {selectedProducts.size > 0 && (
              <>
                <button onClick={handleExportSelection} className="button-success">Exporteer Lijst ({selectedProducts.size})</button>
                <button onClick={handleSelectAll} className="button-secondary">Alles Selecteren</button>
                <button onClick={() => setSelectedProducts(new Set())} className="button-danger">Reset Selectie</button>
              </>
            )}
          </div>

          {selectedProducts.size > 0 && (
            <div className="checkbox-item" style={{ maxWidth: '300px', marginTop: '1rem' }}>
              <input
                type="checkbox"
                id="export-description-checkbox"
                checked={exportWithDescription}
                onChange={e => setExportWithDescription(e.target.checked)}
              />
              <label htmlFor="export-description-checkbox">Exporteer met bon omschrijving</label>
            </div>
          )}

          <CollapsibleSection title="Nederland">
            <PriceFinderTable countryCode="NL" products={products} bestPrices={bestPrices} selectedProducts={selectedProducts} onSelectionChange={handleSelectionChange} winkels={winkels} selectedStoreIds={selectedStoreIds} searchTerm={priceFinderNlSearch} setSearchTerm={setPriceFinderNlSearch} />
          </CollapsibleSection>
          <CollapsibleSection title="Spanje">
            <PriceFinderTable countryCode="ES" products={products} bestPrices={bestPrices} selectedProducts={selectedProducts} onSelectionChange={handleSelectionChange} winkels={winkels} selectedStoreIds={selectedStoreIds} searchTerm={priceFinderEsSearch} setSearchTerm={setPriceFinderEsSearch} />
          </CollapsibleSection>
        </section>

        <CollapsibleSection title="Aankopen Historie">
          <div className="filter-controls">
            <input type="text" placeholder="Zoek op alle kolommen..." value={aankoopSearchTerm} onChange={e => setAankoopSearchTerm(e.target.value)} onBlur={e => setAankoopSearchTerm(e.target.value.trimEnd())} maxLength={100} />
            <button onClick={() => setAankoopSearchTerm('')} className="button-secondary">Reset</button>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Product</th><th>Omschrijving bon</th><th>Winkel</th><th>Land</th><th>Prijs</th><th>Hoeveelheid</th><th>Eenheid</th><th>Datum</th><th>Actie</th></tr></thead>
              <tbody>
                {searchedAankopen.slice().sort(([a], [b]) => Number(b.datum) - Number(a.datum)).map(([aankoop, prodNaam, winkelNaam]) => {
                  const winkel = winkels.find(w => w.id === aankoop.winkelId);
                  const product = products.find(p => p.id === aankoop.productId);
                  return (
                    <tr key={Number(aankoop.id)}>
                      <td data-label="Product">{prodNaam}</td>
                      <td data-label="Omschrijving bon">{aankoop.bonOmschrijving}</td>
                      <td data-label="Winkel">{winkelNaam}</td>
                      <td data-label="Land">{winkel ? Object.keys(winkel.land)[0] : 'n/a'}</td>
                      <td data-label="Prijs">€{aankoop.prijs.toFixed(2)}</td>
                      <td data-label="Hoeveelheid">{aankoop.hoeveelheid}</td>
                      <td data-label="Eenheid">{product ? formatEenheid(product.standaardEenheid, false).replace('per ', '') : 'n/a'}</td>
                      <td data-label="Datum">{new Date(Number(aankoop.datum) / 1_000_000).toLocaleString()}</td>
                      <td data-label="Actie">
                        <button onClick={() => handleDeleteAankoop(aankoop.id)} className="button-danger" disabled={deletingItemId === aankoop.id} >
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

        <CollapsibleSection title="Dashboard">
          <Dashboard
            aankopen={aankopen}
            products={products}
            winkels={winkels}
            selectedStoreIds={selectedStoreIds}
          />
        </CollapsibleSection>

      </main>
    </div>
  );
}

export default App;