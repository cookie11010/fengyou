// Openly licensed photos from Wikimedia Commons. Replace these with students'
// own photos as field visits produce them; keep the credit fields accurate.
import type { Localized, Photo } from "@/types/content";

/** path = Commons storage path ("c/c8/File_name.jpg"), as URL-encoded in the file's original URL. */
function commons(path: string, author: string, license: string, alt: Localized): Photo {
  const fileName = path.split("/").pop()!;
  return {
    src: `https://upload.wikimedia.org/wikipedia/commons/${path}`,
    alt,
    credit: { author, license, sourceUrl: `https://commons.wikimedia.org/wiki/File:${fileName}` },
  };
}

export const photos = {
  eastGatePark: commons("c/c8/At_the_Hsinchu_City_East_Gate_park.jpg", "Tbatb", "CC BY-SA 4.0", {
    "zh-TW": "陽光下的迎曦門，前景是舊城牆遺跡",
    en: "Yingxi Gate in the sunlight, with remains of the old city wall in front",
  }),
  eastGate: commons(
    "8/8d/East_Gate_%28Yingxi_Gate%29%2C_Hsinchu_City_%28Taiwan%29.jpg",
    "Mk2010",
    "CC BY-SA 4.0",
    { "zh-TW": "迎曦門城樓與石階", en: "The tower and stone steps of Yingxi Gate" },
  ),
  cityGodTemple: commons("0/01/Hsinchu_City_God_Temple%2C_Nov_2024.jpg", "Ralff Nestor Nacor", "CC BY-SA 4.0", {
    "zh-TW": "新竹都城隍廟屋頂與廟前的小吃店家",
    en: "The roofs of Hsinchu City God Temple above rows of snack shops",
  }),
  templeHall: commons("d/d8/Hsinchu_City_God_Temple_20210405.jpg", "Jirka Matousek", "CC BY 2.0", {
    "zh-TW": "城隍廟前殿雕飾與參拜的人們",
    en: "Carved front hall of the City God Temple with worshippers",
  }),
  moatPark: commons("4/4e/Hsinchu_Moat_Park%2C_Nov_2024.jpg", "Ralff Nestor Nacor", "CC BY-SA 4.0", {
    "zh-TW": "綠樹環繞的護城河與步道",
    en: "The tree-lined moat and its walking path",
  }),
  zoo: commons("2/24/Entrance_of_Hsinchu_Zoo.jpg", "Yuriy kosygin", "CC BY-SA 4.0", {
    "zh-TW": "新竹市立動物園入口與遊客",
    en: "Visitors at the entrance of Hsinchu Zoo",
  }),
  riceNoodles: commons("3/32/%E8%B2%A2%E4%B8%B8%E7%B1%B3%E7%B2%89%E6%B9%AF.jpg", "Mingwangx", "CC BY-SA 3.0", {
    "zh-TW": "一碗貢丸米粉湯",
    en: "A bowl of rice noodle soup with pork balls",
  }),
  persimmons: commons("d/df/Persimmons_drying_under_the_sun_in_Xinpu.jpg", "James Wu", "CC BY-SA 2.0", {
    "zh-TW": "新埔的柿子在竹篩上排列曬乾",
    en: "Persimmons laid out on bamboo trays to dry in Xinpu",
  }),
} satisfies Record<string, Photo>;
