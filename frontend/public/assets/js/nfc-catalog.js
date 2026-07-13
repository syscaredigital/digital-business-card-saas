(function (window) {
  "use strict";

  var STORAGE_KEY = "sync-e-nfc-catalog-v1";
  var fallbackImage = "../../public/assets/images/login-card-front.png";
  var lineDetails = {
    essential: { name: "Essential Line", badge: "Entry Level", description: "Perfect for getting started with contactless networking" },
    signature: { name: "Signature Line", badge: "Professional", description: "Advanced features for business professionals" },
    prestige: { name: "Prestige Line", badge: "Executive", description: "Premium features for executives and leaders" },
    exclusive: { name: "Exclusive Line", badge: "Luxury", description: "Premium contactless cards with advanced features for professionals who demand the best" }
  };

  function product(line, slug, name, price, features, options) {
    options = options || {};
    return {
      id: line + "-" + slug,
      line: line,
      name: name,
      price: price,
      features: features,
      image: fallbackImage,
      badge: options.badge || "",
      featured: Boolean(options.featured),
      tone: options.tone || slug
    };
  }

  var defaults = [
    product("essential", "white", "White", 3250, ["Contactless Sharing", "Basic Profile", "Standard Design"], { tone: "white" }),
    product("essential", "black", "Black", 3450, ["Contactless Sharing", "Basic Profile", "Premium Finish"], { tone: "black" }),
    product("essential", "black-metal", "Black Metal", 3750, ["Contactless Sharing", "Premium Metal", "Luxury Feel"], { tone: "black-metal" }),
    product("essential", "silver-metal", "Silver Metal", 4000, ["Contactless Sharing", "Premium Metal", "Elegant Design"], { tone: "silver" }),
    product("signature", "white", "White", 3550, ["Contactless Sharing", "Advanced Profile", "Premium Design"], { tone: "white" }),
    product("signature", "black", "Black", 3750, ["Contactless Sharing", "Advanced Profile", "Luxury Finish"], { tone: "black" }),
    product("signature", "black-metal", "Black Metal", 4000, ["Contactless Sharing", "Premium Metal", "Executive Design"], { tone: "black-metal" }),
    product("signature", "silver-metal", "Silver Metal", 4500, ["Contactless Sharing", "Premium Metal", "Elegant Design"], { tone: "silver", featured: true }),
    product("prestige", "white", "White", 3950, ["Contactless Sharing", "Executive Profile", "Premium Design"], { tone: "white" }),
    product("prestige", "black", "Black", 4200, ["Contactless Sharing", "Executive Profile", "Luxury Finish"], { tone: "black" }),
    product("prestige", "black-metal", "Black Metal", 4500, ["Contactless Sharing", "Premium Metal", "Executive Design"], { tone: "black-metal", featured: true }),
    product("prestige", "silver-metal", "Silver Metal", 4750, ["Contactless Sharing", "Premium Metal", "Elegant Design"], { tone: "silver" }),
    product("exclusive", "color-custom", "Color Custom", 4800, ["Fully Custom Colors", "Contactless Sharing", "Premium Materials", "Advanced Profile"], { tone: "color", badge: "Most Popular" }),
    product("exclusive", "gold-custom", "Gold Custom", 4950, ["24K Gold Accents", "Contactless Sharing", "Luxury Materials", "Executive Design"], { tone: "gold", badge: "Featured" }),
    product("exclusive", "rose-gold-custom", "Rose Gold Custom", 5200, ["Platinum Finish", "Contactless Sharing", "Premium Materials", "Luxury Packaging"], { tone: "rose", badge: "Popular", featured: true })
  ];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function getProducts() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (error) {
      /* Fall back to the curated catalog when storage is unavailable or invalid. */
    }
    return clone(defaults);
  }

  function saveProducts(products) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    window.dispatchEvent(new CustomEvent("nfc-catalog-updated", { detail: clone(products) }));
  }

  window.SyncNfcCatalog = {
    lines: lineDetails,
    defaults: clone(defaults),
    getProducts: getProducts,
    saveProducts: saveProducts,
    reset: function () { window.localStorage.removeItem(STORAGE_KEY); return getProducts(); }
  };
})(window);
