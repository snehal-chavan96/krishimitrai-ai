import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.SQLITE_DB_PATH
  ? path.resolve(process.cwd(), process.env.SQLITE_DB_PATH)
  : path.join(DATA_DIR, 'krishimitra.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      publisher TEXT NOT NULL,
      crop TEXT NOT NULL DEFAULT 'General',
      region TEXT NOT NULL DEFAULT 'India',
      language TEXT NOT NULL DEFAULT 'en',
      publication_date TEXT NOT NULL,
      licence TEXT NOT NULL DEFAULT 'Public Agricultural Extension',
      content_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'failed')),
      chunk_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      page_number INTEGER NOT NULL DEFAULT 1,
      content TEXT NOT NULL,
      crop TEXT NOT NULL DEFAULT 'General',
      region TEXT NOT NULL DEFAULT 'India',
      language TEXT NOT NULL DEFAULT 'en',
      embedding_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'web',
      query_text TEXT NOT NULL,
      input_mode TEXT NOT NULL DEFAULT 'text',
      detected_language TEXT NOT NULL,
      response_language TEXT NOT NULL,
      intent TEXT NOT NULL,
      answer_text TEXT NOT NULL,
      decision TEXT NOT NULL CHECK (decision IN ('answered', 'refused', 'clarify')),
      confidence_score REAL NOT NULL DEFAULT 0,
      refusal_reason TEXT,
      citations_json TEXT NOT NULL DEFAULT '[]',
      latency_ms INTEGER NOT NULL DEFAULT 0,
      feedback TEXT CHECK (feedback IN ('up', 'down')),
      feedback_comment TEXT,
      expert_reviewed INTEGER NOT NULL DEFAULT 0,
      expert_correction TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS glossary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term_en TEXT NOT NULL,
      term_mr TEXT NOT NULL,
      term_hi TEXT NOT NULL,
      category TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evaluation_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_cases INTEGER NOT NULL,
      passed_cases INTEGER NOT NULL,
      retrieval_recall_at_5 REAL NOT NULL,
      faithfulness_rate REAL NOT NULL,
      safe_refusal_rate REAL NOT NULL,
      avg_latency_ms INTEGER NOT NULL,
      results_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

interface SeedDoc {
  title: string;
  filename: string;
  publisher: string;
  crop: string;
  region: string;
  language: string;
  publicationDate: string;
  licence: string;
  pages: Array<{ pageNumber: number; text: string }>;
}

