// RLS test: loads supabase/migrations into PGlite (Postgres in WebAssembly)
// with a minimal stub of Supabase's auth/storage schemas, then acts as each
// role and checks what is allowed and denied. Run: npm run test:db
// It is a fast check, not a full Supabase: re-test with `supabase db reset` before going live.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = fileURLToPath(new URL("../migrations/", import.meta.url));
const db = new PGlite();

const STUB = `
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;

create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant all on storage.objects to anon, authenticated;
`;

await db.exec(STUB);
for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(migrationsDir, f), "utf8"));
  console.log("applied", f);
}

const U = {
  admin: "00000000-0000-0000-0000-00000000000a",
  editor: "00000000-0000-0000-0000-00000000000e",
  student: "00000000-0000-0000-0000-000000000001",
  student2: "00000000-0000-0000-0000-000000000002",
  visitor: "00000000-0000-0000-0000-000000000009",
};
for (const [name, id] of Object.entries(U)) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id, `${name}@example.test`, { display_name: name },
  ]);
}
await db.exec(`
  update public.profiles set role = 'admin' where id = '${U.admin}';
  update public.profiles set role = 'editor' where id = '${U.editor}';
  update public.profiles set role = 'contributor', school = 'Secret High' where id in ('${U.student}', '${U.student2}');
`);

let passed = 0, failed = 0;
async function as(who, sql, params = []) {
  await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  if (who === "anon") await db.exec("set role anon");
  else if (who !== "super") {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [U[who]]);
    await db.exec("set role authenticated");
  }
  try { return await db.query(sql, params); } finally { await db.exec("reset role"); }
}
async function ok(label, who, sql, check) {
  try {
    const r = await as(who, sql);
    if (check && !(await check(r))) throw new Error("unexpected result " + JSON.stringify(r.rows));
    passed++; console.log("  ✓", label);
    return r;
  } catch (e) { failed++; console.log("  ✗", label, "→", e.message); }
}
async function denied(label, who, sql) {
  try {
    const r = await as(who, sql);
    failed++; console.log("  ✗", label, "→ was allowed", JSON.stringify(r.rows), r.affectedRows);
  } catch (e) { passed++; console.log("  ✓", label, `(${e.message.slice(0, 70)})`); }
}
const rows = (n) => (r) => r.rows.length === n;
const affected = (n) => (r) => r.affectedRows === n;

console.log("\nProfiles");
await ok("signup trigger created 5 profiles", "super", "select * from public.profiles", rows(5));
await ok("student edits own display name", "student", `update public.profiles set display_name = 'Mei' where id = '${U.student}'`, affected(1));
await denied("student cannot promote self to admin", "student", `update public.profiles set role = 'admin' where id = '${U.student}'`);
await ok("student cannot edit someone else's profile (0 rows)", "student", `update public.profiles set display_name = 'x' where id = '${U.student2}'`, affected(0));
await ok("student sees only own profile row", "student", "select id from public.profiles", rows(1));
await ok("anon sees no profiles", "anon", "select id from public.profiles", rows(0));
await ok("anon sees no authors before anyone has published", "anon", "select * from public.author_profiles", rows(0));
await denied("author_profiles has no school column", "anon", "select school from public.author_profiles");
await denied("student cannot call set_user_role", "student", `select public.set_user_role('${U.visitor}', 'editor')`);
await ok("admin can call set_user_role", "admin", `select public.set_user_role('${U.visitor}', 'contributor')`);
await ok("…role changed", "super", `select 1 from public.profiles where id='${U.visitor}' and role='contributor'`, rows(1));
await ok("reset visitor", "super", `update public.profiles set role='visitor' where id='${U.visitor}'`);

