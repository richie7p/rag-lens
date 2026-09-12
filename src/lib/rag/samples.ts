export type GoldFact = {
  id: string;
  label: string;
  /** All needles must co-occur in one chunk for the fact to count as intact. */
  needles: string[];
  /** Looser tokens used to check whether an answer mentioned the fact. */
  mentions?: string[];
};

export type SampleDoc = {
  id: string;
  title: string;
  language: "zh" | "en";
  query: string;
  text: string;
  facts: GoldFact[];
};

const ZH_FACTS: GoldFact[] = [
  {
    id: "wl",
    label: "額定波長 940 nm",
    needles: ["額定波長是 940"],
    mentions: ["940"],
  },
  {
    id: "fail",
    label: "鹽霧 >82°C 層間剝離",
    needles: ["超過 82", "FL-HEL-19"],
    mentions: ["82", "層間剝離"],
  },
];

const EN_FACTS: GoldFact[] = [
  {
    id: "wl",
    label: "940 nm rating",
    needles: ["rated for 940"],
    mentions: ["940"],
  },
  {
    id: "fail",
    label: "salt-fog delamination >82C",
    needles: ["exceeds 82", "FL-HEL-19"],
    mentions: ["82", "delaminat"],
  },
];

const ZH = [
  "光摺光學（Lumenfold Optics）內部簡報 — 虛構文件，僅供 RAG 示範。真實世界不存在這間公司、產品或價格。",
  "一、公司沿革",
  "光摺光學由陳美玲博士於 2014 年在高雄成立。2026 年編制 186 人，研發 62 人、製造 71 人、其餘為業務與支援。總部在亞洲新灣區海音中心 14 樓，不是台北，也不是新竹。主要客戶是車用 lidar 模組廠，前三大佔營收 61%。公司登記資本額 NT$2.4 億，尚未上市。",
  "二、旗艦產品 Helix-9",
  "Helix-9 是多層介電鍍膜，用於 lidar 視窗。額定波長是 940 nm，不是 1550 nm。峰值穿透率 99.2%，入射角 0 到 25 度內維持 98.5% 以上。保固 18 個月，不是 24 個月。出貨單位是平方公尺，最小訂單 2 m2。鍍膜層數為 11 層，最外層為氧化矽。",
  "三、失效模式與現場通告",
  "Helix-9 在鹽霧環境、表面溫度超過 82°C 時會發生層間剝離。2023 年現場通告 FL-HEL-19 要求：2024 年 3 月前出貨的批次須更換。實驗室循環測試顯示，65°C 以下鹽霧 96 小時無剝離。剝離後穿透率會掉到 91% 以下，lidar 有效距離約少 18%。不可用酒精以外的溶劑清潔，丙酮會傷頂層。",
  "四、競品對照",
  "大阪 NadirGlass 與斯圖加特 Prismora 都沒有鹽霧等級標示。Prismora 的 Vega-3 只支援 1550 nm，不能直接替換 Helix-9。NadirGlass 的 K-Lite 標稱 940 nm，但峰值穿透率只有 97.1%，且無 82°C 數據。業務簡報禁止把 Vega-3 寫成「等效替代」。",
  "五、價格與授權",
  "Helix-9 牌價每平方公尺 NT$48,600。40 m2 起有量價，80 m2 以上可談年度框。內部成本目標 NT$21,400。業務不得對客戶承諾低於 NT$36,000 的專案價，除非經財務副總核准。樣品片 150 mm 方形，每片 NT$2,800，不折抵正式訂單。",
  "六、下一世代 Aperture-2",
  "Aperture-2 預計 2027 年第三季小量，將加上疏水頂層並支援 1550 nm。目前尚未出貨。對客戶不得承諾本季交付 Aperture-2。原型機只在高雄實驗室，共 4 片，序號 AP2-001 到 AP2-004。量產線預定放在路竹，不是新灣區總部。",
  "七、已知誤傳",
  "外部分析師常把總部寫成台北、把波長寫成 1550 nm、把保固寫成兩年、把人數寫成 400。內部文件以本簡報為準。若媒體來問 Aperture-2 時程，統一回覆「仍在驗證，沒有公開交期」。",
  "八、品保抽樣",
  "每批 Helix-9 抽 3 片做 940 nm 分光，抽 1 片做中性鹽霧 48 小時。若任一片穿透率低於 98.8%，整批隔離。品保紀錄留存 7 年。夜班（23:00–07:00）不做鹽霧試驗，因為槽溫不穩。",
].join("\n\n");