const SEED_DOCUMENTS: SeedDoc[] = [
  {
    title: 'Cotton Crop Health, Leaf Yellowing & Pest Advisory',
    filename: 'ICAR_CICR_Cotton_Advisory_2025.pdf',
    publisher: 'ICAR-Central Institute for Cotton Research (CICR), Nagpur & MPKV Rahuri',
    crop: 'Cotton',
    region: 'Maharashtra',
    language: 'en',
    publicationDate: '2025-07-15',
    licence: 'Public Agricultural Advisory (ICAR Open Extension)',
    pages: [
      {
        pageNumber: 1,
        text: `Cotton (कापूस / कपास) Leaf Yellowing Diagnostic Guide:
1. Waterlogging & Drainage Stress: Prolonged rainfall or standing water in black cotton soils causes root hypoxia and premature yellowing of lower leaves. Open surface drainage channels immediately to drain excess water.
2. Nitrogen & Magnesium Deficiency (Lalya / लाल्या रोग): Uniform yellowing of older lower leaves indicates nitrogen deficiency, while interveinal yellowing or reddening indicates Magnesium deficiency. Apply foliar spray of Magnesium Sulphate (MgSO4) @ 1% (10 g/litre) with 1-2% Urea or 19:19:19 water-soluble fertilizer per KVK soil test guidance.
[MR] कापसाची पाने पिवळी पडण्याची मुख्य कारणे म्हणजे शेतात पाणी साचणे, नत्र व मॅग्नेशियमची कमतरता किंवा रस शोषक किडींचा प्रादुर्भाव. प्रथम शेतातील अतिरिक्त पाण्याचा निचरा करावा आणि पिवळेपणा/लाल्या रोगासाठी KVK च्या सल्ल्यानुसार १% मॅग्नेशियम सल्फेट (१० ग्रॅम/लिटर) व १९:१९:१९ ची फवारणी करावी.
[HI] कपास की पत्तियां पीली पड़ने के मुख्य कारण खेत में जलभराव, नाइट्रोजन या मैग्नीशियम की कमी और रस चूसक कीट हैं। तुरंत जल निकासी की नालियां साफ करें और KVK की सलाह से 1% मैग्नीशियम सल्फेट (10 ग्राम/लीटर) का छिड़काव करें।`,
      },
      {
        pageNumber: 2,
        text: `3. Sucking Pests (Jassids / तुडतुडे, Aphids, Whiteflies, Thrips): Yellowing and downward curling of cotton leaves is commonly caused by Jassids and Thrips. Install 5–8 yellow sticky traps per acre.
4. Safe IPM Intervention: Spray only above Economic Threshold Level (ETL: 2 jassids/leaf). Use Neem oil (Azadirachtin 1500 ppm @ 3–5 ml/litre) first, or approved Imidacloprid 17.8% SL strictly at label dose verified by KVK. Wear gloves and mask during calm hours.
[MR] रस शोषक किडींसाठी (तुडतुडे, पांढरी माशी) एकरी ५–८ पिवळे चिकट सापळे लावावेत आणि प्रथम निंबोळी अर्काची (३–५ मि.ली./लिटर) फवारणी करावी; रासायनिक फवारणीसाठी KVK च्या लेबल मात्रेचाच वापर करावा व मास्क/हातमोजे वापरावेत.
[HI] रस चूसक कीटों (हरा तेला, सफेद मक्खी) के लिए प्रति एकड़ 5–8 पीले चिपचिपे ट्रैप लगाएं और पहले नीम तेल (3–5 मिली/लीटर) का छिड़काव करें; हमेशा मास्क व दस्ताने पहनें।`,
      },
    ],
  },
  {
    title: 'Recommended Package of Practices for Wheat Cultivation',
    filename: 'ICAR_IIWBR_Wheat_Package_Practices.pdf',
    publisher: 'ICAR-Indian Institute of Wheat & Barley Research (IIWBR), Karnal',
    crop: 'Wheat',
    region: 'North & Central India',
    language: 'en',
    publicationDate: '2025-10-01',
    licence: 'Public Agricultural Advisory (ICAR)',
    pages: [
      {
        pageNumber: 1,
        text: `Recommended Practices for Growing Wheat (गहू / गेहूं):
1. Sowing Window & Varieties: Optimal timely sowing window for irrigated wheat is November 1 to November 25. Use rust-resistant varieties such as HD-2967, HD-3086, DBW-187, Lok-1, or MACS-6222. Use certified seed at 100 kg/hectare (40 kg/acre) at 20–22.5 cm row spacing and 4–5 cm depth.
[MR] गव्हाची पेरणी १ ते २५ नोव्हेंबर दरम्यान करावी; HD-2967, Lok-1 किंवा MACS-6222 सारखे तांबेरा प्रतिरोधक वाण हेक्टरी १०० किलो बियाणे (एकरी ४० किलो) वापरून २०–२२.५ सें.मी. अंतरावर पेरावेत.
[HI] गेहूं की समय पर बुवाई 1 से 25 नवंबर के बीच करें; HD-2967, HD-3086 या लोक-1 जैसी रोगरोधी किस्मों का 100 किग्रा/हेक्टेयर प्रमाणित बीज 20–22.5 सेमी कतार दूरी पर बोएं।`,
      },
      {
        pageNumber: 2,
        text: `2. Critical Irrigation & Nutrient Management: Apply 4 to 6 irrigations; Crown Root Initiation (CRI) at 21 days after sowing (DAS) is the most critical irrigation stage, followed by tillering (40–45 DAS), jointing, flowering, and grain filling. Split Nitrogen between basal sowing and first CRI irrigation based on Soil Health Card recommendations, and monitor for Yellow Rust.
[MR] गव्हाला पेरणीनंतर २१ दिवसांनी (मुकुटमुळे फुटण्याची अवस्था - CRI) पहिले अत्यंत महत्त्वाचे पाणी द्यावे आणि मृद आरोग्य पत्रिकेनुसार नत्र खताचा हप्ता विभागून द्यावा.
[HI] गेहूं में बुवाई के 21 दिन बाद (CRI अवस्था) पहली सिंचाई अत्यंत महत्वपूर्ण है; मृदा स्वास्थ्य कार्ड के अनुसार संतुलित उर्वरक और पीला रतुआ की निगरानी करें।`,
      },
    ],
  },
  {
    title: 'Soybean Cultivation, Pest & Disease Care Advisory',
    filename: 'MPKV_IISR_Soybean_Care_Guide.pdf',
    publisher: 'MPKV Rahuri & ICAR-Indian Institute of Soybean Research, Indore',
    crop: 'Soybean',
    region: 'Maharashtra & Madhya Pradesh',
    language: 'en',
    publicationDate: '2025-06-20',
    licence: 'Public University Extension Bulletin',
    pages: [
      {
        pageNumber: 1,
        text: `Soybean (सोयाबीन) Crop Care & Management Guidelines:
Sow soybean after 75–100 mm monsoon rain at 3–4 cm depth with 45x5 cm spacing, preferably on Broad Bed Furrow (BBF) to prevent waterlogging. Treat seeds with Rhizobium japonicum + PSB (250 g per 10 kg seed) after Trichoderma seed dressing.
[MR] सोयाबीनची पेरणी ७५–१०० मि.मी. पावसानंतर ३–४ सें.मी. खोलीवर बीबीएफ (BBF / सरी वरंबा) पद्धतीने करावी आणि बियाण्यास रायझोबियम + पीएसबी (२५० ग्रॅम प्रति १० किलो बियाणे) बीजप्रक्रिया करावी.
[HI] सोयाबीन की बुवाई 75–100 मिमी बारिश के बाद 3–4 सेमी गहराई पर BBF (मेड़-नाली) विधि से करें और 10 किग्रा बीज पर 250 ग्राम राइजोबियम व पीएसबी से बीजोपचार करें।`,
      },
      {
        pageNumber: 2,
        text: `Keep the field weed-free for the first 30–45 days. Monitor for Girdle Beetle (चक्रभुंगा), Stem Fly, and Yellow Mosaic Virus (YMV). Uproot YMV-infected plants early, install bird perches (10–12/acre) and pheromone traps (5/acre). Harvest when 95% of pods turn yellow-brown to avoid shattering.
[MR] सुरुवातीचे ३०–४५ दिवस तणमुक्त ठेवावेत; चक्रभुंगा व पिवळा मोझॅक रोगासाठी शेताची पाहणी करून रोगट झाडे उपटून नष्ट करावीत व ९५% शेंगा पिवळ्या पडल्यावर कापणी करावी.
[HI] शुरुआती 30–45 दिनों तक खेत को खरपतवार-मुक्त रखें, गर्डल बीटल व पीला मोज़ेक रोग की निगरानी करें और 95% फलियां पीली पड़ने पर कटाई करें।`,
      },
    ],
  },
  {
    title: 'Central Government Agricultural Schemes Compendium for Farmers',
    filename: 'MoAFW_Farmer_Schemes_Compendium_2025.pdf',
    publisher: 'Ministry of Agriculture & Farmers Welfare, Government of India',
    crop: 'General',
    region: 'India',
    language: 'en',
    publicationDate: '2025-08-10',
    licence: 'Government of India Public Circular',
    pages: [
      {
        pageNumber: 1,
        text: `Key Government Schemes Available for Farmers:
1. PM-KISAN (Pradhan Mantri Kisan Samman Nidhi): ₹6,000 per year in three ₹2,000 installments directly into Aadhaar-seeded bank accounts after land seeding and e-KYC.
2. PMFBY (Pradhan Mantri Fasal Bima Yojana): Crop insurance against drought, flood, hailstorm, and post-harvest losses (farmer premium share: 2% Kharif, 1.5% Rabi, 5% commercial/horticultural).
3. Kisan Credit Card (KCC) & Soil Health Card: Crop loans at 4% effective interest with prompt-repayment subvention, plus plot-wise soil testing every 2 years. Verify deadlines at CSC or Kisan Call Centre (1800-180-1551).
[MR] शेतकऱ्यांसाठी मुख्य सरकारी योजना: पीएम-किसान (वर्षाला ₹६,००० तीन हप्त्यांत, e-KYC आवश्यक), प्रधानमंत्री पीक विमा योजना (खरीप २%, रब्बी १.५% विमा हप्ता), किसान क्रेडिट कार्ड (४% प्रभावी व्याजदर) आणि मृद आरोग्य पत्रिका. अर्जासाठी जवळच्या CSC केंद्र किंवा १८००-१८०-१५५१ वर संपर्क साधा.
[HI] किसानों के लिए प्रमुख सरकारी योजनाएं: पीएम-किसान सम्मान निधि (₹6,000 सालाना 3 किस्तों में, e-KYC अनिवार्य), प्रधानमंत्री फसल बीमा योजना (खरीफ 2%, रबी 1.5% प्रीमियम), किसान क्रेडिट कार्ड (4% प्रभावी ब्याज) और मृदा स्वास्थ्य कार्ड उपलब्ध हैं।`,
      },
    ],
  },
  {
    title: 'Safe Pesticide Handling & Integrated Pest Management (IPM) Guidelines',
    filename: 'DPPQS_Safe_Pesticide_IPM_2025.pdf',
    publisher: 'Directorate of Plant Protection, Quarantine & Storage (DPPQS)',
    crop: 'General',
    region: 'India',
    language: 'en',
    publicationDate: '2025-05-01',
    licence: 'Public Regulatory Safety Manual',
    pages: [
      {
        pageNumber: 1,
        text: `Mandatory Pesticide Safety Precautions:
1. Never exceed label dosage or mix incompatible pesticides without KVK approval.
2. Strictly avoid banned/restricted Class Ia/Ib chemicals like Monocrotophos on vegetables and follow the pre-harvest interval (PHI).
3. Always wear chemical-resistant gloves, mask, goggles, and full-sleeve clothes; spray along wind direction during calm morning/evening hours, and never in winds above 15 km/h.
[MR] कीटकनाशक सुरक्षितता नियम: कधीही शिफारशीपेक्षा जास्त मात्रा किंवा अनावश्यक मिश्रण करू नका, प्रतिबंधित रसायने टाळा, आणि फवारणी करताना हातमोजे व मास्क वापरून वाऱ्याच्या दिशेनेच फवारणी करावी.
[HI] कीटनाशक सुरक्षा नियम: कभी भी निर्धारित मात्रा से अधिक या प्रतिबंधित रसायनों का उपयोग न करें; छिड़काव करते समय हमेशा दस्ताने और मास्क पहनें तथा हवा की दिशा में छिड़काव करें।`,
      },
    ],
  },
];

