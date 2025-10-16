\copy (
  SELECT lower(source_platform) AS platform,
         content_type,
         COUNT(*) AS cnt
  FROM public.content_queue
  WHERE is_approved = true AND COALESCE(is_posted,false) = false
  GROUP BY 1,2
  ORDER BY cnt DESC
) TO 'pool_by_platform_type.csv' WITH CSV HEADER;