console.log("\nDestinations");
await ok("student creates a draft", "student", `insert into public.destinations (slug, category, author_id) values ('city-god-temple', 'temple', '${U.student}')`, affected(1));
await denied("student cannot create as published", "student", `insert into public.destinations (slug, category, author_id, status, source_note, last_verified_on) values ('x1', 'food', '${U.student}', 'published', 'n', now())`);
await denied("student cannot create for another author", "student", `insert into public.destinations (slug, category, author_id) values ('x2', 'food', '${U.student2}')`);
await denied("visitor cannot create", "visitor", `insert into public.destinations (slug, category, author_id) values ('x3', 'food', '${U.visitor}')`);
await denied("anon cannot create", "anon", `insert into public.destinations (slug, category) values ('x4', 'food')`);
await ok("anon cannot see draft", "anon", "select * from public.destinations", rows(0));
await ok("student2 cannot see student's draft", "student2", "select * from public.destinations", rows(0));
await denied("student cannot self-publish", "student", "update public.destinations set status = 'published' where slug = 'city-god-temple'");
await denied("editor cannot publish without source + verified date", "editor", "update public.destinations set status = 'published' where slug = 'city-god-temple'");
await ok("editor publishes with verification", "editor", "update public.destinations set status='published', source_note='Field visit 2026-11-10', last_verified_on='2026-11-10' where slug='city-god-temple'", affected(1));
await ok("published_at stamped", "super", "select 1 from public.destinations where published_at is not null", rows(1));
await ok("anon now sees it", "anon", "select * from public.destinations", rows(1));
await ok("student can no longer edit published (0 rows)", "student", "update public.destinations set phone = '123' where slug='city-god-temple'", affected(0));
await denied("bad slug rejected", "editor", "insert into public.destinations (slug, category) values ('City God!', 'temple')");

console.log("\nTranslations");
const dest = "(select id from public.destinations where slug='city-god-temple')";
await denied("student cannot insert 'reviewed'", "student", `insert into public.destination_translations (destination_id, locale, name, summary, translated_by, translation_status) values (${dest}, 'en', 'Temple', 's', '${U.student}', 'reviewed')`);
await ok("student inserts a draft translation", "student", `insert into public.destination_translations (destination_id, locale, name, summary, translated_by) values (${dest}, 'en', 'City God Temple', 'Built in 1748', '${U.student}')`, affected(1));
await denied("unknown locale rejected", "student", `insert into public.destination_translations (destination_id, locale, name, summary, translated_by) values (${dest}, 'fr', 'x', 'x', '${U.student}')`);
await ok("anon cannot see unreviewed translation", "anon", "select * from public.destination_translations", rows(0));
await denied("student cannot mark it reviewed", "student", "update public.destination_translations set translation_status='reviewed' where locale='en'");
await denied("editor must name a reviewer", "editor", "update public.destination_translations set translation_status='reviewed' where locale='en'");
await ok("editor reviews it", "editor", `update public.destination_translations set translation_status='reviewed', reviewed_by='${U.editor}', reviewed_at=now() where locale='en'`, affected(1));
await ok("anon sees reviewed translation", "anon", "select name from public.destination_translations", rows(1));
await ok("student can't edit reviewed text anymore (0 rows)", "student", "update public.destination_translations set summary='changed' where locale='en'", affected(0));

console.log("\nMedia & storage");
await denied("image without alt text rejected", "student", `insert into public.media (storage_path, uploaded_by) values ('${U.student}/a.jpg', '${U.student}')`);
await denied("alt text with bad locale key rejected", "student", `insert into public.media (storage_path, uploaded_by, alt_text) values ('${U.student}/a.jpg', '${U.student}', '{"english":"x"}')`);
await denied("alt text with empty string rejected", "student", `insert into public.media (storage_path, uploaded_by, alt_text) values ('${U.student}/a.jpg', '${U.student}', '{"en":"  "}')`);
await ok("student uploads media to own destination", "student", `insert into public.media (destination_id, storage_path, uploaded_by, alt_text) values (${dest}, '${U.student}/a.jpg', '${U.student}', '{"en":"Temple roof","zh-TW":"廟頂"}')`, affected(1));
await ok("editor creates a draft destination for student2", "editor", `insert into public.destinations (slug, category, author_id) values ('beimen-street', 'history', '${U.student2}')`, affected(1));
// Look the id up as superuser: the student's own query can't see student2's draft at all.
const beimenId = (await as("super", "select id from public.destinations where slug='beimen-street'")).rows[0].id;
await denied("student cannot attach media to student2's destination (even knowing its id)", "student", `insert into public.media (destination_id, storage_path, uploaded_by, alt_text) values ('${beimenId}', '${U.student}/b.jpg', '${U.student}', '{"en":"x"}')`);
await denied("student cannot move own media onto student2's destination", "student", `update public.media set destination_id = '${beimenId}' where uploaded_by = '${U.student}'`);
await ok("anon sees media of published destination", "anon", "select * from public.media", rows(1));
await ok("student uploads file to own folder", "student", `insert into storage.objects (bucket_id, name) values ('media', '${U.student}/photo.jpg')`, affected(1));
await denied("student cannot upload into student2's folder", "student", `insert into storage.objects (bucket_id, name) values ('media', '${U.student2}/photo.jpg')`);
await ok("visitor uploads to own folder (anyone signed in may)", "visitor", `insert into storage.objects (bucket_id, name) values ('media', '${U.visitor}/photo.jpg')`, affected(1));
await denied("visitor cannot upload into student's folder", "visitor", `insert into storage.objects (bucket_id, name) values ('media', '${U.student}/x.jpg')`);
await denied("anon cannot upload", "anon", `insert into storage.objects (bucket_id, name) values ('media', '${U.visitor}/anon.jpg')`);

