#!/bin/bash

##
# Supabase Database Restore Script
#
# Restores a Supabase PostgreSQL database from backup with proper
# safety checks, dry-run support, and rollback protection.
#
# ⚠️  WARNING: This script can overwrite your database!
# Always run with dry-run first and ensure you have recent backups.
#
# Usage:
#   ./scripts/restore-supabase.sh --backup-date 2025-10-15               # Dry run (shows commands)
#   ./scripts/restore-supabase.sh --backup-date 2025-10-15 --confirm     # Execute restore
#   ./scripts/restore-supabase.sh --latest --confirm                     # Restore latest backup
#   ./scripts/restore-supabase.sh --help                                 # Show help
##

set -e

# Default configuration
BACKUP_DIR="./backups"
BACKUP_PREFIX="supabase_backup"
DRY_RUN=true
CONFIRM=false
VERBOSE=false
BACKUP_DATE=""
USE_LATEST=false
TARGET_DB=""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

##
# Helper Functions
##

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_critical() {
    echo -e "${RED}🚨 CRITICAL: $1${NC}"
}

log_verbose() {
    if [[ "$VERBOSE" == true ]]; then
        echo -e "${NC}🔍 $1${NC}"
    fi
}

log_dry_run() {
    echo -e "${PURPLE}🔄 DRY RUN: $1${NC}"
}

##
# Safety and Validation Functions
##

check_dependencies() {
    log_info "Checking dependencies..."
    
    local missing_deps=()
    
    if ! command -v psql &> /dev/null; then
        missing_deps+=("psql")
    fi
    
    if ! command -v pg_restore &> /dev/null; then
        missing_deps+=("pg_restore")
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_info "Install with: brew install postgresql (macOS) or apt-get install postgresql-client (Ubuntu)"
        exit 1
    fi
    
    log_success "All dependencies available"
}

validate_environment() {
    log_info "Validating environment variables..."
    
    if [[ -z "$DATABASE_URL" && -z "$POSTGRES_URL" ]]; then
        log_error "DATABASE_URL or POSTGRES_URL environment variable is required"
        log_info "Example: export DATABASE_URL='postgresql://user:pass@host:port/dbname'"
        exit 1
    fi
    
    # Use DATABASE_URL if available, otherwise POSTGRES_URL
    if [[ -n "$DATABASE_URL" ]]; then
        CONN_STRING="$DATABASE_URL"
        log_verbose "Using DATABASE_URL for connection"
    else
        CONN_STRING="$POSTGRES_URL"
        log_verbose "Using POSTGRES_URL for connection"
    fi
    
    # Extract database name for safety checks
    TARGET_DB=$(echo "$CONN_STRING" | sed -n 's|.*/\([^?]*\).*|\1|p')
    
    if [[ -z "$TARGET_DB" ]]; then
        log_error "Could not extract database name from connection string"
        exit 1
    fi
    
    log_success "Target database: $TARGET_DB"
}

test_database_connection() {
    log_info "Testing database connection..."
    
    if psql "$CONN_STRING" -c "SELECT version();" &> /dev/null; then
        log_success "Database connection verified"
    else
        log_error "Failed to connect to database"
        log_info "Check your connection string and network access"
        exit 1
    fi
}

find_backup_file() {
    local backup_file=""
    
    if [[ "$USE_LATEST" == true ]]; then
        log_info "Finding latest backup file..."
        
        backup_file=$(find "$BACKUP_DIR" -name "${BACKUP_PREFIX}_*" -type f \
            \( -name "*.dump" -o -name "*.sql" -o -name "*.sql.gz" \) \
            -not -name "*.meta" 2>/dev/null | sort -r | head -n1)
        
        if [[ -z "$backup_file" ]]; then
            log_error "No backup files found in $BACKUP_DIR"
            exit 1
        fi
        
        log_success "Latest backup: $(basename "$backup_file")"
        
    elif [[ -n "$BACKUP_DATE" ]]; then
        log_info "Searching for backup from date: $BACKUP_DATE"
        
        # Search for files matching the date pattern
        local search_pattern="${BACKUP_PREFIX}_${BACKUP_DATE}_*"
        backup_file=$(find "$BACKUP_DIR" -name "$search_pattern" -type f \
            \( -name "*.dump" -o -name "*.sql" -o -name "*.sql.gz" \) \
            -not -name "*.meta" 2>/dev/null | head -n1)
        
        if [[ -z "$backup_file" ]]; then
            log_error "No backup found for date: $BACKUP_DATE"
            log_info "Available backups:"
            find "$BACKUP_DIR" -name "${BACKUP_PREFIX}_*" -type f \
                \( -name "*.dump" -o -name "*.sql" -o -name "*.sql.gz" \) \
                -not -name "*.meta" 2>/dev/null | head -5 | xargs -I {} basename {} || echo "  (none found)"
            exit 1
        fi
        
        log_success "Found backup: $(basename "$backup_file")"
    else
        log_error "Either --backup-date or --latest must be specified"
        exit 1
    fi
    
    echo "$backup_file"
}

