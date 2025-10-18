#!/bin/bash

# Fix all TypeScript files that use require.main === module
# This is needed because the project uses ES modules ("type": "module" in package.json)

echo "🔧 Fixing require.main usage in TypeScript files..."

# Create a backup first
echo "📦 Creating backup..."
cp -r scripts scripts.backup.$(date +%s) 2>/dev/null || true

# Counter for fixed files
FIXED_COUNT=0

# Find all TypeScript files with require.main
for file in $(grep -l "if (require.main === module)" scripts/**/*.ts scripts/*.ts 2>/dev/null); do
    echo "  Fixing: $file"
    
    # Extract the filename without path for the check
    filename=$(basename "$file" .ts)
    
    # Replace the require.main check with ES module compatible check
    sed -i.bak "s/if (require.main === module) {/\/\/ ES module check for direct execution\nconst isMainModule = process.argv[1] \&\& process.argv[1].includes('$filename')\nif (isMainModule) {/" "$file"
    
    # Remove backup file created by sed
    rm "${file}.bak" 2>/dev/null || true
    
    FIXED_COUNT=$((FIXED_COUNT + 1))
done

echo "✅ Fixed $FIXED_COUNT files"

# Also check for any JavaScript files
JS_FILES=$(grep -l "if (require.main === module)" scripts/**/*.js scripts/*.js 2>/dev/null | wc -l)
if [ "$JS_FILES" -gt 0 ]; then
    echo "⚠️  Warning: Found $JS_FILES JavaScript files with require.main that may need fixing"
fi

echo "🎉 Done!"