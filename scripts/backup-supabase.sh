#!/bin/bash

##
# Supabase Database Backup Script
#
# Creates a backup of the Supabase PostgreSQL database with proper
# metadata, compression, and timestamping for disaster recovery.
#
# Usage:
#   ./scripts/backup-supabase.sh                    # Create backup with default settings
#   ./scripts/backup-supabase.sh --compress         # Create compressed backup
#   ./scripts/backup-supabase.sh --tables-only      # Backup table structure only
#   ./scripts/backup-supabase.sh --help             # Show help
##

set -e

# Default configuration
BACKUP_DIR="./backups"
BACKUP_PREFIX="supabase_backup"
COMPRESS=false
TABLES_ONLY=false
VERBOSE=false
FORMAT="custom"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_verbose() {
    if [[ "$VERBOSE" == true ]]; then
        echo -e "${NC}🔍 $1${NC}"
    fi
}

##
# Backup Functions
##

check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump is required but not installed"
        log_info "Install with: brew install postgresql (macOS) or apt-get install postgresql-client (Ubuntu)"
        exit 1
    fi
    
    if [[ "$COMPRESS" == true ]] && ! command -v gzip &> /dev/null; then
        log_error "gzip is required for compression but not installed"
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
    
    # Test connection
    log_info "Testing database connection..."
    if ! psql "$CONN_STRING" -c "SELECT 1;" &> /dev/null; then
        log_error "Failed to connect to database"
        log_info "Check your connection string and network access"
        exit 1
    fi
    
    log_success "Database connection verified"
}

create_backup_directory() {
    local timestamp_dir
    timestamp_dir="$BACKUP_DIR/$(date +%Y/%m)"
    
    if [[ ! -d "$timestamp_dir" ]]; then
        mkdir -p "$timestamp_dir"
        log_success "Created backup directory: $timestamp_dir"
    fi
    
    echo "$timestamp_dir"
}

generate_backup_filename() {
    local backup_dir="$1"
    local timestamp
    timestamp=$(date +%Y-%m-%d_%H-%M-%S)
    
    local filename="${BACKUP_PREFIX}_${timestamp}"
    
    if [[ "$TABLES_ONLY" == true ]]; then
        filename="${filename}_schema"
    fi
    
    if [[ "$FORMAT" == "sql" ]]; then
        filename="${filename}.sql"
    else
        filename="${filename}.dump"
    fi
    
    if [[ "$COMPRESS" == true ]]; then
        filename="${filename}.gz"
    fi
    
    echo "$backup_dir/$filename"
}

create_backup() {
    local backup_file="$1"
    local pg_dump_args=()
    
    log_info "Creating database backup..."
    log_verbose "Target file: $backup_file"
    
    # Configure pg_dump arguments
    pg_dump_args+=("--verbose")
    pg_dump_args+=("--no-password")
    
    if [[ "$FORMAT" == "custom" ]]; then
        pg_dump_args+=("--format=custom")
        pg_dump_args+=("--compress=9")
    else
        pg_dump_args+=("--format=plain")
    fi
    
    if [[ "$TABLES_ONLY" == true ]]; then
        pg_dump_args+=("--schema-only")
        log_info "Backing up schema only (no data)"
    else
        pg_dump_args+=("--data-only")
        pg_dump_args+=("--inserts")
        log_info "Backing up full database (schema + data)"
    fi
    
    # Include specific tables that are critical
    pg_dump_args+=("--table=content_queue")
    pg_dump_args+=("--table=posted_content") 
    pg_dump_args+=("--table=scheduled_posts")
    pg_dump_args+=("--table=admin_users")
    
    # Execute backup
    local backup_command="pg_dump ${pg_dump_args[*]} \"$CONN_STRING\""
    
    if [[ "$COMPRESS" == true && "$FORMAT" == "sql" ]]; then
        backup_command="$backup_command | gzip"
    fi
    
    backup_command="$backup_command > \"$backup_file\""
    
    log_verbose "Executing: $backup_command"
    
    if eval "$backup_command"; then
        log_success "Database backup completed"
    else
        log_error "Backup failed"
        return 1
    fi
    
    return 0
}

generate_metadata() {
    local backup_file="$1"
    local metadata_file="${backup_file}.meta"
    
    log_info "Generating backup metadata..."
    
    cat > "$metadata_file" << EOF
# Hotdog Diaries Database Backup Metadata
# Generated: $(date -u -Iseconds)

BACKUP_FILE=$(basename "$backup_file")
BACKUP_DATE=$(date -u -Iseconds)
BACKUP_TYPE=$([ "$TABLES_ONLY" == true ] && echo "schema-only" || echo "full")
BACKUP_FORMAT=$FORMAT
BACKUP_COMPRESSED=$([ "$COMPRESS" == true ] && echo "true" || echo "false")
SOURCE_DATABASE=$(echo "$CONN_STRING" | sed 's/:[^:]*@/:***@/')
BACKUP_SIZE=$(du -h "$backup_file" | cut -f1)
CHECKSUM_SHA256=$(shasum -a 256 "$backup_file" | cut -d' ' -f1)

# Restore Instructions:
# For custom format: pg_restore --clean --if-exists --create --dbname=target_db "$backup_file"
# For SQL format: psql target_db < "$backup_file"
# For compressed SQL: gunzip -c "$backup_file" | psql target_db

# Database Schema Version (if available):
SCHEMA_VERSION=$(psql "$CONN_STRING" -t -c "SELECT value FROM system_config WHERE key='schema_version' LIMIT 1;" 2>/dev/null | xargs || echo "unknown")

# Content Statistics at backup time:
CONTENT_QUEUE_COUNT=$(psql "$CONN_STRING" -t -c "SELECT COUNT(*) FROM content_queue;" 2>/dev/null | xargs || echo "unknown")
POSTED_CONTENT_COUNT=$(psql "$CONN_STRING" -t -c "SELECT COUNT(*) FROM posted_content;" 2>/dev/null | xargs || echo "unknown")
SCHEDULED_POSTS_COUNT=$(psql "$CONN_STRING" -t -c "SELECT COUNT(*) FROM scheduled_posts;" 2>/dev/null | xargs || echo "unknown")
ADMIN_USERS_COUNT=$(psql "$CONN_STRING" -t -c "SELECT COUNT(*) FROM admin_users;" 2>/dev/null | xargs || echo "unknown")
EOF
    
    log_success "Metadata file created: $(basename "$metadata_file")"
}

