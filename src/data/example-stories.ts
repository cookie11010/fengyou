// EXAMPLE stories, shown only while Supabase isn't connected, so the Stories
// page has something to look at. They are written by the developers, not by
// real students, and the page labels them as examples. Delete this file once
// real student stories are published.

export type ExampleStory = {
  id: string;
  placeSlug: string; // matches a slug in src/data/index.ts
  kind: "story" | "tip";
  locale: "zh-TW" | "en"; // the language it's written in
  title: string;
  body: string;
  publishedAt: string;
  comments?: { authorName: Record<"zh-TW" | "en", string>; body: string; createdAt: string }[];
};

export const exampleStories: ExampleStory[] = [
  {
    id: "example-1",
    placeSlug: "city-god-temple",
    kind: "tip",
    locale: "zh-TW",
    title: "早上去廟口吃早餐",
    body:
      "建議早上就到城隍廟，人比較少，可以慢慢逛。廟口一定要點一碗貢丸湯配炒米粉，這就是新竹的味道。\n\n很多小吃攤只收現金，記得先準備零錢。吃完別忘了進廟裡看看屋頂的雕刻。",
    publishedAt: "2026-11-02T09:00:00+08:00",
    comments: [
      {
        authorName: { "zh-TW": "來自馬來西亞的旅客", en: "A visitor from Malaysia" },
        body: "Thanks for the cash tip! I almost went with only my card.",
        createdAt: "2026-11-03T20:15:00+08:00",
      },
    ],
  },
  {
    id: "example-2",
    placeSlug: "yingxi-gate",
    kind: "story",
    locale: "en",
    title: "An old gate in the middle of traffic",
    body:
      "The first time I saw Yingxi Gate I couldn't believe something this old was sitting in the middle of a busy roundabout. Scooters go around it all day, but if you walk down into the plaza below, it suddenly feels quiet.\n\nI like coming here in the late afternoon, when the light hits the stone and students from nearby schools sit on the steps.",
    publishedAt: "2026-11-05T17:30:00+08:00",
  },
  {
    id: "example-3",
    placeSlug: "moat-park",
    kind: "story",
    locale: "zh-TW",
    title: "放學後沿著護城河散步",
    body:
      "我很喜歡放學後沿著護城河走一段。樹很多，夏天也不會太熱，河邊常常有人在散步、聊天。\n\n秋天的時候風特別大，這時候就會想起為什麼大家叫新竹「風城」。從這裡走到東門城只要幾分鐘，很適合一起排進行程。",
    publishedAt: "2026-11-08T16:00:00+08:00",
  },
  {
    id: "example-4",
    placeSlug: "hsinchu-zoo",
    kind: "tip",
    locale: "en",
    title: "Make it a half-day with the park",
    body:
      "Hsinchu Zoo is small, so you can see it in an hour or two. It sits inside Hsinchu Park, so take a walk around the park afterwards. The Glass Museum is in the same park, which makes it an easy half-day trip, especially with kids.",
    publishedAt: "2026-11-10T10:00:00+08:00",
    comments: [
      {
        authorName: { "zh-TW": "來自越南的交換學生", en: "An exchange student from Vietnam" },
        body: "We did exactly this last weekend. The walk around the park after the zoo was our favourite part.",
        createdAt: "2026-11-11T18:40:00+08:00",
      },
    ],
  },
];
