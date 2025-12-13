/**
 * Configuration for the Energy Options Scanner
 * 
 * IMPORTANT: Replace API_KEY with your actual Massive.com (Polygon.io) API key
 */

export const CONFIG = {
  // API Key - Replace with your actual key
  API_KEY: 'Rs2eApMa3yJBr4TvR9m3ZB9WrLGZrhUM',
  
  // API Settings
  API: {
    BASE_URL: 'https://api.polygon.io',
    CONCURRENCY: 2,           // Max parallel requests
    REQUEST_DELAY: 350,       // ms between request batches
    MAX_RETRIES: 3,           // Retry attempts on failure
    RETRY_DELAY: 1000,        // Initial retry delay (doubles each retry)
    PAGE_LIMIT: 250           // Max results per page (API max)
  },
  
  // Default scan parameters
  DEFAULTS: {
    CONTRACT_TYPE: 'call',
    EXPIRATION_GTE: '2026-01-01',
    EXPIRATION_LTE: null,     // No upper bound by default
    PRICE_MIN: 0.05,
    PRICE_MAX: 0.25,
    PRICE_FIELD: 'last',      // 'ask', 'bid', 'last', 'mid' - use 'last' as illiquid options often lack quotes
    DELTA_MIN: 0,
    DELTA_MAX: 0.40,
    IV_MIN: 0,
    IV_MAX: 1.0,              // 100%
    MIN_OPEN_INTEREST: 50,
    MIN_VOLUME: 0,
    SORT_BY: 'ask',
    SORT_DIR: 'asc'
  }
};

/**
 * Default Energy Sector Universe
 * Source: Finviz Energy sector, filtered by options volume
 * Last updated: 2024-12-13
 */