console.log("\nRoutes");
await ok("editor creates route", "editor", `insert into public.routes (slug, title, duration_minutes, status) values ('old-town-food-walk', '{"zh-TW":"舊城小吃散步","en":"Old Town Food Walk"}', 180, 'published')`, affected(1));
await denied("route title must include zh-TW", "editor", `insert into public.routes (slug, title, duration_minutes) values ('r2', '{"en":"Only English"}', 60)`);
const route = "(select id from public.routes where slug='old-town-food-walk')";
await ok("editor adds 2 stops (one is a draft destination)", "editor", `insert into public.route_destinations (route_id, destination_id, position) values (${route}, ${dest}, 1), (${route}, (select id from public.destinations where slug='beimen-street'), 2)`, affected(2));
await ok("anon sees only the published stop", "anon", "select * from public.route_destinations", rows(1));
await ok("swap stop order in one statement (deferred unique)", "editor", `update public.route_destinations set position = 3 - position where route_id = ${route}`, affected(2));
await denied("duplicate position rejected at commit", "editor", `update public.route_destinations set position = 1 where route_id = ${route}`);
await denied("cannot delete a destination used by a route", "editor", "delete from public.destinations where slug='beimen-street'");
await denied("student cannot create routes", "student", `insert into public.routes (slug, title, duration_minutes) values ('r3', '{"zh-TW":"x"}', 60)`);

console.log("\nEvents");
await denied("end before start rejected", "editor", `insert into public.events (slug, title, starts_at, ends_at) values ('e1', '{"zh-TW":"x"}', '2026-12-02', '2026-12-01')`);
await ok("editor creates draft event", "editor", `insert into public.events (slug, title, starts_at, destination_id) values ('lantern-night', '{"zh-TW":"燈會","en":"Lantern night"}', '2027-02-10 18:00+08', ${dest})`, affected(1));
await ok("anon cannot see draft event", "anon", "select * from public.events", rows(0));


console.log("\nStories");
const beimen = (await as("super", "select id from public.destinations where slug='beimen-street'")).rows[0].id;
const story = (title, extra = "") => `insert into public.stories (author_id, destination_id, locale, title, body${extra ? ", status" : ""})
  values ('${U.student}', ${dest}, 'en', '${title}', 'Go early for the pork-ball soup, the queue gets long by noon.'${extra ? `, '${extra}'` : ""})`;
await ok("visitor publishes a story directly", "visitor", `insert into public.stories (author_id, destination_id, locale, title, body, status) values ('${U.visitor}', ${dest}, 'en', 'Hi', 'Twenty characters at least here.', 'published')`, affected(1));
await ok("…anon sees it", "anon", "select 1 from public.stories where title = 'Hi'", rows(1));
const withPhotos = (images) => `insert into public.stories (author_id, destination_id, locale, title, body, status, images) values ('${U.visitor}', ${dest}, 'en', 'Pic', 'Twenty characters at least here.', 'published', '${JSON.stringify(images)}')`;
const pic = (owner, ext = "jpg") => `${owner}/11111111-2222-4333-8444-555555555555.${ext}`;
await denied("visitor cannot attach someone else's photo", "visitor", withPhotos([{ path: pic(U.student) }]));
await denied("photo must be jpg/png/webp", "visitor", withPhotos([{ path: pic(U.visitor, "gif") }]));
await denied("at most 3 photos", "visitor", withPhotos([1, 2, 3, 4].map(() => ({ path: pic(U.visitor) }))));
await ok("visitor attaches 2 of their own photos, extra keys dropped", "visitor",
  withPhotos([{ path: pic(U.visitor), alt: "Soup", evil: "x" }, { path: pic(U.visitor, "png") }]), affected(1));