validate_backup_file() {
    local backup_file="$1"
    
    log_info "Validating backup file..."
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    if [[ ! -s "$backup_file" ]]; then
        log_error "Backup file is empty: $backup_file"
        exit 1
    fi
    
    local file_size
    file_size=$(du -h "$backup_file" | cut -f1)
    log_success "Backup file validated ($file_size)"
    
    # Check for metadata file
    local metadata_file="${backup_file}.meta"
    if [[ -f "$metadata_file" ]]; then
        log_info "Backup metadata available:"
        grep -E "(BACKUP_DATE|BACKUP_TYPE|BACKUP_SIZE|CONTENT_.*_COUNT)" "$metadata_file" | sed 's/^/  /' || true
    fi
}

detect_backup_format() {
    local backup_file="$1"
    
    if [[ "$backup_file" =~ \.sql\.gz$ ]]; then
        echo "compressed_sql"
    elif [[ "$backup_file" =~ \.sql$ ]]; then
        echo "sql"
    elif [[ "$backup_file" =~ \.dump$ ]]; then
        echo "custom"
    else
        log_error "Unknown backup format for file: $backup_file"
        exit 1
    fi
}

##
# Pre-restore Safety Checks
##

perform_safety_checks() {
    log_warning "Performing pre-restore safety checks..."
    
    # Check current database content
    local current_content_count
    current_content_count=$(psql "$CONN_STRING" -t -c "SELECT COUNT(*) FROM content_queue;" 2>/dev/null | xargs || echo "unknown")
    
    if [[ "$current_content_count" != "unknown" && "$current_content_count" -gt 0 ]]; then
        log_warning "Current database contains $current_content_count content items"
        log_critical "Restore will REPLACE ALL existing data!"
    fi
    
    # Check if this is a production database
    local db_host
    db_host=$(echo "$CONN_STRING" | sed -n 's|.*@\([^:]*\):.*|\1|p')
    
    if [[ "$db_host" =~ (supabase\.co|amazonaws\.com|googleusercontent\.com) ]]; then
        log_critical "This appears to be a PRODUCTION database!"
        log_critical "Host: $db_host"
    fi
    
    # Recommend creating a backup first
    log_warning "RECOMMENDATION: Create a backup of current state first:"
    echo "  ./scripts/backup-supabase.sh"
    echo ""
}

create_pre_restore_backup() {
    if [[ "$DRY_RUN" == false ]]; then
        log_info "Creating pre-restore backup as safety measure..."
        
        local safety_backup_dir="./backups/pre-restore"
        mkdir -p "$safety_backup_dir"
        
        local safety_backup_file="${safety_backup_dir}/pre_restore_$(date +%Y-%m-%d_%H-%M-%S).dump"
        
        if pg_dump --format=custom --no-password "$CONN_STRING" > "$safety_backup_file" 2>/dev/null; then
            log_success "Pre-restore backup created: $(basename "$safety_backup_file")"
        else
            log_error "Failed to create pre-restore backup"
            log_error "Aborting restore for safety"
            exit 1
        fi
    else
        log_dry_run "Would create pre-restore backup"
    fi
}

##
# Restore Functions
##

execute_restore() {
    local backup_file="$1"
    local backup_format="$2"
    
    log_info "Preparing restore commands..."
    
    local restore_command=""
    
    case "$backup_format" in
        "custom")
            restore_command="pg_restore --clean --if-exists --dbname=\"$CONN_STRING\" \"$backup_file\""
            ;;
        "sql")
            restore_command="psql \"$CONN_STRING\" < \"$backup_file\""
            ;;
        "compressed_sql")
            restore_command="gunzip -c \"$backup_file\" | psql \"$CONN_STRING\""
            ;;
        *)
            log_error "Unknown backup format: $backup_format"
            exit 1
            ;;
    esac
    
    if [[ "$DRY_RUN" == true ]]; then
        echo ""
        log_dry_run "Restore commands that would be executed:"
        echo ""
        echo "  # Pre-restore backup:"
        echo "  pg_dump --format=custom --no-password \"$CONN_STRING\" > \"./backups/pre-restore/pre_restore_\$(date +%Y-%m-%d_%H-%M-%S).dump\""
        echo ""
        echo "  # Database restore:"
        echo "  $restore_command"
        echo ""
        echo "  # Post-restore verification:"
        echo "  psql \"$CONN_STRING\" -c \"SELECT COUNT(*) FROM content_queue;\""
        echo "  psql \"$CONN_STRING\" -c \"SELECT COUNT(*) FROM posted_content;\""
        echo ""
        log_dry_run "To execute these commands, re-run with --confirm flag"
        return 0
    fi
    
    log_info "Executing restore (this may take several minutes)..."
    log_verbose "Command: $restore_command"
    
    if eval "$restore_command"; then
        log_success "Database restore completed successfully"
    else
        log_error "Restore failed"
        log_error "Database may be in an inconsistent state"
        log_info "Consider restoring from the pre-restore backup that was created"
        exit 1
    fi
}

