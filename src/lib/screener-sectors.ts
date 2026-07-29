/**
 * Sector taxonomy for the screener (Bug 6 — "sector filter is overwhelming").
 *
 * The raw `screener_metrics.sector` is Polygon's SIC description — ~340 distinct
 * strings ("SEMICONDUCTORS & RELATED DEVICES", "PHARMACEUTICAL PREPARATIONS",
 * "STATE COMMERCIAL BANKS"…). Far too granular for a picker.
 *
 * This module collapses SIC strings into the 11 canonical GICS-style sectors
 * plus a small, curated set of subsectors, via an ORDERED keyword rule table
 * (first match wins — order matters, e.g. equipment rules run before the media
 * rules that would otherwise swallow "BROADCASTING … EQUIPMENT"). Anything that
 * matches a sector but no subsector buckets into "Other <sector>"; anything that
 * matches nothing is Unknown (null) and simply isn't offered as a filter option.
 *
 * Maintainable: to reclassify, add/reorder a rule — no migration, the mapping
 * runs client-side over the already-loaded universe.
 */

export const SECTORS = [
  "Technology",
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Financials",
  "Healthcare",
  "Industrials",
  "Energy",
  "Materials",
  "Real Estate",
  "Utilities",
] as const;

export type Sector = (typeof SECTORS)[number];

export interface SectorClass {
  sector: Sector;
  subsector: string; // curated subsector, or "Other <sector>"
}

/** Curated subsectors offered per sector (drives the dependent dropdown). */
export const SUBSECTORS: Record<Sector, string[]> = {
  Technology: ["Semiconductors", "Software", "Hardware & Devices", "IT Services", "Other Technology"],
  "Communication Services": ["Telecom", "Media & Entertainment", "Interactive & Online", "Other Communication Services"],
  "Consumer Discretionary": ["Retail", "Automobiles", "Apparel & Luxury", "Leisure & Hospitality", "Other Consumer Discretionary"],
  "Consumer Staples": ["Food & Beverage", "Household & Personal", "Tobacco", "Other Consumer Staples"],
  Financials: ["Banks", "Insurance", "Capital Markets", "Consumer Finance", "Other Financials"],
  Healthcare: ["Biotech", "Pharma", "Medical Devices", "Providers & Services", "Other Healthcare"],
  Industrials: ["Aerospace & Defense", "Machinery", "Transportation", "Construction & Engineering", "Electrical Equipment", "Commercial Services", "Other Industrials"],
  Energy: ["Oil & Gas", "Coal", "Other Energy"],
  Materials: ["Chemicals", "Metals & Mining", "Paper & Packaging", "Construction Materials", "Other Materials"],
  "Real Estate": ["REITs", "Real Estate Services", "Other Real Estate"],
  Utilities: ["Electric", "Gas", "Water", "Other Utilities"],
};

/**
 * Ordered rule table. Each rule: a keyword/regex tested (case-insensitively)
 * against the raw SIC string, and the {sector, subsector} it assigns. FIRST
 * MATCH WINS, so more-specific / disambiguating rules come first.
 */
interface Rule {
  re: RegExp;
  sector: Sector;
  subsector: string;
}