await ok("…stored as {path, alt} only", "super", `select 1 from public.stories where title = 'Pic' and images = '${JSON.stringify([{ alt: "Soup", path: pic(U.visitor) }, { alt: null, path: pic(U.visitor, "png") }])}'::jsonb`, rows(1));
await ok("visitor uploads to the story-images bucket", "visitor", `insert into storage.objects (bucket_id, name) values ('story-images', '${pic(U.visitor)}')`, affected(1));
await denied("…but not into someone else's folder", "visitor", `insert into storage.objects (bucket_id, name) values ('story-images', '${pic(U.student)}')`);
await ok("visitor deletes their own stories", "visitor", `delete from public.stories where author_id = '${U.visitor}'`, affected(2));
await ok("student submits a story (waits for review)", "student", story("Best breakfast near the temple"), affected(1));
await ok("…its status is in_review", "super", "select 1 from public.stories where status = 'in_review'", rows(1));
await denied("student cannot submit as archived", "student", story("Sneaky", "archived"));
await denied("student cannot post about an unpublished place", "student", `insert into public.stories (author_id, destination_id, locale, title, body) values ('${U.student}', '${beimen}', 'en', 'Draft place', 'Twenty characters at least here.')`);
await denied("student cannot post as someone else", "student", `insert into public.stories (author_id, destination_id, locale, title, body) values ('${U.student2}', ${dest}, 'en', 'Fake', 'Twenty characters at least here.')`);
await denied("too-short body rejected", "student", `insert into public.stories (author_id, destination_id, locale, title, body) values ('${U.student}', ${dest}, 'en', 'Short', 'Too short')`);
await ok("anon cannot see the pending story", "anon", "select * from public.stories", rows(0));
await ok("student2 cannot see it either", "student2", "select * from public.stories", rows(0));
await ok("author sees their own pending story", "student", "select * from public.stories", rows(1));
await ok("author edits their pending story", "student", "update public.stories set title = 'Best breakfast by the temple'", affected(1));
await denied("author cannot publish their own story", "student", "update public.stories set status = 'published'");
await ok("editor approves it, naming someone else as reviewer", "editor", `update public.stories set status = 'published', reviewed_by = '${U.admin}'`, affected(1));
await ok("…reviewer is recorded as the editor, not the name typed in", "super", `select 1 from public.stories where reviewed_by = '${U.editor}' and published_at is not null`, rows(1));
await ok("anon now sees the published story", "anon", "select title from public.stories", rows(1));
await ok("author can no longer edit it (0 rows)", "student", "update public.stories set body = 'Changed after approval, sneaky edit here.'", affected(0));
await ok("author_profiles now lists the student who published", "anon", `select 1 from public.author_profiles where id = '${U.student}'`, rows(1));
await ok("signup without a name is 'Traveller', not the email", "super",
  "insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'chen.meiling@school.example')", affected(1));
await ok("…display_name check", "super", "select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000c1' and display_name = 'Traveller'", rows(1));
await ok("over-long signup name is trimmed instead of failing", "super",
  `insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000c2', 'x@example.test', '{"display_name":"${"長".repeat(70)}"}')`, affected(1));

console.log("\nItineraries");
await ok("editor publishes a second place", "editor", "insert into public.destinations (slug, category, status, source_note, last_verified_on) values ('yingxi-gate', 'history', 'published', 'visit', '2026-11-10')", affected(1));
const gate = "(select id from public.destinations where slug='yingxi-gate')";
await denied("anon cannot save places", "anon", `select public.add_to_itinerary(${dest})`);
await ok("visitor saves a place (creates itinerary)", "visitor", `select public.add_to_itinerary(${dest}) as n`, (r) => r.rows[0].n === 1);
await ok("saving it again does nothing", "visitor", `select public.add_to_itinerary(${dest}) as n`, (r) => r.rows[0].n === 1);
await ok("visitor saves a second place at the end", "visitor", `select public.add_to_itinerary(${gate}) as n`, (r) => r.rows[0].n === 2);
await denied("visitor cannot save an unpublished place", "visitor", `select public.add_to_itinerary('${beimen}')`);
await ok("student cannot see the visitor's itinerary", "student", "select * from public.itineraries", rows(0));
await ok("student cannot see the visitor's stops", "student", "select * from public.itinerary_items", rows(0));
const itin = (await as("super", `select id from public.itineraries where owner_id = '${U.visitor}'`)).rows[0].id;
await denied("student cannot add to the visitor's itinerary", "student", `insert into public.itinerary_items (itinerary_id, destination_id, position) values ('${itin}', ${gate}, 9)`);
await ok("student cannot rename the visitor's itinerary (0 rows)", "student", "update public.itineraries set title = 'hacked'", affected(0));
await denied("anon cannot read itineraries", "anon", "select * from public.itineraries");
const ids = (await as("super", "select (select id from public.destinations where slug='city-god-temple') as temple, (select id from public.destinations where slug='yingxi-gate') as gate")).rows[0];
await ok("save: reorder, add a note, rename, set date", "visitor",
  `select public.save_itinerary('Day 1 in Hsinchu', '2026-12-20', '[{"destination_id":"${ids.gate}","note":"Sunrise photos"},{"destination_id":"${ids.temple}"}]') as n`,
  (r) => r.rows[0].n === 2);