const SEED_GLOSSARY = [
  { term_en: 'Cotton', term_mr: 'कापूस', term_hi: 'कपास', category: 'crop' },
  { term_en: 'Soybean', term_mr: 'सोयाबीन', term_hi: 'सोयाबीन', category: 'crop' },
  { term_en: 'Wheat', term_mr: 'गहू', term_hi: 'गेहूं', category: 'crop' },
  { term_en: 'Onion', term_mr: 'कांदा', term_hi: 'प्याज', category: 'crop' },
  { term_en: 'Yellowing of leaves', term_mr: 'पाने पिवळी पडणे', term_hi: 'पत्तियां पीली पड़ना', category: 'pest' },
  { term_en: 'Jassids', term_mr: 'तुडतुडे', term_hi: 'हरा तेला', category: 'pest' },
  { term_en: 'Whitefly', term_mr: 'पांढरी माशी', term_hi: 'सफेद मक्खी', category: 'pest' },
  { term_en: 'Girdle Beetle', term_mr: 'चक्रभुंगा', term_hi: 'गर्डल बीटल', category: 'pest' },
  { term_en: 'Yellow Rust', term_mr: 'पिवळा तांबेरा', term_hi: 'पीला रतुआ', category: 'pest' },
  { term_en: 'Crop Insurance (PMFBY)', term_mr: 'पीक विमा योजना', term_hi: 'फसल बीमा योजना', category: 'scheme' },
  { term_en: 'PM-KISAN', term_mr: 'पीएम-किसान सन्मान निधी', term_hi: 'पीएम-किसान सम्मान निधि', category: 'scheme' },
  { term_en: 'Neem Oil (Azadirachtin)', term_mr: 'निंबोळी अर्क / निम तेल', term_hi: 'नीम तेल', category: 'chemical' },
];