cleanup_old_backups() {
    log_info "Cleaning up old backups (retention: 30 days)..."
    
    local deleted_count=0
    
    # Find and delete backup files older than 30 days
    while IFS= read -r -d '' file; do
        if [[ -f "$file" ]]; then
            rm "$file"
            ((deleted_count++))
            log_verbose "Deleted old backup: $(basename "$file")"
        fi
    done < <(find "$BACKUP_DIR" -name "${BACKUP_PREFIX}_*" -type f -mtime +30 -print0 2>/dev/null)
    
    if [[ $deleted_count -gt 0 ]]; then
        log_success "Cleaned up $deleted_count old backup files"
    else
        log_info "No old backups to clean up"
    fi
}

verify_backup() {
    local backup_file="$1"
    
    log_info "Verifying backup integrity..."
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    local file_size
    file_size=$(du -h "$backup_file" | cut -f1)
    
    if [[ "$file_size" == "0B" ]]; then
        log_error "Backup file is empty"
        return 1
    fi
    
    # For custom format, verify with pg_restore --list
    if [[ "$FORMAT" == "custom" ]] && command -v pg_restore &> /dev/null; then
        if pg_restore --list "$backup_file" &> /dev/null; then
            log_success "Backup file structure verified"
        else
            log_error "Backup file appears corrupted"
            return 1
        fi
    fi
    
    log_success "Backup verified successfully ($file_size)"
    return 0
}

show_help() {
    cat << EOF
Supabase Database Backup Script

USAGE:
    ./scripts/backup-supabase.sh [OPTIONS]

OPTIONS:
    --compress          Compress backup with gzip (SQL format only)
    --tables-only       Backup schema only, no data
    --format FORMAT     Backup format: custom (default) or sql
    --backup-dir DIR    Backup directory (default: ./backups)
    --verbose           Show detailed output
    --help             Show this help message

ENVIRONMENT VARIABLES:
    DATABASE_URL       PostgreSQL connection string (primary)
    POSTGRES_URL       Alternative PostgreSQL connection string

EXAMPLES:
    ./scripts/backup-supabase.sh                    # Standard backup
    ./scripts/backup-supabase.sh --compress         # Compressed SQL backup
    ./scripts/backup-supabase.sh --tables-only      # Schema-only backup
    
BACKUP LOCATIONS:
    Backups are stored in: ./backups/YYYY/MM/supabase_backup_YYYY-MM-DD_HH-MM-SS.*
    
RESTORE EXAMPLES:
    # Custom format backup:
    pg_restore --clean --if-exists --create --dbname=target_db backup.dump
    
    # SQL format backup:
    psql target_db < backup.sql
    
    # Compressed SQL backup:
    gunzip -c backup.sql.gz | psql target_db

EOF
}

##
# Main execution
##

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --compress)
                COMPRESS=true
                shift
                ;;
            --tables-only)
                TABLES_ONLY=true
                shift
                ;;
            --format)
                FORMAT="$2"
                if [[ "$FORMAT" != "custom" && "$FORMAT" != "sql" ]]; then
                    log_error "Invalid format: $FORMAT. Use 'custom' or 'sql'"
                    exit 1
                fi
                shift 2
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
    
    echo "🗄️  Hotdog Diaries Database Backup"
    echo "=================================="
    echo ""
    
    # Run backup process
    check_dependencies
    validate_environment
    
    local backup_dir
    backup_dir=$(create_backup_directory)
    
    local backup_file
    backup_file=$(generate_backup_filename "$backup_dir")
    
    if create_backup "$backup_file"; then
        verify_backup "$backup_file"
        generate_metadata "$backup_file"
        cleanup_old_backups
        
        echo ""
        echo "🎉 Backup completed successfully!"
        echo "📍 Location: $backup_file"
        echo "📏 Size: $(du -h "$backup_file" | cut -f1)"
        echo "🔒 SHA256: $(shasum -a 256 "$backup_file" | cut -d' ' -f1)"
        echo ""
        
        # Print restore command suggestion
        if [[ "$FORMAT" == "custom" ]]; then
            echo "💡 To restore:"
            echo "   pg_restore --clean --if-exists --create --dbname=target_db \"$backup_file\""
        else
            if [[ "$COMPRESS" == true ]]; then
                echo "💡 To restore:"
                echo "   gunzip -c \"$backup_file\" | psql target_db"
            else
                echo "💡 To restore:"
                echo "   psql target_db < \"$backup_file\""
            fi
        fi
        echo ""
        
        exit 0
    else
        log_error "Backup process failed"
        exit 1
    fi
}

# Execute main function
main "$@"