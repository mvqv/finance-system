#!/usr/bin/env bash
# ============================================================
# Atlantix Lab — Shariah Guard deploy script
# Deploys zoya-sync edge function and sets ZOYA_API_KEY secret
#
# Usage:
#   ./scripts/deploy-shariah.sh
#
# Prerequisites:
#   supabase CLI logged in: npx supabase login
# ============================================================

set -euo pipefail

PROJECT_REF="hcmcsjsbfhhyeaozooas"
ZOYA_SANDBOX_KEY="sandbox-01e5ee6d-86f7-4294-a360-27b2365b3145"

echo "🕌 Atlantix Lab — Shariah Guard Deploy"
echo "======================================="

# 1. Set ZOYA_API_KEY secret in Supabase project
echo ""
echo "📦 Setting ZOYA_API_KEY secret..."
npx supabase secrets set ZOYA_API_KEY="${ZOYA_SANDBOX_KEY}" \
  --project-ref "${PROJECT_REF}"
echo "✅ ZOYA_API_KEY set (sandbox mode)"

# 2. Deploy zoya-sync edge function
echo ""
echo "🚀 Deploying zoya-sync edge function..."
npx supabase functions deploy zoya-sync \
  --project-ref "${PROJECT_REF}" \
  --no-verify-jwt
echo "✅ zoya-sync deployed"

# 3. Apply Shariah Guard migration
echo ""
echo "🗄️  Applying Shariah Guard DB migration..."
npx supabase db push --project-ref "${PROJECT_REF}"
echo "✅ Migration applied"

echo ""
echo "======================================="
echo "✅ Shariah Guard is live!"
echo ""
echo "Test the function:"
echo "  curl -X POST https://${PROJECT_REF}.supabase.co/functions/v1/zoya-sync \\"
echo "    -H 'Authorization: Bearer \$SUPABASE_ANON_KEY' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"tickers\":[\"XOM\",\"CVX\",\"TLT\",\"GLD\",\"SPY\"]}'"
echo ""
echo "NOTE: Sandbox data is randomized — not real compliance data."
echo "      To use live data, replace ZOYA_API_KEY with a live-XXXX key."
echo "      Attribution: Data provided by Zoya — https://zoya.finance/api"
