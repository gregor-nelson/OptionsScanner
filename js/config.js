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
    EXPIRATION_GTE: '2027-01-01',
    EXPIRATION_LTE: null,     // No upper bound by default
    PRICE_MIN: 0.05,
    PRICE_MAX: 0.25,
    PRICE_FIELD: 'last',      // 'ask', 'bid', 'last', 'mid' - use 'last' as illiquid options often lack quotes
    DELTA_MIN: 0,
    DELTA_MAX: 1.0,
    IV_MIN: 0,
    IV_MAX: 1.0,              // 100%
    MIN_OPEN_INTEREST: 0,
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
  { ticker: 'EFXT', company: 'Enerflex Ltd', industry: 'Oil & Gas Equipment & Services', country: 'Canada' },
  { ticker: 'MPLX', company: 'MPLX LP', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'XPRO', company: 'Expro Group Holdings NV', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'OIS', company: 'Oil States International Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'WTTR', company: 'Select Water Solutions Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'WTI', company: 'W&T Offshore Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'TDW', company: 'Tidewater Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'TK', company: 'Teekay Corporation Ltd', industry: 'Oil & Gas Midstream', country: 'Bermuda' },
  
  // Page 7 additions
  { ticker: 'IEP', company: 'Icahn Enterprises LP', industry: 'Oil & Gas Refining & Marketing', country: 'USA' },
  { ticker: 'WKC', company: 'World Kinect Corp', industry: 'Oil & Gas Refining & Marketing', country: 'USA' },
  { ticker: 'ACDC', company: 'ProFrac Holding Corp', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'WHD', company: 'Cactus Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'HPK', company: 'HighPeak Energy Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'BKV', company: 'BKV Corp', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'EGY', company: 'VAALCO Energy Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'CRC', company: 'California Resources Corporation', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'CNR', company: 'Core Natural Resources Inc', industry: 'Thermal Coal', country: 'USA' },
  { ticker: 'HNRG', company: 'Hallador Energy Co', industry: 'Thermal Coal', country: 'USA' },
  { ticker: 'TS', company: 'Tenaris S.A. ADR', industry: 'Oil & Gas Equipment & Services', country: 'Luxembourg' },
  { ticker: 'AMPY', company: 'Amplify Energy Corp', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'OII', company: 'Oceaneering International Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'VTS', company: 'Vitesse Energy Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'EPM', company: 'Evolution Petroleum Corporation', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'GPRK', company: 'Geopark Limited', industry: 'Oil & Gas E&P', country: 'Colombia' },
  { ticker: 'BRY', company: 'Berry Corp', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'NPKI', company: 'NPK International Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'NGL', company: 'NGL Energy Partners LP', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'WBI', company: 'WaterBridge Infrastructure LLC', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  
  // Page 8 additions
  { ticker: 'SOBO', company: 'South Bow Corp', industry: 'Oil & Gas Midstream', country: 'Canada' },
  { ticker: 'KRP', company: 'Kimbell Royalty Partners LP', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'GRNT', company: 'Granite Ridge Resources Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'TNK', company: 'Teekay Tankers Ltd', industry: 'Oil & Gas Midstream', country: 'Bermuda' },
  { ticker: 'CHRD', company: 'Chord Energy Corp', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'WDS', company: 'Woodside Energy Group Ltd ADR', industry: 'Oil & Gas E&P', country: 'Australia' },
  { ticker: 'LPG', company: 'Dorian LPG Ltd', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'FLNG', company: 'Flex LNG Ltd', industry: 'Oil & Gas Midstream', country: 'Bermuda' },
  { ticker: 'EE', company: 'Excelerate Energy Inc', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'SND', company: 'Smart Sand Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'NFG', company: 'National Fuel Gas Co', industry: 'Oil & Gas Integrated', country: 'USA' },
  { ticker: 'LB', company: 'Landbridge Company LLC', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'INSW', company: 'International Seaways Inc', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'VIST', company: 'Vista Energy S.A.B. de C.V ADR', industry: 'Oil & Gas E&P', country: 'Mexico' },
  { ticker: 'MVO', company: 'MV Oil Trust', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'CLB', company: 'Core Laboratories Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'GTE', company: 'Gran Tierra Energy Inc', industry: 'Oil & Gas E&P', country: 'Canada' },
  { ticker: 'BSM', company: 'Black Stone Minerals LP', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'GEL', company: 'Genesis Energy LP', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'TRMD', company: 'Torm Plc', industry: 'Oil & Gas Midstream', country: 'United Kingdom' },
  
  // Page 9 additions
  { ticker: 'SD', company: 'SandRidge Energy Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'NVGS', company: 'Navigator Holdings Ltd', industry: 'Oil & Gas Midstream', country: 'United Kingdom' },
  { ticker: 'INVX', company: 'Innovex International Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'IMO', company: 'Imperial Oil Ltd', industry: 'Oil & Gas Integrated', country: 'Canada' },
  { ticker: 'FTK', company: 'Flotek Industries Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'TEN', company: 'Tsakos Energy Navigation Limited', industry: 'Oil & Gas Midstream', country: 'Greece' },
  { ticker: 'TORO', company: 'Toro Corp', industry: 'Oil & Gas Midstream', country: 'Cyprus' },
  { ticker: 'MNR', company: 'Mach Natural Resources LP', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'TXO', company: 'TXO Partners LP', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'SUN', company: 'Sunoco LP', industry: 'Oil & Gas Refining & Marketing', country: 'USA' },
  { ticker: 'NBR', company: 'Nabors Industries Ltd', industry: 'Oil & Gas Drilling', country: 'Bermuda' },
  { ticker: 'GPOR', company: 'Gulfport Energy Corp', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'USAC', company: 'USA Compression Partners LP', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'KNOP', company: 'KNOT Offshore Partners LP', industry: 'Oil & Gas Midstream', country: 'United Kingdom' },
  { ticker: 'VTOL', company: 'Bristow Group Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'TPL', company: 'Texas Pacific Land Corporation', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'OBE', company: 'Obsidian Energy Ltd', industry: 'Oil & Gas E&P', country: 'Canada' },
  { ticker: 'GEOS', company: 'Geospace Technologies Corp', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'DMLP', company: 'Dorchester Minerals LP', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'KLXE', company: 'KLX Energy Services Holdings Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  
  // Page 10 additions
  { ticker: 'E', company: 'Eni SpA ADR', industry: 'Oil & Gas Integrated', country: 'Italy' },
  { ticker: 'EPSN', company: 'Epsilon Energy Ltd', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'ARLP', company: 'Alliance Resource Partners LP', industry: 'Thermal Coal', country: 'USA' },
  { ticker: 'REPX', company: 'Riley Exploration Permian Inc', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'PDS', company: 'Precision Drilling Corp', industry: 'Oil & Gas Drilling', country: 'Canada' },
  { ticker: 'TGS', company: 'Transportadora de Gas del Sur ADR', industry: 'Oil & Gas Integrated', country: 'Argentina' },
  { ticker: 'CQP', company: 'Cheniere Energy Partners LP', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'RNGR', company: 'Ranger Energy Services Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'NOA', company: 'North American Construction Group Ltd', industry: 'Oil & Gas Equipment & Services', country: 'Canada' },
  { ticker: 'SJT', company: 'San Juan Basin Royalty Trust', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'PBT', company: 'Permian Basin Royalty Trust', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'FET', company: 'Forum Energy Technologies Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'NGS', company: 'Natural Gas Services Group Inc', industry: 'Oil & Gas Equipment & Services', country: 'USA' },
  { ticker: 'SGU', company: 'Star Group LP', industry: 'Oil & Gas Refining & Marketing', country: 'USA' },
  { ticker: 'PVL', company: 'Permianville Royalty Trust', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'VOC', company: 'VOC Energy Trust', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'GLP', company: 'Global Partners LP', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'DKL', company: 'Delek Logistics Partners LP', industry: 'Oil & Gas Refining & Marketing', country: 'USA' },
  { ticker: 'SMC', company: 'Summit Midstream Corp', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'DLNG', company: 'Dynagas LNG Partners LP', industry: 'Oil & Gas Midstream', country: 'Greece' },
  
  // Page 11 additions (final)
  { ticker: 'NRT', company: 'North European Oil Royalty Trust', industry: 'Oil & Gas E&P', country: 'USA' },
  { ticker: 'MMLP', company: 'Martin Midstream Partners LP', industry: 'Oil & Gas Midstream', country: 'USA' },
  { ticker: 'CAPL', company: 'CrossAmerica Partners LP', industry: 'Oil & Gas Refining & Marketing', country: 'USA' },
  { ticker: 'NRP', company: 'Natural Resource Partners LP', industry: 'Thermal Coal', country: 'USA' },
  { ticker: 'RCON', company: 'Recon Technology Ltd', industry: 'Oil & Gas Equipment & Services', country: 'China' }
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