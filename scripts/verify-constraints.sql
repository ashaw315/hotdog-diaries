-- VERIFICATION SCRIPT: Check if all constraints and functions are properly installed
-- Run this in Supabase SQL Editor to verify the setup

-- 1. Check if unique constraints exist
SELECT 
  'Database Constraints' as check_type,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'content_queue'::regclass
  AND conname IN ('unique_content_hash', 'unique_content_per_platform');

-- 2. Check if posted_content constraint exists  
SELECT 
  'Posted Content Constraints' as check_type,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'posted_content'::regclass
  AND conname = 'unique_post_per_content';

-- 3. Check if indexes exist
SELECT 
  'Database Indexes' as check_type,
  indexname as index_name,
  tablename,
  indexdef as definition
FROM pg_indexes 
WHERE tablename IN ('content_queue', 'posted_content')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 4. Check if functions exist
SELECT 
  'Database Functions' as check_type,
  proname as function_name,
  prosrc IS NOT NULL as has_definition
FROM pg_proc 
WHERE proname IN ('check_duplicate_content', 'sync_posted_flags', 'remove_duplicate_content');

-- 5. Check if trigger exists
SELECT 
  'Database Triggers' as check_type,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'check_duplicate_before_insert';

-- 6. Test constraint by attempting duplicate insert (should fail)
-- This will show if the constraints are working
DO $$
DECLARE
  test_hash text := 'test_duplicate_hash_12345';
BEGIN
  -- Try to insert a test record
  INSERT INTO content_queue (
    content_text, 
    source_platform, 
    content_hash,
    is_approved,
    confidence_score
  ) VALUES (
    'Test constraint verification', 
    'test_platform', 
    test_hash,
    false,
    0.5
  );
  
  -- Try to insert duplicate (should fail)
  BEGIN
    INSERT INTO content_queue (
      content_text, 
      source_platform, 
      content_hash,
      is_approved,
      confidence_score
    ) VALUES (
      'Test constraint verification duplicate', 
      'test_platform', 
      test_hash,
      false,
      0.5
    );
    
    RAISE NOTICE 'ERROR: Duplicate was allowed - constraints not working!';
    
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'SUCCESS: Duplicate was blocked by constraint';
  END;
  
  -- Clean up test data
  DELETE FROM content_queue WHERE content_hash = test_hash;
  
END $$;