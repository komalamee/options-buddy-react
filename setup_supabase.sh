#!/bin/bash

# Supabase setup script
# This will guide you through creating a Supabase database

echo "================================================================"
echo "SUPABASE POSTGRESQL SETUP"
echo "================================================================"
echo ""
echo "I need you to do ONE thing (takes 2 minutes):"
echo ""
echo "1. Go to: https://supabase.com/dashboard/sign-up"
echo "2. Sign up with GitHub (one click)"
echo "3. Create a new project:"
echo "   - Project name: options-buddy"
echo "   - Database password: (create a strong password and save it)"
echo "   - Region: Select closest to you"
echo "4. Wait 2 minutes for database to provision"
echo ""
echo "5. Go to Project Settings → Database"
echo "6. Copy the 'Connection string' (URI format)"
echo "   It looks like: postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres"
echo ""
echo "7. Paste it below when ready"
echo ""
read -p "Paste your Supabase connection string: " DATABASE_URL

echo ""
echo "Adding to Railway..."

# This would add to Railway via API if we had the token
echo "DATABASE_URL=$DATABASE_URL"
echo ""
echo "================================================================"
echo "COPY THIS AND ADD IT TO RAILWAY MANUALLY:"
echo "================================================================"
echo ""
echo "Variable: DATABASE_URL"
echo "Value: $DATABASE_URL"
echo ""
echo "Then I'll create all the tables and whitelist your emails."