const RULES: Rule[] = [
  // ── Technology (equipment rules first, before media/comm) ────────────────
  { re: /SEMICONDUCTOR|PRINTED CIRCUIT|ELECTRONIC COMPONENT|ELECTRONIC CONNECTOR|ELECTRONIC COILS/, sector: "Technology", subsector: "Semiconductors" },
  { re: /PREPACKAGED SOFTWARE|COMPUTER PROGRAMMING|COMPUTER PROCESSING|DATA PREPARATION|PROGRAMMING, DATA/, sector: "Technology", subsector: "Software" },
  { re: /COMPUTER INTEGRATED SYSTEMS|COMPUTER SERVICES|COMPUTER FACILITIES/, sector: "Technology", subsector: "IT Services" },
  { re: /ELECTRONIC COMPUTER|COMPUTER STORAGE|COMPUTER PERIPHERAL|COMPUTER COMMUNICATIONS EQUIP|COMPUTER & OFFICE EQUIP|COMPUTER TERMINAL|OFFICE MACHINES|CALCULATING & ACCOUNTING|COMPUTER & OFFICE/, sector: "Technology", subsector: "Hardware & Devices" },
  { re: /COMMUNICATIONS EQUIPMENT|TELEPHONE & TELEGRAPH APPARATUS|RADIO & TV BROADCASTING & COMMUNICATIONS EQUIPMENT|COMMUNICATIONS EQUIP/, sector: "Technology", subsector: "Hardware & Devices" },
  { re: /WHOLESALE-COMPUTERS|WHOLESALE-ELECTRONIC PARTS/, sector: "Technology", subsector: "IT Services" },

  // ── Healthcare (before the generic "CHEMICAL"/"INSTRUMENTS" rules) ────────
  { re: /BIOLOGICAL PRODUCT|BIOLOGICAL RESEARCH|IN VITRO|IN VIVO/, sector: "Healthcare", subsector: "Biotech" },
  { re: /PHARMACEUTICAL|MEDICINAL|BOTANICAL|DIAGNOSTIC SUBSTANCE/, sector: "Healthcare", subsector: "Pharma" },
  { re: /SURGICAL|MEDICAL INSTRUMENT|ORTHOPEDIC|PROSTHETIC|ELECTROMEDICAL|ELECTROTHERAPEUTIC|DENTAL|X-RAY|OPHTHALMIC|IRRADIATION APPARATUS|MEDICAL, DENTAL/, sector: "Healthcare", subsector: "Medical Devices" },
  { re: /MEDICAL LAB|HEALTH SERVICE|HEALTH & ALLIED|HOSPITAL|NURSING|HOME HEALTH|DOCTORS|CLINICS|HEALTH CARE|MEDICAL & SURGICAL|SKILLED NURSING/, sector: "Healthcare", subsector: "Providers & Services" },
  { re: /LABORATORY ANALYTICAL|TESTING LABORATOR/, sector: "Healthcare", subsector: "Medical Devices" },

  // ── Financials (before REIT — REIT is Real Estate) ───────────────────────
  { re: /REAL ESTATE INVESTMENT TRUST/, sector: "Real Estate", subsector: "REITs" },
  { re: /\bBANK|SAVINGS INSTITUTION|DEPOSITORY BANKING|FEDERAL & FEDERALLY/, sector: "Financials", subsector: "Banks" },
  { re: /INSURANCE|SURETY/, sector: "Financials", subsector: "Insurance" },
  { re: /BROKER|DEALER|INVESTMENT ADVICE|INVESTMENT OFFICE|SECURITY & COMMODITY|COMMODITY CONTRACT|FLOTATION COMPANIES|EXCHANGES & SERVICES/, sector: "Financials", subsector: "Capital Markets" },
  { re: /CREDIT INSTITUTION|PERSONAL CREDIT|FINANCE SERVICE|FINANCE LESSOR|MORTGAGE|LOAN|BUSINESS CREDIT|CREDIT REPORTING|CREDIT AGENC/, sector: "Financials", subsector: "Consumer Finance" },
  { re: /BLANK CHECK|INVESTORS, NEC|TRUST, NEC/, sector: "Financials", subsector: "Other Financials" },

  // ── Real Estate ──────────────────────────────────────────────────────────
  { re: /REAL ESTATE|OPERATORS OF|LESSORS OF REAL|LAND SUBDIVIDER|OPERATIVE BUILDER|APARTMENT BUILDING/, sector: "Real Estate", subsector: "Real Estate Services" },

  // ── Energy ───────────────────────────────────────────────────────────────
  { re: /BITUMINOUS COAL|LIGNITE|\bCOAL\b/, sector: "Energy", subsector: "Coal" },
  { re: /PETROLEUM|OIL & GAS|OIL ROYALTY|CRUDE|DRILLING|NATURAL GAS TRANSMISSION|PIPE LINES|GAS EXPLORATION|OIL & GAS FIELD/, sector: "Energy", subsector: "Oil & Gas" },

  // ── Utilities ────────────────────────────────────────────────────────────
  { re: /ELECTRIC SERVICES|ELECTRIC & OTHER|COGENERATION|ELECTRIC, GAS & SANITARY/, sector: "Utilities", subsector: "Electric" },
  { re: /NATURAL GAS DISTRIBUTION|GAS & OTHER SERVICES|NATURAL GAS TRANSMISSION & DISTRIB/, sector: "Utilities", subsector: "Gas" },
  { re: /WATER SUPPLY/, sector: "Utilities", subsector: "Water" },

  // ── Communication Services (media / telecom — after equipment) ───────────
  { re: /TELEPHONE COMMUNICATION|RADIOTELEPHONE|TELEGRAPH & OTHER|COMMUNICATIONS SERVICES|CABLE & OTHER PAY|TELEGRAPH & OTHER MESSAGE/, sector: "Communication Services", subsector: "Telecom" },
  { re: /BROADCASTING|TELEVISION|RADIO BROADCAST|MOTION PICTURE|VIDEO TAPE|PUBLISHING|NEWSPAPER|PERIODICAL|BOOKS|ADVERTISING|AMUSEMENT|RECREATION|MOTION PICTURE THEATER|MEMBERSHIP SPORTS/, sector: "Communication Services", subsector: "Media & Entertainment" },

  // ── Consumer Staples (food/bev/household/tobacco — before wholesale/retail)
  { re: /CIGARETTE|TOBACCO/, sector: "Consumer Staples", subsector: "Tobacco" },
  { re: /SOAP|DETERGENT|COSMETIC|PERFUME|TOILET PREPARATION|SPECIALTY CLEANING/, sector: "Consumer Staples", subsector: "Household & Personal" },
  { re: /FOOD|BEVERAGE|SOFT DRINK|DAIRY|MEAT|POULTRY|SUGAR|CONFECTIONERY|BOTTLED|CANNED|GRAIN MILL|FATS & OILS|BAKERY|SAUSAGE|MALT/, sector: "Consumer Staples", subsector: "Food & Beverage" },

  // ── Consumer Discretionary ───────────────────────────────────────────────
  { re: /MOTOR VEHICLE|PASSENGER CAR|AUTO DEALER|AUTO & HOME|TRUCK & BUS|MOTOR HOME|MOBILE HOME|TRUCK TRAILER/, sector: "Consumer Discretionary", subsector: "Automobiles" },
  { re: /APPAREL|FOOTWEAR|CLOTHING|LEATHER|OUTERWEAR|FURNISH.*WORK CLOTH|MEN'S & BOYS'|WOMEN'S|JEWELRY|WATCHES/, sector: "Consumer Discretionary", subsector: "Apparel & Luxury" },
  { re: /HOTEL|MOTEL|EATING PLACE|EATING & DRINKING|TOYS|GAMES|SPORTING|ATHLETIC|DOLLS|HOBBY|MOTION PICTURE THEATER/, sector: "Consumer Discretionary", subsector: "Leisure & Hospitality" },
  { re: /RETAIL-|CATALOG & MAIL-ORDER|NONSTORE RETAIL/, sector: "Consumer Discretionary", subsector: "Retail" },
  { re: /HOUSEHOLD FURNITURE|HOUSEHOLD APPLIANCE|HOUSEHOLD AUDIO|FURNITURE|CARPET|RUGS|OFFICE FURNITURE/, sector: "Consumer Discretionary", subsector: "Other Consumer Discretionary" },

  // ── Materials ────────────────────────────────────────────────────────────
  { re: /CHEMICAL|PLASTIC MATERIAL|SYNTH RESIN|PAINT|VARNISH|ADHESIVE|SEALANT|AGRICULTURAL CHEMICAL|INDUSTRIAL ORGANIC|INDUSTRIAL INORGANIC/, sector: "Materials", subsector: "Chemicals" },
  { re: /GOLD|SILVER|METAL MINING|MINING|ORES|STEEL|ALUMINUM|NONFERROUS|SMELTING|FOUNDR|IRON|MINERAL/, sector: "Materials", subsector: "Metals & Mining" },
  { re: /PAPER|PAPERBOARD|CONTAINERS & BOXES|GLASS CONTAINER|PULP MILL/, sector: "Materials", subsector: "Paper & Packaging" },
  { re: /CEMENT|CONCRETE|LUMBER|WOOD PRODUCT|SAWMILL|BRICK|POTTERY|ABRASIVE|GLASS PRODUCT/, sector: "Materials", subsector: "Construction Materials" },

  // ── Industrials ──────────────────────────────────────────────────────────
  { re: /AIRCRAFT|GUIDED MISSILE|SPACE VEHICLE|ORDNANCE|SEARCH, DETECTION|AERONAUTICAL|SHIP & BOAT/, sector: "Industrials", subsector: "Aerospace & Defense" },
  { re: /AIR TRANSPORTATION|TRUCKING|RAILROAD|WATER TRANSPORTATION|TRANSPORTATION OF FREIGHT|COURIER|TRANSPORTATION SERVICE|ARRANGEMENT OF TRANSPORT|DEEP SEA|AIR COURIER|PUBLIC WAREHOUSING/, sector: "Industrials", subsector: "Transportation" },
  { re: /CONSTRUCTION|BUILDERS|ENGINEERING|HEAVY CONSTRUCTION|SPECIAL TRADE CONTRACTOR|WATER, SEWER|ELECTRICAL WORK|GENERAL BLDG/, sector: "Industrials", subsector: "Construction & Engineering" },
  { re: /ELECTRICAL INDUSTRIAL|MOTORS & GENERATOR|SWITCHGEAR|ELECTRIC LIGHTING|ELECTRIC HOUSEWARE|TRANSFORMER|ELECTRICAL APPARATUS|ELECTRICAL EQUIPMENT/, sector: "Industrials", subsector: "Electrical Equipment" },
  { re: /MACHINERY|PUMP|ENGINE|TURBINE|INDUSTRIAL INSTRUMENT|MEASURING & CONTROL|INDUSTRIAL & COMMERCIAL|FABRICATED METAL|METAL FORGING|METALWORK|VALVES|BEARING|FANS & BLOWER|REFRIGERATION|AIR-COND|HANDTOOL|HARDWARE|CUTLERY|INSTRUMENTS FOR MEAS|LABORATORY APPARATUS|MEASURING & CONTROLLING/, sector: "Industrials", subsector: "Machinery" },
  { re: /BUSINESS SERVICE|HELP SUPPLY|MANAGEMENT CONSULTING|MANAGEMENT SERVICE|EQUIPMENT RENTAL|AUTO RENTAL|SERVICES-TO DWELLINGS|REFUSE|HAZARDOUS WASTE|DETECTIVE|EMPLOYMENT AGENC|MAILING|PERSONAL SERVICE|ENGINEERING, ACCOUNTING|COMMERCIAL PHYSICAL|FACILITIES SUPPORT|EDUCATIONAL SERVICE|LEGAL SERVICE|CHILD DAY CARE|VIDEO TAPE RENTAL/, sector: "Industrials", subsector: "Commercial Services" },

  // ── Manufacturing long tail (catch-alls, after specific rules) ───────────
  { re: /OPTICAL INSTRUMENT|PHOTOGRAPHIC EQUIPMENT/, sector: "Technology", subsector: "Hardware & Devices" },
  { re: /TEXTILE|FABRIC MILL|BROADWOVEN|YARN|KNIT/, sector: "Consumer Discretionary", subsector: "Apparel & Luxury" },
  { re: /RUBBER|\bTIRE|PLASTICS PRODUCT|PLASTICS FOAM|PLASTIC MATERIAL/, sector: "Materials", subsector: "Chemicals" },
  { re: /METAL CAN|METAL CONTAINER/, sector: "Materials", subsector: "Paper & Packaging" },
  { re: /FABRICATED|STRUCTURAL METAL|METAL DOOR|METAL FORGING|PLATE WORK|PRIMARY METAL|COATING, ENGRAVING|METAL PRODUCT|BOILER/, sector: "Industrials", subsector: "Machinery" },
  { re: /PRINTING/, sector: "Industrials", subsector: "Commercial Services" },
  { re: /HEATING EQUIP|PLUMBING|INDUSTRIAL TRUCK|LAWN & GARDEN|FLUID METER|COUNTING DEVICE|EQUIPMENT, NEC/, sector: "Industrials", subsector: "Machinery" },
  { re: /AUTOMOTIVE REPAIR/, sector: "Consumer Discretionary", subsector: "Other Consumer Discretionary" },
  { re: /PATENT OWNER|LESSORS/, sector: "Industrials", subsector: "Commercial Services" },
  { re: /MANUFACTUR|TRANSPORTATION EQUIPMENT/, sector: "Industrials", subsector: "Other Industrials" },

  // ── Wholesale (long tail) → Industrials / Commercial Services ────────────
  { re: /WHOLESALE-DRUGS|WHOLESALE-MEDICAL/, sector: "Healthcare", subsector: "Providers & Services" },
  { re: /WHOLESALE-GROCERIES|WHOLESALE-FARM PRODUCT/, sector: "Consumer Staples", subsector: "Food & Beverage" },
  { re: /WHOLESALE-MOTOR VEHICLE/, sector: "Consumer Discretionary", subsector: "Automobiles" },
  { re: /WHOLESALE-PETROLEUM/, sector: "Energy", subsector: "Oil & Gas" },
  { re: /WHOLESALE-CHEMICAL/, sector: "Materials", subsector: "Chemicals" },
  { re: /WHOLESALE-METAL|WHOLESALE-LUMBER/, sector: "Materials", subsector: "Construction Materials" },
  { re: /WHOLESALE/, sector: "Industrials", subsector: "Commercial Services" },
];

// The nightly table carries raw SIC descriptions; the live fallback carries
// provider-level sector names. This alias map lets the same filters serve both.
const PROVIDER_SECTOR_ALIASES: Record<string, Sector> = {
  TECHNOLOGY: "Technology",
  "COMMUNICATION SERVICES": "Communication Services",
  "CONSUMER CYCLICAL": "Consumer Discretionary",
  "CONSUMER DEFENSIVE": "Consumer Staples",
  "FINANCIAL SERVICES": "Financials",
  HEALTHCARE: "Healthcare",
  INDUSTRIALS: "Industrials",
  ENERGY: "Energy",
  MATERIALS: "Materials",
  "REAL ESTATE": "Real Estate",
  UTILITIES: "Utilities",
};

/** Classify a raw SIC string into {sector, subsector}, or null if unmatched. */
export function classifySector(raw: string | null | undefined): SectorClass | null {
  if (!raw) return null;
  const s = raw.toUpperCase();
  const providerSector = PROVIDER_SECTOR_ALIASES[s];
  if (providerSector) {
    return { sector: providerSector, subsector: `Other ${providerSector}` };
  }
  for (const rule of RULES) {
    if (rule.re.test(s)) return { sector: rule.sector, subsector: rule.subsector };
  }
  return null;
}

/** Just the major sector for a raw SIC string (null if unmatched). */
export function sectorOf(raw: string | null | undefined): Sector | null {
  return classifySector(raw)?.sector ?? null;
}

/** Subsector for a raw SIC string, bucketing sector-but-no-subsector as Other. */
export function subsectorOf(raw: string | null | undefined): string | null {
  return classifySector(raw)?.subsector ?? null;
}
