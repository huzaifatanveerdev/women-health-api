const subscriptionPlans = [
    {
      key: "impact",
      productId: "com.women-help-api.impact.monthly",
      name: {
        en: "Impact",
        de: "Impact"
      },
      description: {
        en: "→ Enables 1 month of access to menstrual products",
        de: "→ vErmöglicht 1 Monat Zugang zu Menstruationsprodukten"
      },
      color: "#E85AA5",
      icon: "impact-icon" // frontend will map this to actual asset
    },
    // Grandfathered yearly Impact product. A small set of users purchased this
    // before Impact became a monthly product; their renewals must continue to
    // credit 3 months of menstrual care per cycle. This entry is intentionally
    // NOT surfaced in the in-app PlanScreen (only `impact` / `impactplus` /
    // `maximpact` are sold to new users via the RevenueCat "mixed" offering).
    {
      key: "impact_legacy_yearly",
      productId: "com.women-help-api.impact",
      name: {
        en: "Impact",
        de: "Impact"
      },
      description: {
        en: "→ Your contribution enables a woman to access menstrual care for 3 months.",
        de: "→ Dein Beitrag ermöglicht einer Frau 3 Monate Zugang zu Menstruationsversorgung."
      },
      color: "#E85AA5",
      icon: "impact-icon"
    },
    {
      key: "impactplus",
      productId: "com.women-help-api.impactplus",
      name: {
        en: "Impact Plus",
        de: "Impact Plus"
      },
      description: {
        en: "→ Enables 5 months of access to menstrual products",
        de: "→ Ermöglicht 5 Monate Zugang zu Menstruationsprodukten"
      },
      color: "#BE63AD",
      icon: "impactplus-icon"
    },
    {
      key: "maximpact",
      productId: "com.women-help-api.maximpact",
      name: {
        en: "Max Impact",
        de: "Max Impact"
      },
      description: {
        en: "→ Enables 12 months of access to menstrual products",
        de: "→ Ermöglicht 12 Monate Zugang zu Menstruationsprodukten"
      },
      color: "#BE63AD",
      icon: "maximpact-icon"
    }
];
  
module.exports = subscriptionPlans;
  