#!/bin/bash
# FINAL VERIFICATION - Run these commands in order

echo "=========================================="
echo "Translineweb Monorepo - Final Verification"
echo "=========================================="
echo ""

# Step 1: Check files exist
echo "Step 1: Checking files exist..."
echo ""

files=(
  "dev-server.js"
  "vite.config.ts"
  "portal/vite.config.ts"
  "portal/index.html"
  "server.js"
  "package.json"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ $file (MISSING!)"
  fi
done

echo ""
echo "=========================================="
echo "Step 2: Checking configuration"
echo "=========================================="
echo ""

# Check vite configs have middlewareMode
if grep -q "middlewareMode: true" vite.config.ts; then
  echo "✅ vite.config.ts has middlewareMode: true"
else
  echo "❌ vite.config.ts missing middlewareMode: true"
fi

if grep -q "middlewareMode: true" portal/vite.config.ts; then
  echo "✅ portal/vite.config.ts has middlewareMode: true"
else
  echo "❌ portal/vite.config.ts missing middlewareMode: true"
fi

# Check portal vite has correct base
if grep -q 'base: "/portal/"' portal/vite.config.ts; then
  echo "✅ portal/vite.config.ts has base: \"/portal/\""
else
  echo "❌ portal/vite.config.ts missing base: \"/portal/\""
fi

# Check portal index.html has correct script
if grep -q 'src="/portal/main.tsx"' portal/index.html; then
  echo "✅ portal/index.html has correct script src"
else
  echo "❌ portal/index.html has wrong script src"
fi

# Check package.json has correct dev script
if grep -q '"dev": "node dev-server.js"' package.json; then
  echo "✅ package.json has correct dev script"
else
  echo "❌ package.json has wrong dev script"
fi

# Check no proxy in root vite config
if grep -q "proxy:" vite.config.ts; then
  echo "❌ vite.config.ts still has proxy (should be removed)"
else
  echo "✅ vite.config.ts has no proxy"
fi

# Check no proxy in portal vite config
if grep -q "proxy:" portal/vite.config.ts; then
  echo "❌ portal/vite.config.ts still has proxy"
else
  echo "✅ portal/vite.config.ts has no proxy"
fi

echo ""
echo "=========================================="
echo "Step 3: Check dev-server.js content"
echo "=========================================="
echo ""

# Check dev-server.js basics
if grep -q "import express" dev-server.js; then
  echo "✅ dev-server.js imports express"
else
  echo "❌ dev-server.js doesn't import express"
fi

if grep -q "middlewareMode: true" dev-server.js; then
  echo "✅ dev-server.js creates servers with middlewareMode"
else
  echo "❌ dev-server.js missing middlewareMode"
fi

if grep -q "app.use('/portal', vitePortal.middlewares)" dev-server.js; then
  echo "✅ dev-server.js mounts portal middleware"
else
  echo "❌ dev-server.js doesn't mount portal middleware"
fi

if grep -q "PORT = 5173" dev-server.js; then
  echo "✅ dev-server.js uses port 5173"
else
  echo "❌ dev-server.js not on port 5173"
fi

echo ""
echo "=========================================="
echo "Step 4: Summary"
echo "=========================================="
echo ""
echo "If all checks passed, you can run:"
echo ""
echo "  npm install"
echo "  npm run dev"
echo ""
echo "Then visit:"
echo "  http://localhost:5173        (main site)"
echo "  http://localhost:5173/portal (admin portal)"
echo ""
echo "For production:"
echo "  npm run build"
echo "  npm start"
echo ""