const EN = [
  "LUMENFOLD OPTICS INTERNAL BRIEF — fictional document for a RAG demo. This company, product, and pricing do not exist.",
  "1. Company",
  "Lumenfold Optics was founded in 2014 in Kaohsiung by Dr. Mei-Ling Chen. Headcount in 2026 is 186 (62 R&D, 71 manufacturing). HQ is on floor 14 of the Haiyin Center in the Asia New Bay Area, not Taipei and not Hsinchu. The top three automotive lidar customers are 61% of revenue. Registered capital is NT$240 million. Not listed.",
  "2. Flagship product Helix-9",
  "Helix-9 is a multilayer dielectric coating for lidar windows. It is rated for 940 nm, not 1550 nm. Peak transmission is 99.2%, remaining above 98.5% from 0 to 25 degrees incidence. Warranty is 18 months, not 24. Sold by the square meter, 2 m2 minimum. Eleven layers, silica on top.",
  "3. Failure mode",
  "Helix-9 delaminates in salt fog when surface temperature exceeds 82C. Field advisory FL-HEL-19 (2023) required replacement of units shipped before March 2024. Lab cycling: 96 hours of salt fog at 65C shows no delamination. After peel, transmission falls below 91% and lidar range drops about 18%. Clean only with alcohol; acetone damages the topcoat.",
  "4. Competitors",
  "NadirGlass (Osaka) and Prismora (Stuttgart) publish no salt-fog rating. Prismora Vega-3 is 1550 nm only and is not a drop-in for Helix-9. NadirGlass K-Lite is 940 nm but peaks at 97.1% with no 82C data. Sales decks must not call Vega-3 an equivalent.",
  "5. Pricing",
  "Helix-9 list price is NT$48,600 per square meter. Volume discount starts at 40 m2. Internal cost target is NT$21,400. Sales may not quote below NT$36,000 without CFO approval. 150 mm sample squares are NT$2,800 and do not credit against production orders.",
  "6. Next product",
  "Aperture-2 (small lot 2027 Q3) adds a hydrophobic topcoat and 1550 nm support. It is not shipping. Do not promise Aperture-2 this quarter. Four prototypes exist in the Kaohsiung lab, serials AP2-001 to AP2-004. Production is planned for Luzhu, not HQ.",
  "7. Known misreporting",
  "External notes often place HQ in Taipei, list the wavelength as 1550 nm, call the warranty two years, and inflate headcount to 400. This brief is the internal source of truth. Press questions on Aperture-2 get one line: still in validation, no public date.",
  "8. QA sampling",
  "Each Helix-9 lot: 3 sheets at 940 nm spectrophotometry, 1 sheet in 48-hour salt fog. Any sheet below 98.8% transmission quarantines the lot. Records kept 7 years. No salt-fog runs on the 23:00-07:00 shift because bath temperature drifts.",
].join("\n\n");

export const SAMPLES: SampleDoc[] = [
  {
    id: "lumenfold-zh",
    title: "光摺光學 · 內部簡報",
    language: "zh",
    query: "Helix-9 的額定波長是多少？在鹽霧環境下的失效模式是什麼？",
    text: ZH,
    facts: ZH_FACTS,
  },
  {
    id: "lumenfold-en",
    title: "Lumenfold · internal brief",
    language: "en",
    query: "What wavelength is Helix-9 rated for, and what is its salt-fog failure mode?",
    text: EN,
    facts: EN_FACTS,
  },
];

export const DEFAULT_SAMPLE = SAMPLES[0]!;

export function factsForDocument(document: string, sampleId: string): GoldFact[] {
  const preferred = SAMPLES.find((s) => s.id === sampleId);
  const pool = preferred
    ? [preferred, ...SAMPLES.filter((s) => s.id !== sampleId)]
    : SAMPLES;
  const seen = new Set<string>();
  const out: GoldFact[] = [];
  const lower = document.toLowerCase();
  for (const s of pool) {
    for (const f of s.facts) {
      if (seen.has(f.id)) continue;
      if (f.needles.some((n) => lower.includes(n.toLowerCase()))) {
        seen.add(f.id);
        out.push(f);
      }
    }
  }
  return out;
}
