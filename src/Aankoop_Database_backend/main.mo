import Map "mo:map/Map";
import Nat "mo:base/Nat";
import Float "mo:base/Float";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";
import Buffer "mo:base/Buffer";
import Principal "mo:base/Principal";

persistent actor BoodschappenDB {

  // ==========================================================
  // TYPE DEFINITIES (ongewijzigd)
  // ==========================================================
  public type Land = { #NL; #ES };
  public type Eenheid = {
    #STUK; #METER; #KILOGRAM; #GRAM;
    #LITER; #MILLILITER; #ROL; #TABLET;
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
  public type AllBestPricesResult = {
    productId: Nat;
    nl: ?BestePrijsInfo;
    es: ?BestePrijsInfo;
  };

  // ==========================================================
  // BEVEILIGING & CONFIGURATIE
  // ==========================================================
  private let frontendCanisterId : Text = "gndzg-rqaaa-aaaai-q32xa-cai";
  private let developerPrincipalId : Text = "2vxsx-fae";
  private let adminPassword : Text = "172638421"; // Admin wachtwoord

  // ==========================================================
  // STATE VARIABELEN (ongewijzigd)
  // ==========================================================
  var winkelsData : [(Nat, Winkel)] = [];
  var productenData : [(Nat, Product)] = [];
  var aankopenData : [(Nat, Aankoop)] = [];
  var nextWinkelId : Nat = 0;
  var nextProductId : Nat = 0;
  var nextAankoopId : Nat = 0;

  var winkels = Map.new<Nat, Winkel>();
  var producten = Map.new<Nat, Product>();
  var aankopen = Map.new<Nat, Aankoop>();

  // ==========================================================
  // BEVEILIGING: GUARD FUNCTIE (ongewijzigd)
  // ==========================================================
  private func authorizeCaller(caller : Principal) {
    let frontendPrincipal = Principal.fromText(frontendCanisterId);
    let developerPrincipal = Principal.fromText(developerPrincipalId);

    if (caller != frontendPrincipal and caller != developerPrincipal) {
      Debug.trap("Unauthorized: Caller is not authorized to perform this action.");
    };
  };

  private func isAdmin(password: ?Text): Bool {
    switch (password) {
      case (?p) { return p == adminPassword; };
      case (null) { return false; };
    }
  };

  // ==========================================================
  // UPGRADE HOOKS (ongewijzigd)
  // ==========================================================
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

  // ==========================================================
  // UPDATE FUNCTIES (ongewijzigd, behalve admin-logica)
  // ==========================================================
  public shared (msg) func addWinkel(naam : Text, keten : Text, land : Land) : async Nat {
    authorizeCaller(msg.caller);
    let id = nextWinkelId;
    let newWinkel : Winkel = { id; naam; keten; land; };
    Map.set(winkels, Map.nhash, id, newWinkel);
    nextWinkelId += 1;
    return id;
  };

  public shared (msg) func addProduct(naam : Text, merk : Text, trefwoorden : [Text], standaardEenheid : Eenheid) : async Nat {
    authorizeCaller(msg.caller);
    let id = nextProductId;
    let newProduct : Product = { id; naam; merk; trefwoorden; standaardEenheid };
    Map.set(producten, Map.nhash, id, newProduct);
    nextProductId += 1;
    return id;
  };

  public shared (msg) func addAankoop(
    productId : Nat,
    winkelId : Nat,
    bonOmschrijving : Text,
    prijs : Float,
    hoeveelheid : Float,
  ) : async Nat {
    authorizeCaller(msg.caller);
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

  // ==========================================================
  // BEVEILIGDE UPDATE & DELETE FUNCTIES (MET ADMIN OVERRIDE)
  // ==========================================================

  public shared (msg) func deleteAankoop(id : Nat, adminPassword: ?Text) : async Result.Result<Null, Text> {
    authorizeCaller(msg.caller);
    switch (Map.get(aankopen, Map.nhash, id)) {
      case (null) {
        return #err("Aankoop met deze ID niet gevonden.");
      };
      case (?aankoop) {
        // Admin mag altijd verwijderen
        if (isAdmin(adminPassword)) {
          Map.delete(aankopen, Map.nhash, id);
          return #ok(null);
        };

        // Normale gebruiker: check de 5 minuten limiet
        let fiveMinutesInNanos : Nat = 300_000_000_000;
        if (Time.now() - aankoop.datum <= fiveMinutesInNanos) {
          Map.delete(aankopen, Map.nhash, id);
          return #ok(null);
        } else {
          return #err("Aankoop kan niet verwijderd worden na 5 minuten.");
        }
      };
    };
  };

  public shared (msg) func updateWinkel(id : Nat, naam : Text, keten : Text, land : Land, adminPassword: ?Text) : async Result.Result<Null, Text> {
    authorizeCaller(msg.caller);
    // Hoewel er geen backend-validatie is om te omzeilen, voegen we de parameter toe voor consistentie met de frontend.
    switch (Map.get(winkels, Map.nhash, id)) {
      case (null) {
        return #err("Winkel met deze ID niet gevonden.");
      };
      case (?_) {
        let updatedWinkel : Winkel = { id; naam; keten; land };
        Map.set(winkels, Map.nhash, id, updatedWinkel);
        return #ok(null);
      };
    };
  };

  public shared (msg) func deleteWinkel(id : Nat, adminPassword: ?Text) : async Result.Result<Null, Text> {
    authorizeCaller(msg.caller);
    if (Map.get(winkels, Map.nhash, id) == null) {
      return #err("Winkel met deze ID niet gevonden.");
    };

    // Admin mag altijd verwijderen, sla de check over
    if (isAdmin(adminPassword)) {
      Map.delete(winkels, Map.nhash, id);
      return #ok(null);
    }; // <-- **DEZE HAAK WAS VERGETEN**

    // Normale gebruiker: check op gekoppelde aankopen
    for ((_, aankoop) in Map.entries(aankopen)) {
      if (aankoop.winkelId == id) {
        return #err("Kan winkel niet verwijderen: er zijn nog aankopen aan gekoppeld.");
      };
    };
    Map.delete(winkels, Map.nhash, id);
    return #ok(null);
  };

  public shared (msg) func updateProduct(id : Nat, naam : Text, merk : Text, trefwoorden : [Text], standaardEenheid : Eenheid, adminPassword: ?Text) : async Result.Result<Null, Text> {
    authorizeCaller(msg.caller);
    // Hoewel er geen backend-validatie is om te omzeilen, voegen we de parameter toe voor consistentie met de frontend.
    switch (Map.get(producten, Map.nhash, id)) {
      case (null) {
        return #err("Product met deze ID niet gevonden.");
      };
      case (?_) {
        let updatedProduct : Product = { id; naam; merk; trefwoorden; standaardEenheid };
        Map.set(producten, Map.nhash, id, updatedProduct);
        return #ok(null);
      };
    };
  };

  public shared (msg) func deleteProduct(id : Nat, adminPassword: ?Text) : async Result.Result<Null, Text> {
    authorizeCaller(msg.caller);
    if (Map.get(producten, Map.nhash, id) == null) {
      return #err("Product met deze ID niet gevonden.");
    };

    // Admin mag altijd verwijderen, sla de check over
    if (isAdmin(adminPassword)) {
      Map.delete(producten, Map.nhash, id);
      return #ok(null);
    }; // <-- **DEZE HAAK WAS VERGETEN**

    // Normale gebruiker: check op gekoppelde aankopen
    for ((_, aankoop) in Map.entries(aankopen)) {
      if (aankoop.productId == id) {
        return #err("Kan product niet verwijderen: er zijn nog aankopen aan gekoppeld.");
      };
    };
    Map.delete(producten, Map.nhash, id);
    return #ok(null);
  };

  // ==========================================================
  // QUERY FUNCTIES (ongewijzigd)
  // ==========================================================
  private func berekenEenheidsprijs(aankoop : Aankoop) : ?Float {
    if (aankoop.hoeveelheid > 0) {
      return ?(aankoop.prijs / aankoop.hoeveelheid);
    } else {
      return null;
    };
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

  private func findBestPriceForCountry(productId : Nat, land: Land) : ?BestePrijsInfo {
    var laatsteAankopenPerWinkel = Map.new<Nat, Aankoop>();

    for ((_, aankoop) in Map.entries(aankopen)) {
      switch(Map.get(winkels, Map.nhash, aankoop.winkelId)) {
        case (?winkel) {
          if (aankoop.productId == productId and winkel.land == land) {
            let winkelId = aankoop.winkelId;
            let bestaandeAankoopOpt = Map.get(laatsteAankopenPerWinkel, Map.nhash, winkelId);
            let isNieuwer = switch (bestaandeAankoopOpt) {
              case (null) true;
              case (?bestaande) aankoop.datum > bestaande.datum;
            };
            if (isNieuwer) {
              Map.set(laatsteAankopenPerWinkel, Map.nhash, winkelId, aankoop);
            };
          };
        };
        case (_) {};
      };
    };

    var besteInfo : ?BestePrijsInfo = null;

    for ((winkelId, aankoop) in Map.entries(laatsteAankopenPerWinkel)) {
      switch (berekenEenheidsprijs(aankoop)) {
        case (?huidigeEenheidsprijs) {
          let isBeter = switch (besteInfo) {
            case (null) true;
            case (?vorigeBeste) huidigeEenheidsprijs < vorigeBeste.eenheidsprijs;
          };
          if (isBeter) {
            let productOpt = Map.get(producten, Map.nhash, aankoop.productId);
            let winkelOpt = Map.get(winkels, Map.nhash, aankoop.winkelId);
            switch (productOpt, winkelOpt) {
              case (?product, ?winkel) {
                besteInfo := ?{
                  productNaam = product.naam;
                  winkelNaam = winkel.naam;
                  land = winkel.land;
                  datum = aankoop.datum;
                  eenheidsprijs = huidigeEenheidsprijs;
                  eenheid = product.standaardEenheid;
                };
              };
              case (_, _) {};
            };
          };
        };
        case (null) {};
      };
    };
    return besteInfo;
  };

  public query func findAllBestPrices() : async [AllBestPricesResult] {
    let results = Buffer.Buffer<AllBestPricesResult>(0);

    for ((productId, product) in Map.entries(producten)) {
      let nlBestInfo = findBestPriceForCountry(productId, #NL);
      let esBestInfo = findBestPriceForCountry(productId, #ES);

      if (nlBestInfo != null or esBestInfo != null) {
        results.add({
          productId = productId;
          nl = nlBestInfo;
          es = esBestInfo;
        });
      };
    };
    
    return Buffer.toArray(results);
  };
};