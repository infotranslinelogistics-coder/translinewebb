#!/bin/bash
# 
# Portal Deployment Script
# Copies built portal to /portal and sets up permissions
# Run this after: npm run build
#
# Usage: sudo bash deploy-portal.sh
#

set -e

PORTAL_BUILD_DIR="/workspaces/Translineweb/dist-portal"
PORTAL_INSTALL_DIR="/portal"
WORKSPACE_DIR="/workspaces/Translineweb"

echo "================================"
echo "Portal Deployment to /portal"
echo "================================"
echo ""

# Step 1: Check if build exists
if [ ! -d "$PORTAL_BUILD_DIR" ]; then
    echo "❌ Error: $PORTAL_BUILD_DIR does not exist"
    echo "Please run: npm run build"
    exit 1
fi

# Step 2: Create /portal directory structure
echo "📁 Creating /portal directory structure..."
mkdir -p "$PORTAL_INSTALL_DIR"
mkdir -p "$PORTAL_INSTALL_DIR/assets"
mkdir -p "$PORTAL_INSTALL_DIR/src"

# Step 3: Copy built files
echo "📋 Copying built portal files..."
cp -r "$PORTAL_BUILD_DIR"/* "$PORTAL_INSTALL_DIR/"

# Step 4: Copy source for development (optional)
echo "📋 Copying portal source files..."
cp -r "$WORKSPACE_DIR/portal/src" "$PORTAL_INSTALL_DIR/"
cp "$WORKSPACE_DIR/portal/package.json" "$PORTAL_INSTALL_DIR/"
cp "$WORKSPACE_DIR/portal/tsconfig.json" "$PORTAL_INSTALL_DIR/"
cp "$WORKSPACE_DIR/portal/vite.config.ts" "$PORTAL_INSTALL_DIR/"

# Step 5: Set permissions
echo "🔐 Setting permissions..."
# Get current user (the one running sudo)
CURRENT_USER="${SUDO_USER:-$(whoami)}"
chown -R "$CURRENT_USER:$CURRENT_USER" "$PORTAL_INSTALL_DIR"
chmod -R 755 "$PORTAL_INSTALL_DIR"
chmod -R 644 "$PORTAL_INSTALL_DIR"/*.{html,json}
chmod 755 "$PORTAL_INSTALL_DIR"

# Step 6: Verify
echo ""
echo "✅ Deployment complete!"
echo ""
echo "Portal installed at: $PORTAL_INSTALL_DIR"
echo ""
echo "Contents:"
ls -la "$PORTAL_INSTALL_DIR/" | head -15

echo ""
echo "📍 File listing:"
find "$PORTAL_INSTALL_DIR" -maxdepth 2 -type f | head -20

echo ""
echo "🌐 Access portal at:"
echo "   http://localhost:5000/portal"
echo ""
echo "✨ Done!"
