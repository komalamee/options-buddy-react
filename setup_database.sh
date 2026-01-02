#!/bin/bash

echo "🚀 Setting up Supabase database for Options Buddy..."
echo ""

# Supabase connection details
HOST="aws-0-us-west-1.pooler.supabase.com"
PORT="6543"
USER="postgres.qjaxsvqlvlguloyzcbnk"
DBNAME="postgres"
PASSWORD="jesusfuckingchrist1234"

# Test connection first
echo "Testing connection to Supabase..."
PGPASSWORD="$PASSWORD" psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DBNAME" -c "SELECT version();" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "❌ Could not connect to Supabase. Check your internet connection."
    exit 1
fi

echo "✅ Connected to Supabase!"
echo ""
echo "Creating tables and whitelisting emails..."

# Run the SQL file
PGPASSWORD="$PASSWORD" psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DBNAME" -f init_supabase.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database setup complete!"
    echo ""
    echo "Whitelisted emails:"
    echo "  - komalamee@gmail.com"
    echo "  - hjjamin@gmail.com"
    echo ""
    echo "You can now deploy to Render!"
else
    echo "❌ Database setup failed. Check the error above."
    exit 1
fi