verify_restore() {
    if [[ "$DRY_RUN" == true ]]; then
        log_dry_run "Would verify restore success"
        return 0
    fi
    
    log_info "Verifying restore success..."
    
    # Check that we can connect and query basic tables
    local tables=("content_queue" "posted_content" "admin_users")
    
    for table in "${tables[@]}"; do
        local count
        count=$(psql "$CONN_STRING" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs || echo "error")
        
        if [[ "$count" == "error" ]]; then
            log_warning "Could not query table: $table"
        else
            log_success "Table $table: $count records"
        fi
    done
    
    # Check for any scheduled posts
    local scheduled_count
    scheduled_count=$(psql "$CONN_STRING" -t -c "SELECT COUNT(*) FROM scheduled_posts;" 2>/dev/null | xargs || echo "0")
    log_info "Scheduled posts: $scheduled_count"
    
    log_success "Restore verification completed"
}

##
# Help and Main Functions
##

show_help() {
    cat << EOF
Supabase Database Restore Script

⚠️  WARNING: This script can overwrite your entire database!
Always run in dry-run mode first and ensure you have recent backups.

USAGE:
    ./scripts/restore-supabase.sh [OPTIONS]

OPTIONS:
    --backup-date DATE     Date of backup to restore (YYYY-MM-DD format)
    --latest              Use the most recent backup file
    --confirm             Execute the restore (required for actual restore)
    --backup-dir DIR      Backup directory (default: ./backups)
    --verbose             Show detailed output
    --help               Show this help message

ENVIRONMENT VARIABLES:
    DATABASE_URL         PostgreSQL connection string (primary)
    POSTGRES_URL         Alternative PostgreSQL connection string

EXAMPLES:
    # Dry run - shows what would be restored:
    ./scripts/restore-supabase.sh --backup-date 2025-10-15
    
    # Execute restore from specific date:
    ./scripts/restore-supabase.sh --backup-date 2025-10-15 --confirm
    
    # Restore from latest backup:
    ./scripts/restore-supabase.sh --latest --confirm

SAFETY FEATURES:
    - Always runs in dry-run mode unless --confirm is specified
    - Creates pre-restore backup automatically
    - Validates backup file integrity before proceeding
    - Provides clear warnings for production databases
    - Verifies restore success after completion

RESTORE PROCESS:
    1. Validate environment and backup file
    2. Perform safety checks and warnings
    3. Create pre-restore backup (safety net)
    4. Execute database restore
    5. Verify restore success

EOF
}

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backup-date)
                BACKUP_DATE="$2"
                shift 2
                ;;
            --latest)
                USE_LATEST=true
                shift
                ;;
            --confirm)
                CONFIRM=true
                DRY_RUN=false
                shift
                ;;
            --backup-dir)
                BACKUP_DIR="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Validate required parameters
    if [[ "$USE_LATEST" == false && -z "$BACKUP_DATE" ]]; then
        log_error "Either --backup-date or --latest must be specified"
        echo "Use --help for usage information"
        exit 1
    fi
    
    echo "🔄 Hotdog Diaries Database Restore"
    echo "=================================="
    
    if [[ "$DRY_RUN" == true ]]; then
        echo "🔍 MODE: DRY RUN (use --confirm to execute)"
    else
        echo "⚡ MODE: LIVE EXECUTION"
    fi
    echo ""
    
    # Execute restore process
    check_dependencies
    validate_environment
    test_database_connection
    
    local backup_file
    backup_file=$(find_backup_file)
    
    validate_backup_file "$backup_file"
    
    local backup_format
    backup_format=$(detect_backup_format "$backup_file")
    
    perform_safety_checks
    
    if [[ "$DRY_RUN" == false ]]; then
        echo ""
        log_critical "FINAL CONFIRMATION REQUIRED"
        echo "You are about to restore database: $TARGET_DB"
        echo "Using backup file: $(basename "$backup_file")"
        echo "This will REPLACE ALL existing data!"
        echo ""
        read -p "Type 'RESTORE' to confirm: " confirmation
        
        if [[ "$confirmation" != "RESTORE" ]]; then
            log_info "Restore cancelled by user"
            exit 0
        fi
        
        create_pre_restore_backup
    fi
    
    execute_restore "$backup_file" "$backup_format"
    verify_restore
    
    if [[ "$DRY_RUN" == false ]]; then
        echo ""
        echo "🎉 Database restore completed successfully!"
        echo "📍 Restored from: $(basename "$backup_file")"
        echo "🗃️  Target database: $TARGET_DB"
        echo ""
        log_success "Restore process finished"
    fi
}

# Execute main function
main "$@"