await ok("…new order and note stored", "visitor",
  `select 1 from public.itinerary_items i join public.itineraries t on t.id = i.itinerary_id
   where t.title = 'Day 1 in Hsinchu' and t.trip_date = '2026-12-20'
     and i.destination_id = '${ids.gate}' and i.position = 1 and i.note = 'Sunrise photos'`, rows(1));
await ok("save drops unpublished places and duplicates", "visitor",
  `select public.save_itinerary('Day 1', null, '[{"destination_id":"${ids.temple}"},{"destination_id":"${beimen}"},{"destination_id":"${ids.temple}"}]') as n`,
  (r) => r.rows[0].n === 1);
await ok("save with an empty list clears it", "visitor", "select public.save_itinerary('Day 1', null, '[]') as n", (r) => r.rows[0].n === 0);
await denied("save rejects a non-list", "visitor", `select public.save_itinerary('x', null, '{"a":1}')`);
await ok("student can save their own, separate itinerary", "student", `select public.add_to_itinerary(${dest}) as n`, (r) => r.rows[0].n === 1);

console.log("\nStory removal");
await ok("demote the student", "super", `update public.profiles set role = 'visitor' where id = '${U.student}'`);
await ok("a former student can still delete their own story", "student", "delete from public.stories", affected(1));
await ok("restore student", "super", `update public.profiles set role = 'contributor' where id = '${U.student}'`);


console.log("\nLikes and saves");
await ok("editor publishes a story with a fake like_count of 99", "editor",
  `insert into public.stories (author_id, destination_id, locale, title, body, status, like_count)
   values ('${U.student}', ${dest}, 'en', 'Sunset at the gate', 'Come at golden hour, the stone glows orange.', 'published', 99)`, affected(1));
const liked = "(select id from public.stories where title = 'Sunset at the gate')";
const likeCount = async () => (await as("anon", `select like_count from public.stories where id = ${liked}`)).rows[0]?.like_count;
await ok("…new stories always start at 0 likes", "super", `select 1 from public.stories where id = ${liked} and like_count = 0`, rows(1));
await denied("anon cannot like", "anon", `insert into public.story_reactions (user_id, story_id, kind) values ('${U.visitor}', ${liked}, 'like')`);
await ok("visitor likes the story", "visitor", `insert into public.story_reactions (user_id, story_id, kind) values ('${U.visitor}', ${liked}, 'like')`, affected(1));
await denied("liking twice is rejected", "visitor", `insert into public.story_reactions (user_id, story_id, kind) values ('${U.visitor}', ${liked}, 'like')`);
await denied("visitor cannot like on someone else's behalf", "visitor", `insert into public.story_reactions (user_id, story_id, kind) values ('${U.student2}', ${liked}, 'like')`);
await ok("student2 likes it too", "student2", `insert into public.story_reactions (user_id, story_id, kind) values ('${U.student2}', ${liked}, 'like')`, affected(1));
await ok("visitor saves it (private bookmark)", "visitor", `insert into public.story_reactions (user_id, story_id, kind) values ('${U.visitor}', ${liked}, 'save')`, affected(1));
await ok("anon sees like_count = 2 (saves don't count)", "anon", "select 1", async () => (await likeCount()) === 2);
await ok("visitor sees only their own 2 reactions", "visitor", "select * from public.story_reactions", rows(2));
await ok("student2 sees only their own like, not the visitor's save", "student2", "select kind from public.story_reactions", (r) => r.rows.length === 1 && r.rows[0].kind === "like");
await denied("anon cannot see who liked what", "anon", "select * from public.story_reactions");
await ok("editor setting like_count = 1000 is ignored", "editor", `update public.stories set like_count = 1000 where id = ${liked}`, affected(1));
await ok("…count is still 2", "anon", "select 1", async () => (await likeCount()) === 2);
await ok("visitor cannot remove student2's like (0 rows)", "visitor", `delete from public.story_reactions where user_id = '${U.student2}'`, affected(0));
await ok("visitor unlikes", "visitor", `delete from public.story_reactions where user_id = '${U.visitor}' and kind = 'like'`, affected(1));
await ok("…count drops to 1", "anon", "select 1", async () => (await likeCount()) === 1);
await ok("student submits a story for review", "student", `insert into public.stories (author_id, destination_id, locale, title, body) values ('${U.student}', ${dest}, 'en', 'Pending one', 'Waiting for the teacher to approve this.')`, affected(1));
const pending = (await as("super", "select id from public.stories where title = 'Pending one'")).rows[0].id;
await denied("cannot like a story that isn't published", "visitor", `insert into public.story_reactions (user_id, story_id, kind) values ('${U.visitor}', '${pending}', 'like')`);
await ok("deleting a story removes its likes and saves", "editor", `delete from public.stories where id = ${liked}`, affected(1));
await ok("…no reactions left", "super", "select * from public.story_reactions", rows(0));