export const DEFAULT_UNIVERSE = [
  // Original entries
  { ticker: 'XOM', company: 'Exxon Mobil Corp', industry: 'Oil & Gas Integrated', country: 'USA' },
  { ticker: 'CVE', company: 'Cenovus Energy Inc', industry: 'Oil & Gas Integrated', country: 'Canada' },
  { ticker: 'SLB', company: 'SLB Ltd', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'HAL', company: 'Halliburton Co', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'ET', company: 'Energy Transfer LP', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'KMI', company: 'Kinder Morgan Inc', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'DVN', company: 'Devon Energy Corp', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'EQT', company: 'EQT Corp', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'CTRA', company: 'Coterra Energy Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'PR', company: 'Permian Resources Corp', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'CNQ', company: 'Canadian Natural Resources', industry: 'Oil & Gas E&P', country: 'Canada' },
  { ticker: 'BTE', company: 'Baytex Energy Corp', industry: 'Oil & Gas E&P', country: 'Canada' },
  { ticker: 'RIG', company: 'Transocean Ltd', industry: 'Oil & Gas Drilling', country: 'Switzerland' },
  { ticker: 'PBR', company: 'Petroleo Brasileiro S.A.', industry: 'Oil & Gas Integrated', country: 'Brazil' },
  { ticker: 'DNN', company: 'Denison Mines Corp', industry: 'Uranium', country: 'Canada' },
  { ticker: 'UEC', company: 'Uranium Energy Corp', industry: 'Uranium', country: 'USA' },
  { ticker: 'UUUU', company: 'Energy Fuels Inc', industry: 'Uranium', country: 'USA' },
  { ticker: 'CRGY', company: 'Crescent Energy Co', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'KOS', company: 'Kosmos Energy Ltd', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'VG', company: 'Venture Global Inc', industry: 'Oil & Gas Midstream', country: 'USA' },
  
  // Page 2 additions
  { ticker: 'SU', company: 'Suncor Energy Inc', industry: 'Oil & Gas Integrated', country: 'Canada' },
  { ticker: 'NEXT', company: 'NextDecade Corporation', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'OXY', company: 'Occidental Petroleum Corp', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'PBR-A', company: 'Petroleo Brasileiro S.A. Petrobras ADR (Preferred)', industry: 'Oil & Gas Integrated', country: 'Brazil' },
  { ticker: 'WMB', company: 'Williams Cos Inc', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'NFE', company: 'New Fortress Energy Inc', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'BP', company: 'BP plc ADR', industry: 'Oil & Gas Integrated', country: 'United Kingdom' },
  { ticker: 'NXE', company: 'NexGen Energy Ltd', industry: 'Uranium', country: 'Canada' },
  { ticker: 'SEI', company: 'Solaris Energy Infrastructure Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'CVX', company: 'Chevron Corp', industry: 'Oil & Gas Integrated', country: 'USA' },
  { ticker: 'PTEN', company: 'Patterson-UTI Energy Inc', industry: 'Oil & Gas Drilling', country: 'USA' },
  { ticker: 'SOC', company: 'Sable Offshore Corp', industry: 'Oil & Gas Drilling', country: 'USA' },
  { ticker: 'COP', company: 'Conoco Phillips', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'CCJ', company: 'Cameco Corp', industry: 'Uranium', country: 'Canada' },
  { ticker: 'BKR', company: 'Baker Hughes Co', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'BORR', company: 'Borr Drilling Ltd', industry: 'Oil & Gas Drilling', country: 'Bermuda' },
  { ticker: 'LBRT', company: 'Liberty Energy Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'PUMP', company: 'ProPetro Holding Corp', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'RRC', company: 'Range Resources Corp', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'APA', company: 'APA Corporation', industry: 'Oil & Gas E&P', country: 'USA' },
  
  // Page 3 additions
  { ticker: 'AR', company: 'Antero Resources Corp', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'SHEL', company: 'Shell Plc ADR', industry: 'Oil & Gas Integrated', country: 'United Kingdom' },
  { ticker: 'NOV', company: 'NOV Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'EOG', company: 'EOG Resources Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'PBF', company: 'PBF Energy Inc', industry: 'Oil & Gas Refining & Marketing', country: 'USA' },
  { ticker: 'VLO', company: 'Valero Energy Corp', industry: 'Oil & Gas Refining & Marketing', country: 'USA' },
  { ticker: 'LNG', company: 'Cheniere Energy Inc', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'PAA', company: 'Plains All American Pipeline LP', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'CNX', company: 'CNX Resources Corp', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'EPD', company: 'Enterprise Products Partners LP', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'OVV', company: 'Ovintiv Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'BTU', company: 'Peabody Energy Corp', industry: 'Thermal Coal', country: 'USA' },
  { ticker: 'OKE', company: 'Oneok Inc', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'UGP', company: 'Ultrapar Participacoes S.A. ADR', industry: 'Oil & Gas Refining & Marketing', country: 'Brazil' },
  { ticker: 'VTLE', company: 'Vital Energy Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'MUR', company: 'Murphy Oil Corp', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'NOG', company: 'Northern Oil and Gas Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'CRK', company: 'Comstock Resources Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'MGY', company: 'Magnolia Oil & Gas Corp', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'NINE', company: 'Nine Energy Service Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  
  // Page 4 additions
  { ticker: 'EQNR', company: 'Equinor ASA ADR', industry: 'Oil & Gas Integrated', country: 'Norway' },
  { ticker: 'MPC', company: 'Marathon Petroleum Corp', industry: 'Oil & Gas Refining & Marketing', country: 'USA' },
  { ticker: 'SM', company: 'SM Energy Co', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'EXE', company: 'Expand Energy Corp', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'NAT', company: 'Nordic American Tankers Ltd', industry: 'Oil & Gas Midstream', country: 'Bermuda' },
  { ticker: 'PROP', company: 'Prairie Operating Co', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'CMBT', company: 'CMB.Tech NV', industry: 'Oil & Gas Midstream', country: 'Belgium' },
  { ticker: 'FTI', company: 'TechnipFMC plc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'ENB', company: 'Enbridge Inc', industry: 'Oil & Gas Midstream', country: 'Canada' },
  { ticker: 'AM', company: 'Antero Midstream Corp', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'DINO', company: 'HF Sinclair Corp', industry: 'Oil & Gas Refining & Marketing', country: 'USA' },
  { ticker: 'EU', company: 'enCore Energy Corp', industry: 'Uranium', country: 'USA' },
  { ticker: 'PSX', company: 'Phillips 66', industry: 'Oil & Gas Refining & Marketing', country: 'USA' },
  { ticker: 'NE', company: 'Noble Corp Plc', industry: 'Oil & Gas Drilling', country: 'USA' },
  { ticker: 'FRO', company: 'Frontline Plc', industry: 'Oil & Gas Midstream', country: 'Cyprus' },
  { ticker: 'AROC', company: 'Archrock Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'AESI', company: 'Atlas Energy Solutions Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'REI', company: 'Ring Energy Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'HP', company: 'Helmerich & Payne Inc', industry: 'Oil & Gas Drilling', country: 'USA' },
  { ticker: 'UROY', company: 'Uranium Royalty Corp', industry: 'Uranium', country: 'Canada' },
  
  // Page 5 additions
  { ticker: 'PARR', company: 'Par Pacific Holdings Inc', industry: 'Oil & Gas Refining & Marketing', country: 'USA' },
  { ticker: 'IMPP', company: 'Imperial Petroleum Inc', industry: 'Oil & Gas Midstream', country: 'Greece' },
  { ticker: 'RES', company: 'RPC Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'TALO', company: 'Talos Energy Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'PAGP', company: 'Plains GP Holdings LP', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'HESM', company: 'Hess Midstream LP', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'STNG', company: 'Scorpio Tankers Inc', industry: 'Oil & Gas Midstream', country: 'Monaco' },
  { ticker: 'DK', company: 'Delek US Holdings Inc', industry: 'Oil & Gas Refining & Marketing', country: 'USA' },
  { ticker: 'FANG', company: 'Diamondback Energy Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'VAL', company: 'Valaris Ltd', industry: 'Oil & Gas Equipment & Services', country: 'Bermuda' },
  { ticker: 'EC', company: 'Ecopetrol SA ADR', industry: 'Oil & Gas Integrated', country: 'Colombia' },
  { ticker: 'DTM', company: 'DT Midstream Inc', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'VNOM', company: 'Viper Energy Inc', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'VET', company: 'Vermilion Energy Inc', industry: 'Oil & Gas E&P', country: 'Canada' },
  { ticker: 'MTDR', company: 'Matador Resources Co', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'PBA', company: 'Pembina Pipeline Corporation', industry: 'Oil & Gas Midstream', country: 'Canada' },
  { ticker: 'TRGP', company: 'Targa Resources Corp', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'DHT', company: 'DHT Holdings Inc', industry: 'Oil & Gas Midstream', country: 'Bermuda' },
  { ticker: 'WES', company: 'Western Midstream Partners LP', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'KGS', company: 'Kodiak Gas Services Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  
  // Page 6 additions
  { ticker: 'HLX', company: 'Helix Energy Solutions Group Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'KNTK', company: 'Kinetik Holdings Inc', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'CIVI', company: 'Civitas Resources Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'GLNG', company: 'Golar LNG', industry: 'Oil & Gas Midstream', country: 'Bermuda' },
  { ticker: 'TTE', company: 'TotalEnergies SE', industry: 'Oil & Gas Integrated', country: 'France' },
  { ticker: 'SDRL', company: 'Seadrill Ltd', industry: 'Oil & Gas Drilling', country: 'Bermuda' },
  { ticker: 'YPF', company: 'YPF ADR', industry: 'Oil & Gas Integrated', country: 'Argentina' },
  { ticker: 'LEU', company: 'Centrus Energy Corp', industry: 'Uranium', country: 'USA' },
  { ticker: 'TRP', company: 'TC Energy Corporation', industry: 'Oil & Gas Midstream', country: 'Canada' },
  { ticker: 'CVI', company: 'CVR Energy Inc', industry: 'Oil & Gas Refining & Marketing', country: 'USA' },
  { ticker: 'CLNE', company: 'Clean Energy Fuels Corp', industry: 'Oil & Gas Refining & Marketing', country: 'USA' },
  { ticker: 'WFRD', company: 'Weatherford International plc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'MPLX', company: 'MPLX LP', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'XPRO', company: 'Expro Group Holdings NV', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'OIS', company: 'Oil States International Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'WTTR', company: 'Select Water Solutions Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'WTI', company: 'W&T Offshore Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'TDW', company: 'Tidewater Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'IEP', company: 'Icahn Enterprises LP', industry: 'Oil & Gas Refining & Marketing', country: 'USA' },
  { ticker: 'WKC', company: 'World Kinect Corp', industry: 'Oil & Gas Refining & Marketing', country: 'USA' }
];

/**
 * Industry categories for filtering
 */
export const INDUSTRIES = [
  'Oil & Gas Integrated',
  'Oil & Gas E&P',
  'Oil & Gas Equipment & Services',
  'Oil & Gas Midstream',
  'Oil & Gas Drilling',
  'Oil & Gas Refining & Marketing',
  'Uranium',
  'Thermal Coal'
];