-- =============================================================================
-- FengYou: LOCAL DEVELOPMENT seed data
-- `supabase db reset` runs this automatically after the migrations.
-- Don't run it against production.
--
-- Four sample destinations so the map has something to show. Coordinates come
-- from OpenStreetMap (checked 2026-11-14). The descriptions are SAMPLE text
-- and still need a student field visit before real publication.
-- =============================================================================

-- A seed reviewer account. It has no password, so nobody can sign in as it.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '5eed0000-0000-4000-8000-000000000001',
        'authenticated', 'authenticated', 'seed-editor@fengyou.local', '',
        now(), '{"provider":"email","providers":["email"]}', '{"display_name":"FengYou Seed Editor"}', now(), now())
on conflict (id) do nothing;

update public.profiles set role = 'editor' where id = '5eed0000-0000-4000-8000-000000000001';

-- Destinations ---------------------------------------------------------------
insert into public.destinations
  (id, slug, category, status, latitude, longitude, author_id, source_note, last_verified_on)
values
  ('5eed0000-0000-4000-8000-0000000000d1', 'city-god-temple', 'temple',  'published', 24.804356, 120.966065,
   '5eed0000-0000-4000-8000-000000000001', 'SAMPLE: coordinates from OpenStreetMap; text not yet field-verified', '2026-11-14'),
  ('5eed0000-0000-4000-8000-0000000000d2', 'yingxi-gate',     'history', 'published', 24.804211, 120.970256,
   '5eed0000-0000-4000-8000-000000000001', 'SAMPLE: coordinates from OpenStreetMap; text not yet field-verified', '2026-11-14'),
  ('5eed0000-0000-4000-8000-0000000000d3', 'moat-park',       'nature',  'published', 24.805224, 120.970963,
   '5eed0000-0000-4000-8000-000000000001', 'SAMPLE: coordinates from OpenStreetMap; text not yet field-verified', '2026-11-14'),
  ('5eed0000-0000-4000-8000-0000000000d4', 'hsinchu-zoo',     'family',  'published', 24.800688, 120.979484,
   '5eed0000-0000-4000-8000-000000000001', 'SAMPLE: coordinates from OpenStreetMap; text not yet field-verified', '2026-11-14')
on conflict (id) do nothing;

-- Translations (reviewed, so the public can see them) -------------------------
insert into public.destination_translations
  (destination_id, locale, name, summary, translation_status, reviewed_by, reviewed_at)
select d.id, t.locale, t.name, t.summary, 'reviewed', '5eed0000-0000-4000-8000-000000000001', now()
from (values
  ('city-god-temple', 'zh-TW', '新竹都城隍廟', '建於 1748 年，供奉全台位階最高的都城隍。廟口小吃林立，是吃貢丸、米粉的首站。'),
  ('city-god-temple', 'en', 'Hsinchu City God Temple', 'Built in 1748 and home to Taiwan''s highest-ranking City God. The stalls out front are the place to try pork balls and rice noodles.'),
  ('yingxi-gate', 'zh-TW', '迎曦門（東門城）', '1829 年完工，是新竹舊城牆唯一留存的城門，如今立於市中心的圓環廣場。'),
  ('yingxi-gate', 'en', 'Yingxi Gate (East Gate)', 'Completed in 1829, the only gate left from Hsinchu''s old city wall, now standing in a plaza at the heart of downtown.'),
  ('moat-park', 'zh-TW', '護城河親水公園', '沿著清代護城河整建的帶狀公園，綠蔭步道與小橋串起整個舊城區。'),
  ('moat-park', 'en', 'Moat Park', 'A green ribbon along the Qing-era moat, with shaded paths and small bridges linking the old town.'),
  ('hsinchu-zoo', 'zh-TW', '新竹市立動物園', '1936 年開園，是台灣現存最老的動物園，整建後以更友善動物的展區重新開放。'),
  ('hsinchu-zoo', 'en', 'Hsinchu Zoo', 'Opened in 1936, Taiwan''s oldest surviving zoo, reopened after a renovation with more animal-friendly habitats.')
) as t(slug, locale, name, summary)
join public.destinations d on d.slug = t.slug
on conflict (destination_id, locale) do nothing;

-- Cover photos (openly licensed, from Wikimedia Commons) -----------------------
insert into public.media
  (id, destination_id, media_type, storage_path, alt_text, credit_author, license, source_url, uploaded_by)
values
  ('5eed0000-0000-4000-8000-0000000000e1', '5eed0000-0000-4000-8000-0000000000d1', 'image',
   'https://upload.wikimedia.org/wikipedia/commons/0/01/Hsinchu_City_God_Temple%2C_Nov_2024.jpg',
   '{"zh-TW":"新竹都城隍廟屋頂與廟前的小吃店家","en":"The roofs of Hsinchu City God Temple above rows of snack shops"}',
   'Ralff Nestor Nacor', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Hsinchu_City_God_Temple,_Nov_2024.jpg',
   '5eed0000-0000-4000-8000-000000000001'),
  ('5eed0000-0000-4000-8000-0000000000e2', '5eed0000-0000-4000-8000-0000000000d2', 'image',
   'https://upload.wikimedia.org/wikipedia/commons/8/8d/East_Gate_%28Yingxi_Gate%29%2C_Hsinchu_City_%28Taiwan%29.jpg',
   '{"zh-TW":"迎曦門城樓與石階","en":"The tower and stone steps of Yingxi Gate"}',
   'Mk2010', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:East_Gate_(Yingxi_Gate),_Hsinchu_City_(Taiwan).jpg',
   '5eed0000-0000-4000-8000-000000000001'),
  ('5eed0000-0000-4000-8000-0000000000e3', '5eed0000-0000-4000-8000-0000000000d3', 'image',
   'https://upload.wikimedia.org/wikipedia/commons/4/4e/Hsinchu_Moat_Park%2C_Nov_2024.jpg',
   '{"zh-TW":"綠樹環繞的護城河與步道","en":"The tree-lined moat and its walking path"}',
   'Ralff Nestor Nacor', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Hsinchu_Moat_Park,_Nov_2024.jpg',
   '5eed0000-0000-4000-8000-000000000001'),
  ('5eed0000-0000-4000-8000-0000000000e4', '5eed0000-0000-4000-8000-0000000000d4', 'image',
   'https://upload.wikimedia.org/wikipedia/commons/2/24/Entrance_of_Hsinchu_Zoo.jpg',
   '{"zh-TW":"新竹市立動物園入口與遊客","en":"Visitors at the entrance of Hsinchu Zoo"}',
   'Yuriy kosygin', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Entrance_of_Hsinchu_Zoo.jpg',
   '5eed0000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

update public.destinations d
set cover_media_id = m.id
from public.media m
where m.destination_id = d.id and d.cover_media_id is null;
