#!/bin/bash

# Portal Setup Script
# This script helps set up the admin portal at /portal

set -e

echo "🚀 Transline Portal Setup"
echo "=========================="
echo ""

# Step 1: Install main app dependencies
echo "📦 Installing main app dependencies..."
npm install

# Step 2: Install portal dependencies
echo "📦 Installing portal app dependencies..."
cd portal
npm install
cd ..

# Step 3: Build both apps
echo "🔨 Building main site..."
npm run build

echo "🔨 Building portal..."
npm run build:portal

# Step 4: Show build output
echo ""
echo "✅ Build complete!"
echo ""
echo "Build output locations:"
echo "  Main site: ./dist/"
echo "  Portal: ./dist-portal/"
echo ""

# Step 5: Instructions
echo "📋 Next steps:"
echo ""
echo "Development:"
echo "  npm run dev:all          # Run both dev servers"
echo "  npm run dev              # Main site only"
echo "  npm run dev:portal       # Portal only"
echo ""
echo "Production:"
echo "  npm run build            # Build both apps"
echo "  npm start                # Start Express server"
echo "  npm run start:prod       # Build + Start"
echo ""
echo "Server will be available at:"
echo "  Main site: http://localhost:5000"
echo "  Portal: http://localhost:5000/portal"
echo ""
echo "✨ Setup complete!"
