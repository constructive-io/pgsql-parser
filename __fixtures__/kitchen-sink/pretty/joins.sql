-- 1. Simple inner join
SELECT *
FROM public.posts AS t0 INNER JOIN public.users ON t0.author_id = users.id;

-- 2. Left outer join
SELECT *
FROM public.posts AS t0 LEFT OUTER JOIN public.comments ON t0.id = comments.post_id;

-- 3. Multiple joins
SELECT *
FROM public.posts AS t0 INNER JOIN public.users ON t0.author_id = users.id LEFT OUTER JOIN public.categories ON t0.category_id = categories.id;

-- 4. Joined tables with specific columns
SELECT
  t0.id,
  t0.title,
  users.name
FROM public.posts AS t0 INNER JOIN public.users ON t0.author_id = users.id;

-- 5. Raw ast passthrough
SELECT id
FROM public.users;
