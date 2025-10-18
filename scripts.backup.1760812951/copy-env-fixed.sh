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
VARS_TO_COPY="NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_SUPABASE_ANON_KEY"

echo "📋 Variables to copy: $VARS_TO_COPY"
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
echo "📄 Environment file contents:"
cat "$TEMP_DIR/.env.production"

# Function to get variable value from env file
get_var_value() {
    local var_name=$1
    local env_file=$2
    grep "^$var_name=" "$env_file" | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//'
}

# Function to check if variable exists in environment
check_var_exists() {
    local var_name=$1
    local env=$2
    vercel env ls "$env" 2>/dev/null | grep -q "$var_name"
}

echo ""
echo "2️⃣ Processing each variable..."
echo "=============================="

for var in $VARS_TO_COPY; do
    echo ""
    echo "🔍 Processing $var..."
    
    # Get the value from production
    value=$(get_var_value "$var" "$TEMP_DIR/.env.production")
    
    if [ -z "$value" ]; then
        echo "  ❌ $var not found in production environment"
        continue
    fi
    
    echo "  ✅ Found value: ${value:0:30}..."
    
    # Add to Preview environment
    echo "  📤 Adding to Preview environment..."
    if check_var_exists "$var" "preview"; then
        echo "    ⏭️  Already exists in preview (skipping)"
    else
        printf "%s" "$value" | vercel env add "$var" preview
        echo "    ✅ Added to preview"
    fi
    
    # Add to Development environment
    echo "  📤 Adding to Development environment..."
    if check_var_exists "$var" "development"; then
        echo "    ⏭️  Already exists in development (skipping)"
    else
        printf "%s" "$value" | vercel env add "$var" development
        echo "    ✅ Added to development"
    fi
done

echo ""
echo "3️⃣ Verification - checking all environments..."
echo "=============================================="

echo ""
echo "Production variables:"
vercel env ls production | grep -E "(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY)" || echo "  No matching variables found"

echo ""
echo "Preview variables:"
vercel env ls preview | grep -E "(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY)" || echo "  No matching variables found"

echo ""
echo "Development variables:"
vercel env ls development | grep -E "(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY)" || echo "  No matching variables found"

echo ""
echo "4️⃣ Triggering production redeployment..."
echo "========================================"

echo "Creating new deployment with updated environment variables..."
vercel --prod --yes

echo ""
echo "✅ SCRIPT COMPLETED SUCCESSFULLY!"
echo "================================="
echo ""
echo "📊 Summary:"
echo "  - Pulled Supabase variables from Production environment"
echo "  - Added them to Preview and Development environments"
echo "  - Triggered production redeployment"
echo ""
echo "🧪 Test the database connection (wait 2-3 minutes for deployment):"
echo "   curl https://hotdog-diaries.vercel.app/api/test-db"
echo "   curl https://hotdog-diaries.vercel.app/api/full-diagnostic"
echo ""
echo "🎉 Your Supabase database should now be connected!"
echo "   Content scanning will start finding and storing posts."