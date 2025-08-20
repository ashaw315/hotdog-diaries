#!/bin/bash

set -e  # Exit on any error

echo "🔧 Copying Supabase Environment Variables Across All Environments"
echo "=================================================================="
echo ""

# Check if Vercel CLI is available
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Please install it first:"
    echo "   npm i -g vercel"
    exit 1
fi

# Variables to copy
VARS_TO_COPY=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY" 
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
)

echo "📋 Variables to copy: ${VARS_TO_COPY[*]}"
echo ""

# Create temporary directory for storing values
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "1️⃣ Pulling environment variables from Production..."
echo "=================================================="

# Pull production environment to a file
echo "Downloading production environment..."
vercel env pull "$TEMP_DIR/.env.production" --environment=production

if [ ! -f "$TEMP_DIR/.env.production" ]; then
    echo "❌ Failed to pull production environment variables"
    exit 1
fi

echo "✅ Production environment downloaded"

# Parse the values from the .env file
declare -A VAR_VALUES
for var in "${VARS_TO_COPY[@]}"; do
    value=$(grep "^$var=" "$TEMP_DIR/.env.production" | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//')
    if [ -n "$value" ]; then
        VAR_VALUES[$var]="$value"
        echo "  ✅ Found $var: ${value:0:30}..."
    else
        echo "  ❌ Missing $var in production"
        exit 1
    fi
done

echo ""
echo "2️⃣ Checking existing variables in target environments..."
echo "========================================================"

# Function to check if variable exists in environment
check_var_exists() {
    local var_name=$1
    local env=$2
    vercel env ls "$env" 2>/dev/null | grep -q "^[[:space:]]*$var_name[[:space:]]" 
}

# Check Preview environment
echo "Preview environment:"
for var in "${VARS_TO_COPY[@]}"; do
    if check_var_exists "$var" "preview"; then
        echo "  ⚠️  $var already exists (will skip)"
    else
        echo "  ➕ $var needs to be added"
    fi
done

echo ""
echo "Development environment:"
for var in "${VARS_TO_COPY[@]}"; do
    if check_var_exists "$var" "development"; then
        echo "  ⚠️  $var already exists (will skip)"
    else
        echo "  ➕ $var needs to be added"
    fi
done

echo ""
echo "3️⃣ Adding variables to Preview environment..."
echo "============================================="

for var in "${VARS_TO_COPY[@]}"; do
    if check_var_exists "$var" "preview"; then
        echo "  ⏭️  Skipping $var (already exists)"
    else
        echo "  📤 Adding $var to preview..."
        # Use printf to handle the value properly and pipe to vercel env add
        printf "%s" "${VAR_VALUES[$var]}" | vercel env add "$var" preview || {
            echo "  ❌ Failed to add $var to preview"
            exit 1
        }
        echo "  ✅ Added $var to preview"
    fi
done

echo ""
echo "4️⃣ Adding variables to Development environment..."
echo "================================================"

for var in "${VARS_TO_COPY[@]}"; do
    if check_var_exists "$var" "development"; then
        echo "  ⏭️  Skipping $var (already exists)"
    else
        echo "  📤 Adding $var to development..."
        # Use printf to handle the value properly and pipe to vercel env add
        printf "%s" "${VAR_VALUES[$var]}" | vercel env add "$var" development || {
            echo "  ❌ Failed to add $var to development"
            exit 1
        }
        echo "  ✅ Added $var to development"
    fi
done

echo ""
echo "5️⃣ Verification - checking all environments..."
echo "=============================================="

echo ""
echo "Production:"
for var in "${VARS_TO_COPY[@]}"; do
    if vercel env ls production | grep -q "^[[:space:]]*$var[[:space:]]"; then
        echo "  ✅ $var"
    else
        echo "  ❌ $var missing"
    fi
done

echo ""
echo "Preview:"
for var in "${VARS_TO_COPY[@]}"; do
    if vercel env ls preview | grep -q "^[[:space:]]*$var[[:space:]]"; then
        echo "  ✅ $var"
    else
        echo "  ❌ $var missing"
    fi
done

echo ""
echo "Development:"
for var in "${VARS_TO_COPY[@]}"; do
    if vercel env ls development | grep -q "^[[:space:]]*$var[[:space:]]"; then
        echo "  ✅ $var"
    else
        echo "  ❌ $var missing"
    fi
done

echo ""
echo "6️⃣ Triggering production redeployment..."
echo "========================================"

echo "Creating new deployment with updated environment variables..."
vercel --prod --yes --force

echo ""
echo "✅ SCRIPT COMPLETED SUCCESSFULLY!"
echo "================================="
echo ""
echo "📊 Summary:"
echo "  - Copied ${#VARS_TO_COPY[@]} Supabase variables from Production"
echo "  - Extended them to Preview and Development environments"
echo "  - Triggered production redeployment"
echo ""
echo "🧪 Test the database connection (wait 2-3 minutes for deployment):"
echo "   curl https://hotdog-diaries.vercel.app/api/test-db"
echo "   curl https://hotdog-diaries.vercel.app/api/full-diagnostic"
echo ""
echo "🎉 Your Supabase database should now be connected!"
echo "   Content scanning will start finding and storing posts."