export function seedInitialData(): void {
  const existingDocs = db.prepare('SELECT COUNT(*) as cnt FROM documents').get() as { cnt: number };
  if (existingDocs.cnt === 0) {
    const insertDoc = db.prepare(`
      INSERT INTO documents (title, filename, publisher, crop, region, language, publication_date, licence, content_hash, status, chunk_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
    `);
    const insertChunk = db.prepare(`
      INSERT INTO chunks (document_id, chunk_index, page_number, content, crop, region, language, embedding_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `);

    const tx = db.transaction(() => {
      for (const doc of SEED_DOCUMENTS) {
        const fullText = doc.pages.map((p) => p.text).join('\n');
        const hash = crypto.createHash('sha256').update(fullText).digest('hex');
        const res = insertDoc.run(
          doc.title,
          doc.filename,
          doc.publisher,
          doc.crop,
          doc.region,
          doc.language,
          doc.publicationDate,
          doc.licence,
          hash,
          doc.pages.length
        );
        const docId = Number(res.lastInsertRowid);
        doc.pages.forEach((p, idx) => {
          insertChunk.run(docId, idx, p.pageNumber, p.text, doc.crop, doc.region, doc.language);
        });
      }
    });
    tx();
  }

  const existingGlossary = db.prepare('SELECT COUNT(*) as cnt FROM glossary').get() as { cnt: number };
  if (existingGlossary.cnt === 0) {
    const insertGloss = db.prepare(
      'INSERT INTO glossary (term_en, term_mr, term_hi, category) VALUES (?, ?, ?, ?)'
    );
    const tx = db.transaction(() => {
      for (const g of SEED_GLOSSARY) {
        insertGloss.run(g.term_en, g.term_mr, g.term_hi, g.category);
      }
    });
    tx();
  }
}
