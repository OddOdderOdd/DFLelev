#!/bin/bash
# DFLelev - Cleanup Script
# Ryd op i projektet: fjern gamle/ubrugte filer
# Kør fra: /home/oskar/DFLelev/
# 
# VIGTIGT: Læs igennem FØR du kører! Kommenter linjer ud hvis du er usikker.

set -e  # Stop ved fejl
cd /home/oskar/DFLelev

echo "🧹 DFLelev Cleanup"
echo "=================="
echo ""

# --- 1. Slet server_old/ (hele den gamle server) ---
echo "🗑️  Fjerner server_old/..."
rm -rf server_old/
echo "   ✅ server_old/ slettet"

# --- 2. Slet den gamle create-admin.js (beholder .cjs versionen) ---
echo "🗑️  Fjerner create-admin.js (gammel version)..."
rm -f create-admin.js
echo "   ✅ create-admin.js slettet"

# --- 3. Slet update-storage-config.js (ikke i arkitekturen) ---
echo "🗑️  Fjerner update-storage-config.js..."
rm -f update-storage-config.js
echo "   ✅ update-storage-config.js slettet"

# --- 4. Slet web/src/App.jsx.bak ---
echo "🗑️  Fjerner App.jsx.bak..."
rm -f web/src/App.jsx.bak
echo "   ✅ App.jsx.bak slettet"

# --- 5. Ryd temp-uploads ---
echo "🗑️  Rydder server/temp-uploads/..."
rm -rf server/temp-uploads/*
echo "   ✅ temp-uploads ryddet"

# --- 6. Ryd web/public/uploads (lokal fallback - ikke i brug) ---
echo "🗑️  Fjerner web/public/uploads/ (lokal fallback)..."
rm -rf web/public/uploads/
echo "   ✅ web/public/uploads/ slettet"

# --- 7. Ryd logs ---
echo "🗑️  Nulstiller logs/system.log..."
> logs/system.log
echo "   ✅ Log nulstillet"

# --- 8. Slet MIGRATION_PLAN.md (gammel) ---
echo "🗑️  Fjerner MIGRATION_PLAN.md..."
rm -f MIGRATION_PLAN.md
echo "   ✅ MIGRATION_PLAN.md slettet"

# --- 9. Slet INSTALLATION.md hvis den er duplikat af README ---
# (Kommenter ud hvis du vil beholde den)
echo "🗑️  Fjerner INSTALLATION.md..."
rm -f INSTALLATION.md
echo "   ✅ INSTALLATION.md slettet"

# --- 10. Slet dflelev-toggle.sh hvis den ikke bruges ---
echo "🗑️  Fjerner dflelev-toggle.sh..."
rm -f dflelev-toggle.sh
echo "   ✅ dflelev-toggle.sh slettet"

# --- 11. Slet duplikat PROJECT_ARCHITECTURE.md i web/ ---
echo "🗑️  Fjerner web/PROJECT_ARCHITECTURE.md (duplikat)..."
rm -f web/PROJECT_ARCHITECTURE.md
echo "   ✅ Duplikat arkitekturfil slettet"

# --- 12. Slet web/src/tina + web/tina (bruges ikke i v2) ---
# ADVARSEL: Kun slet hvis du ikke bruger TinaCMS
echo ""
echo "⚠️  TinaCMS filer (web/tina/ og web/src/tina/):"
echo "   Disse slettes IKKE automatisk - tjek om du bruger TinaCMS."
echo "   Kør manuelt hvis ikke:"
echo "   rm -rf web/tina web/src/tina"

# --- Resultat ---
echo ""
echo "✅ Cleanup færdig!"
echo ""
echo "Tilbageværende struktur:"
echo "  /home/oskar/DFLelev/"
echo "  ├── create-admin.cjs   ← admin setup"
echo "  ├── package.json"
echo "  ├── prisma/"
echo "  ├── scripts/cleanup.js"
echo "  ├── server/            ← aktiv backend"
echo "  ├── web/               ← frontend"
echo "  ├── PROJECT_ARCHITECTURE.md"
echo "  └── README.md"
echo ""
echo "Kør 'npm run dev' for at starte systemet."
