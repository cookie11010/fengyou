// Content store. Spots, routes and culture topics live here as typed data
// until the project moves to a CMS or database. Pages read through these
// exports only, so that swap later won't touch any page code.
//
// These are starter entries written from public information. Student field
// visits should replace them and add story, tips, author and lastVerified.
import type { CultureTopic, Route, Spot } from "@/types/content";
import { photos } from "./photos";

export const spots: Spot[] = [
  {
    slug: "city-god-temple",
    // From OpenStreetMap (checked 2026-11-14).
    coordinates: { lat: 24.804356, lng: 120.966065 },
    name: { "zh-TW": "新竹都城隍廟", en: "Hsinchu City God Temple" },
    category: "temple",
    summary: {
      "zh-TW": "建於 1748 年，供奉全台位階最高的都城隍。廟口小吃林立，是吃貢丸、米粉的首站。",
      en: "Built in 1748 and home to Taiwan's highest-ranking City God. The stalls out front are the place to try pork balls and rice noodles.",
    },
    image: photos.cityGodTemple,
  },
  {
    slug: "yingxi-gate",
    // From OpenStreetMap (checked 2026-11-14).
    coordinates: { lat: 24.804211, lng: 120.970256 },
    name: { "zh-TW": "迎曦門（東門城）", en: "Yingxi Gate (East Gate)" },
    category: "history",
    summary: {
      "zh-TW": "1829 年完工，是新竹舊城牆唯一留存的城門，如今立於市中心的圓環廣場。",
      en: "Completed in 1829, the only gate left from Hsinchu's old city wall, now standing in a plaza at the heart of downtown.",
    },
    image: photos.eastGate,
  },
  {
    slug: "moat-park",
    // From OpenStreetMap (checked 2026-11-14).
    coordinates: { lat: 24.805224, lng: 120.970963 },
    name: { "zh-TW": "護城河親水公園", en: "Moat Park" },
    category: "nature",
    summary: {
      "zh-TW": "沿著清代護城河整建的帶狀公園，綠蔭步道與小橋串起整個舊城區。",
      en: "A green ribbon along the Qing-era moat, with shaded paths and small bridges linking the old town.",
    },
    image: photos.moatPark,
  },
  {
    slug: "hsinchu-zoo",
    // From OpenStreetMap (checked 2026-11-14).
    coordinates: { lat: 24.800688, lng: 120.979484 },
    name: { "zh-TW": "新竹市立動物園", en: "Hsinchu Zoo" },
    category: "family",
    summary: {
      "zh-TW": "1936 年開園，是台灣現存最老的動物園，整建後以更友善動物的展區重新開放。",
      en: "Opened in 1936, Taiwan's oldest surviving zoo, reopened after a renovation with more animal-friendly habitats.",
    },
    image: photos.zoo,
  },
];

export const routes: Route[] = [
  {
    slug: "old-town-food-walk",
    title: { "zh-TW": "舊城小吃散步", en: "Old Town Food Walk" },
    theme: { "zh-TW": "小吃・市場", en: "Street food & markets" },
    durationHours: 3,
    stops: [
      { name: { "zh-TW": "新竹都城隍廟", en: "City God Temple" }, spot: "city-god-temple" },
      { name: { "zh-TW": "長和宮與北門街", en: "Changhe Temple & Beimen Street" }, spot: "changhe-temple-beimen-street" },
      { name: { "zh-TW": "東門市場", en: "East Gate Market" }, spot: "east-gate-market" },
    ],
  },
  {
    slug: "gate-and-moat",
    title: { "zh-TW": "城門與護城河", en: "Gate, Moat & Old City" },
    theme: { "zh-TW": "歷史・散步", en: "History walk" },
    durationHours: 2.5,
    stops: [
      { name: { "zh-TW": "迎曦門", en: "Yingxi Gate" }, spot: "yingxi-gate" },
      { name: { "zh-TW": "護城河親水公園", en: "Moat Park" }, spot: "moat-park" },
      { name: { "zh-TW": "新竹州廳", en: "Former Hsinchu Prefecture Hall" }, spot: "prefecture-hall" },
    ],
  },
  {
    slug: "park-and-zoo",
    title: { "zh-TW": "公園慢遊午後", en: "Park & Zoo Afternoon" },
    theme: { "zh-TW": "親子・綠地", en: "Family & green space" },
    durationHours: 3,
    stops: [
      { name: { "zh-TW": "新竹公園", en: "Hsinchu Park" }, spot: "hsinchu-park" },
      { name: { "zh-TW": "新竹市立動物園", en: "Hsinchu Zoo" }, spot: "hsinchu-zoo" },
      { name: { "zh-TW": "玻璃工藝博物館", en: "Glass Museum" }, spot: "glass-museum" },
    ],
  },
];

export const cultureTopics: CultureTopic[] = [
  {
    slug: "nine-month-wind",
    title: { "zh-TW": "九降風", en: "The autumn wind" },
    body: {
      "zh-TW": "每年秋冬，強勁的東北季風吹進新竹，「風城」之名由此而來。這陣風正好用來曬米粉與柿餅。",
      en: "Each autumn a strong northeast wind sweeps through Hsinchu, giving the \"Windy City\" its name. The same wind dries its rice noodles and persimmons.",
    },
    image: photos.persimmons,
  },
  {
    slug: "rice-noodles",
    title: { "zh-TW": "米粉與貢丸", en: "Rice noodles & pork balls" },
    body: {
      "zh-TW": "風乾的細米粉和彈牙的貢丸，是新竹最具代表性的味道，一碗湯就能同時吃到。",
      en: "Wind-dried rice noodles and springy pork balls are Hsinchu's signature flavours, and one bowl of soup has both.",
    },
    image: photos.riceNoodles,
  },
  {
    slug: "temple-life",
    title: { "zh-TW": "廟口生活", en: "Life around the temple" },
    body: {
      "zh-TW": "在新竹，廟宇不只是信仰中心，廟埕也是市集、小吃與鄰里聚會的地方。",
      en: "In Hsinchu, temples are more than places of worship. Their squares are where people shop, eat and meet their neighbours.",
    },
    image: photos.templeHall,
  },
];

export const getSpot = (slug: string) => spots.find((s) => s.slug === slug);
export const getRoute = (slug: string) => routes.find((r) => r.slug === slug);