console.log("\nComments");
await ok("editor publishes a story with a fake comment_count of 50", "editor",
  `insert into public.stories (author_id, destination_id, locale, title, body, status, comment_count)
   values ('${U.student}', ${dest}, 'en', 'Ask me anything', 'Happy to answer questions about this place.', 'published', 50)`, affected(1));
const talk = "(select id from public.stories where title = 'Ask me anything')";
const commentCount = async () => (await as("anon", `select comment_count from public.stories where id = ${talk}`)).rows[0]?.comment_count;
const comment = (who, body) => `insert into public.story_comments (story_id, author_id, body) values (${talk}, '${U[who]}', '${body}')`;
await ok("…new stories always start at 0 comments", "anon", "select 1", async () => (await commentCount()) === 0);
await denied("anon cannot comment", "anon", `insert into public.story_comments (story_id, author_id, body) values (${talk}, '${U.visitor}', 'hi')`);
await ok("visitor comments", "visitor", comment("visitor", "Is it busy on weekends?"), affected(1));
await denied("visitor cannot comment as student2", "visitor", comment("student2", "Fake"));
await denied("cannot post a comment as already hidden", "visitor",
  `insert into public.story_comments (story_id, author_id, body, status) values (${talk}, '${U.visitor}', 'x', 'hidden')`);
await denied("cannot backdate a comment", "visitor",
  `insert into public.story_comments (story_id, author_id, body, created_at) values (${talk}, '${U.visitor}', 'x', '2001-01-01')`);
