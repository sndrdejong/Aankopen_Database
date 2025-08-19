import Map "mo:map/Map";
import Nat "mo:base/Nat";
import Float "mo:base/Float";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";
import Buffer "mo:base/Buffer";

persistent actor BoodschappenDB {

  public type Land = { #NL; #ES };
  public type Eenheid = {
    #STUK;
    #METER;
    #KILOGRAM;
    #GRAM;
    #LITER;
    #MILLILITER;
    #ROL;
    #TABLET;
  };
  public type Winkel = { id : Nat; naam : Text; keten : Text; land : Land };
  public type Product = {
    id : Nat;
    naam : Text;
    merk : Text;
    trefwoorden : [Text];
    standaardEenheid : Eenheid;
  };
  public type Aankoop = {
    id : Nat;
    productId : Nat;
    winkelId : Nat;
    datum : Time.Time;
    bonOmschrijving : Text;
    prijs : Float;
    hoeveelheid : Float;
  };
  public type BestePrijsInfo = {
    productNaam : Text;
    winkelNaam : Text;
    land : Land;
    datum : Time.Time;
    eenheidsprijs : Float;
    eenheid : Eenheid;
  };

  // Stable arrays for upgrade persistence (actor-level vars are implicitly stable)
  var winkelsData : [(Nat, Winkel)] = [];
  var productenData : [(Nat, Product)] = [];
  var aankopenData : [(Nat, Aankoop)] = [];
  var nextWinkelId : Nat = 0;
  var nextProductId : Nat = 0;
  var nextAankoopId : Nat = 0;

  // Non-stable Maps - Use Map.new for initialization
  var winkels = Map.new<Nat, Winkel>();
  var producten = Map.new<Nat, Product>();
  var aankopen = Map.new<Nat, Aankoop>();

  system func preupgrade() {
    winkelsData := Map.toArray(winkels);
    productenData := Map.toArray(producten);
    aankopenData := Map.toArray(aankopen);
  };

  system func postupgrade() {
    winkels := Map.new<Nat, Winkel>();
    for ((k, v) in winkelsData.vals()) { Map.set(winkels, Map.nhash, k, v) };
    winkelsData := [];

    producten := Map.new<Nat, Product>();
    for ((k, v) in productenData.vals()) { Map.set(producten, Map.nhash, k, v) };
    productenData := [];

    aankopen := Map.new<Nat, Aankoop>();
    for ((k, v) in aankopenData.vals()) { Map.set(aankopen, Map.nhash, k, v) };
    aankopenData := [];
  };

  public shared (_) func addWinkel(naam : Text, keten : Text, land : Land) : async Nat {
    let id = nextWinkelId;
    let newWinkel : Winkel = {
      id = id;
      naam = naam;
      keten = keten;
      land = land;
    };
    Map.set(winkels, Map.nhash, id, newWinkel);
    nextWinkelId += 1;
    return id;
  };

  public shared (_) func addProduct(naam : Text, merk : Text, trefwoorden : [Text], standaardEenheid : Eenheid) : async Nat {
    let id = nextProductId;
    let newProduct : Product = { id; naam; merk; trefwoorden; standaardEenheid };
    Map.set(producten, Map.nhash, id, newProduct);
    nextProductId += 1;
    return id;
  };

  public shared (_) func addAankoop(
    productId : Nat,
    winkelId : Nat,
    bonOmschrijving : Text,
    prijs : Float,
    hoeveelheid : Float,
  ) : async Nat {
    if (Map.get(producten, Map.nhash, productId) == null) {
      Debug.trap("Product niet gevonden");
    };
    if (Map.get(winkels, Map.nhash, winkelId) == null) {
      Debug.trap("Winkel niet gevonden");
    };
    if (hoeveelheid <= 0) {
      Debug.trap("Hoeveelheid moet groter dan 0 zijn");
    };
    let id = nextAankoopId;
    let aankoop : Aankoop = {
      id;
      productId;
      winkelId;
      datum = Time.now();
      bonOmschrijving;
      prijs;
      hoeveelheid;
    };
    Map.set(aankopen, Map.nhash, id, aankoop);
    nextAankoopId += 1;
    return id;
  };

  public query func getWinkels() : async [Winkel] {
    return Iter.toArray(Map.vals(winkels));
  };

  public query func getProducts() : async [Product] {
    return Iter.toArray(Map.vals(producten));
  };

  public query func getAankopen() : async [(Aankoop, Text, Text)] {
    let result = Buffer.Buffer<(Aankoop, Text, Text)>(0);
    for ((_, aankoop) in Map.entries(aankopen)) {
      let productOpt = Map.get(producten, Map.nhash, aankoop.productId);
      let winkelOpt = Map.get(winkels, Map.nhash, aankoop.winkelId);
      switch (productOpt, winkelOpt) {
        case (?product, ?winkel) {
          result.add((aankoop, product.naam, winkel.naam));
        };
        case (_, _) {};
      };
    };
    return Buffer.toArray(result);
  };

  public shared (_) func deleteAankoop(id : Nat) : async Result.Result<Null, Text> {
    if (Map.get(aankopen, Map.nhash, id) != null) {
      Map.delete(aankopen, Map.nhash, id);
      return #ok(null);
    } else {
      return #err("Aankoop met deze ID niet gevonden.");
    };
  };

  private func berekenEenheidsprijs(aankoop : Aankoop) : ?Float {
    if (aankoop.hoeveelheid > 0) {
      return ?(aankoop.prijs / aankoop.hoeveelheid);
    } else {
      return null;
    };
  };

  public query func findBestPrice(productId : Nat) : async ?BestePrijsInfo {
    // Stap 1: Vind de meest recente aankoop voor elke winkel
    var laatsteAankopenPerWinkel = Map.new<Nat, Aankoop>();

    for ((_, aankoop) in Map.entries(aankopen)) {
      if (aankoop.productId == productId) {
        let winkelId = aankoop.winkelId;
        let bestaandeAankoopOpt = Map.get(laatsteAankopenPerWinkel, Map.nhash, winkelId);

        let isNieuwer = switch (bestaandeAankoopOpt) {
          case (null) true; // Geen bestaande, dus deze is de "nieuwste"
          case (?bestaande) aankoop.datum > bestaande.datum; // Is de huidige nieuwer?
        };

        if (isNieuwer) {
          Map.set(laatsteAankopenPerWinkel, Map.nhash, winkelId, aankoop);
        };
      };
    };

    // Stap 2: Vind de beste prijs in de lijst van meest recente aankopen
    var bestePrijsOpt : ?Float = null;
    var besteInfo : ?BestePrijsInfo = null;

    for ((_, aankoop) in Map.entries(laatsteAankopenPerWinkel)) {
      // ... (de rest van de logica is bijna identiek aan het origineel)
      // Bereken eenheidsprijs, vergelijk, en update 'besteInfo'
      // ...
    };

    return besteInfo;
  };
};