await denied("blank comment is rejected", "visitor", comment("visitor", "   "));
await denied("comment over 1000 characters is rejected", "visitor", comment("visitor", "a".repeat(1001)));
await ok("student2 replies", "student2", comment("student2", "Weekday mornings are quieter."), affected(1));
await ok("anon reads both comments", "anon", "select * from public.story_comments", rows(2));
await ok("…comment_count = 2", "anon", "select 1", async () => (await commentCount()) === 2);
await ok("author_profiles now lists the visitor who commented", "anon", `select 1 from public.author_profiles where id = '${U.visitor}'`, rows(1));
await denied("visitor cannot edit their comment's text", "visitor", `update public.story_comments set body = 'edited' where author_id = '${U.visitor}'`);
await ok("visitor cannot hide student2's comment (0 rows)", "visitor", `update public.story_comments set status = 'hidden' where author_id = '${U.student2}'`, affected(0));
await ok("editor hides the visitor's comment", "editor", `update public.story_comments set status = 'hidden' where author_id = '${U.visitor}'`, affected(1));
await ok("…hidden_by records the editor", "super", `select 1 from public.story_comments where hidden_by = '${U.editor}'`, rows(1));
await ok("…anon now sees 1 comment", "anon", "select * from public.story_comments", rows(1));
await ok("…comment_count = 1", "anon", "select 1", async () => (await commentCount()) === 1);
await ok("…the visitor's name is no longer public", "anon", `select 1 from public.author_profiles where id = '${U.visitor}'`, rows(0));
await ok("editor still sees both", "editor", "select * from public.story_comments", rows(2));
await ok("editor un-hides it", "editor", `update public.story_comments set status = 'visible' where author_id = '${U.visitor}'`, affected(1));
await ok("…count back to 2, hidden_by cleared", "super", `select 1 from public.story_comments where hidden_by is not null`, async (r) => r.rows.length === 0 && (await commentCount()) === 2);
await ok("editor setting comment_count = 500 is ignored", "editor", `update public.stories set comment_count = 500 where id = ${talk}`, affected(1));
await ok("…count is still 2", "anon", "select 1", async () => (await commentCount()) === 2);
await ok("liking still updates like_count", "visitor", `insert into public.story_reactions (user_id, story_id, kind) values ('${U.visitor}', ${talk}, 'like')`, affected(1));
await ok("…like_count = 1, comment_count still 2", "anon", `select 1 from public.stories where id = ${talk} and like_count = 1 and comment_count = 2`, rows(1));
await ok("student2 cannot delete the visitor's comment (0 rows)", "student2", `delete from public.story_comments where author_id = '${U.visitor}'`, affected(0));
await ok("visitor deletes their own comment", "visitor", `delete from public.story_comments where author_id = '${U.visitor}'`, affected(1));
await ok("…comment_count = 1", "anon", "select 1", async () => (await commentCount()) === 1);
await denied("cannot comment on a story that isn't published", "visitor",
  `insert into public.story_comments (story_id, author_id, body) values ('${pending}', '${U.visitor}', 'hello')`);
await ok("editor un-publishes the story", "editor", `update public.stories set status = 'archived' where id = ${talk}`, affected(1));
await ok("…its comments are no longer public", "anon", "select * from public.story_comments", rows(0));
await ok("deleting a story removes its comments", "editor", `delete from public.stories where id = ${talk}`, affected(1));
await ok("…no comments left", "super", "select * from public.story_comments", rows(0));

console.log("\nCommunity spots");
await denied("anon cannot add a spot", "anon", `select public.add_community_spot('X', 'Long enough summary', 'food', 24.8, 120.97, 'en')`);
await denied("spot outside Taiwan rejected", "visitor", `select public.add_community_spot('X', 'Long enough summary', 'food', 0, 0, 'en')`);
await denied("spot with someone else's photo rejected", "visitor", `select public.add_community_spot('X', 'Long enough summary', 'food', 24.8, 120.97, 'en', null, '${U.student}/11111111-2222-4333-8444-555555555555.jpg')`);
await denied("spot with a disabled language rejected", "visitor", `select public.add_community_spot('X', 'Long enough summary', 'food', 24.8, 120.97, 'vi')`);
await ok("visitor adds a spot with a photo", "visitor",
  `select public.add_community_spot('Grandma noodle stall', 'Tiny stall with the best rice noodles.', 'food', 24.80, 120.97, 'en', 'Beimen St', '${U.visitor}/11111111-2222-4333-8444-555555555555.jpg')`, rows(1));
const newSpot = "(select destination_id from public.destination_translations where name = 'Grandma noodle stall')";
await ok("…anon sees the spot, its translation and cover", "anon",
  `select 1 from public.destinations d join public.destination_translations t on t.destination_id = d.id join public.media m on m.id = d.cover_media_id where d.id = ${newSpot}`, rows(1));
await ok("…author name is public", "anon", `select 1 from public.author_profiles where id = '${U.visitor}'`, rows(1));
await ok("…and it can go in a trip", "student2", `select public.add_to_itinerary(${newSpot})`);
await ok("…and get stories", "student2", `insert into public.stories (author_id, destination_id, locale, title, body, status) values ('${U.student2}', ${newSpot}, 'en', 'Yum', 'Twenty characters at least here.', 'published')`, affected(1));
await ok("visitor cannot edit the published spot (0 rows)", "visitor", `update public.destinations set category = 'temple' where id = ${newSpot}`, affected(0));
await ok("editor can archive it", "editor", `update public.destinations set status = 'archived' where id = ${newSpot}`, affected(1));
await ok("…then the public no longer sees it", "anon", `select 1 from public.destinations where id = ${newSpot}`, rows(0));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
