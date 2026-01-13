# Documentation Index

## Overview Documents

**Start here** if you're new to this fix:

- **[EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)** - High-level overview of the problem and solution
- **[README_IMPLEMENTATION.md](README_IMPLEMENTATION.md)** - Quick reference card with key info
- **[IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md)** - What was delivered and next steps

## Setup & Running

**Follow these to get started**:

- **[RUN_COMMANDS.md](RUN_COMMANDS.md)** - Exact commands to run (copy-paste ready)
- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Comprehensive setup guide with troubleshooting
- **[VERIFY_SETUP.sh](VERIFY_SETUP.sh)** - Script to verify all files are correct
- **[setup-dev.sh](setup-dev.sh)** - Installation guide shell script

## Implementation Details

**Deep dive into how it works**:

- **[COMPLETE_CHANGES.md](COMPLETE_CHANGES.md)** - Detailed before/after for every file
- **[IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md)** - Implementation summary
- **[ARCHITECTURE_DETAILED.md](ARCHITECTURE_DETAILED.md)** - Request flow and routing details

## Testing & Verification

**Use these to verify everything works**:

- **[TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)** - Comprehensive testing checklist
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick reference (existing doc, not changed)

---

## Files Modified

| File | Status | Key Change |
|------|--------|-----------|
| `dev-server.js` | ✨ NEW | Express server for both apps |
| `vite.config.ts` | 📝 MODIFIED | Added middlewareMode, removed proxy |
| `portal/vite.config.ts` | 📝 MODIFIED | Added middlewareMode |
| `portal/index.html` | 📝 MODIFIED | Updated script src |
| `server.js` | 📝 MODIFIED | Reordered handlers |
| `package.json` | 📝 MODIFIED | Updated dev script |

---

## Quick Start

```bash
# 1. Install
npm install

# 2. Run dev server
npm run dev

# 3. Visit
# Main site:   http://localhost:5173
# Admin portal: http://localhost:5173/portal
```

For production:
```bash
npm run build
npm start
# Then visit http://localhost:5000 and http://localhost:5000/portal
```

---

## Problem Summary

**Before**: Portal wouldn't load at `/portal` - showed white page or main site  
**After**: Portal loads correctly at `/portal` with React rendering, HMR, and proper asset loading

**Root Cause**: Vite's proxy-based approach breaks SPA routing at subpaths  
**Solution**: Express server with Vite in middlewareMode (direct middleware integration)

---

## Key Configuration Points

1. **dev-server.js**: Express server mounting both Vite apps as middleware
2. **Portal middleware mounted FIRST**: Ensures `/portal/*` goes to portal app
3. **middlewareMode: true**: In both Vite configs for dev
4. **base: "/portal/"**: In portal Vite config for production asset paths
5. **React Router basename="/portal"**: Already correct in portal app

---

## Testing

Quick verification:
```bash
npm install
npm run dev

# In another terminal:
curl http://localhost:5173        # Main site
curl http://localhost:5173/portal # Portal app
```

See [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) for comprehensive tests.

---

## Documentation Guide

### For Different Audiences

**I'm a developer and want to get started quickly:**
→ Read [README_IMPLEMENTATION.md](README_IMPLEMENTATION.md) then [RUN_COMMANDS.md](RUN_COMMANDS.md)

**I want to understand what changed:**
→ Read [COMPLETE_CHANGES.md](COMPLETE_CHANGES.md)

**I need to troubleshoot an issue:**
→ Check [SETUP_GUIDE.md](SETUP_GUIDE.md) troubleshooting section

**I want to understand the architecture:**
→ Read [ARCHITECTURE_DETAILED.md](ARCHITECTURE_DETAILED.md)

**I need to verify everything is set up correctly:**
→ Run [VERIFY_SETUP.sh](VERIFY_SETUP.sh) then [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)

**I want a high-level overview:**
→ Start with [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)

---

## Documentation Structure

```
Overview
  ├─ EXECUTIVE_SUMMARY.md (high-level)
  ├─ README_IMPLEMENTATION.md (quick ref)
  └─ IMPLEMENTATION_COMPLETE.md (summary)

Setup & Running
  ├─ RUN_COMMANDS.md (copy-paste commands)
  ├─ SETUP_GUIDE.md (comprehensive guide)
  ├─ VERIFY_SETUP.sh (verification script)
  └─ setup-dev.sh (install guide)

Details
  ├─ COMPLETE_CHANGES.md (before/after)
  ├─ IMPLEMENTATION_NOTES.md (summary)
  └─ ARCHITECTURE_DETAILED.md (deep dive)

Testing
  ├─ TESTING_CHECKLIST.md (verification)
  └─ QUICK_REFERENCE.md (existing ref)
```

---

## Changes at a Glance

### Created
- `dev-server.js` - 95 lines of Express + Vite middleware code

### Modified
- `vite.config.ts` - 3 lines (removed proxy, added middlewareMode)
- `portal/vite.config.ts` - 1 line (added middlewareMode)
- `portal/index.html` - 1 line (script src path)
- `server.js` - 3 lines (reordered handlers)
- `package.json` - 1 line (dev script)

**Total Impact**: 104 lines added/modified across 6 files

---

## Backward Compatibility

✅ **No breaking changes for end users**  
✅ **Old dev scripts preserved** (`dev:old`, `dev:portal:old`)  
✅ **Same production server** (just fixed handler order)  
✅ **Can rollback easily** if needed

---

## Support

If you encounter issues:

1. **Check these docs in order:**
   - [SETUP_GUIDE.md](SETUP_GUIDE.md) - Troubleshooting section
   - [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) - Verification steps
   - [ARCHITECTURE_DETAILED.md](ARCHITECTURE_DETAILED.md) - Request flow

2. **Use the verification script:**
   ```bash
   bash VERIFY_SETUP.sh
   ```

3. **Check file content:**
   - dev-server.js exists and is 95+ lines
   - vite.config.ts has `middlewareMode: true`
   - portal/vite.config.ts has `middlewareMode: true` and `base: "/portal/"`
   - portal/index.html has `src="/portal/main.tsx"`

---

## Quick Links

| Need | File |
|------|------|
| How to run | [RUN_COMMANDS.md](RUN_COMMANDS.md) |
| Troubleshooting | [SETUP_GUIDE.md](SETUP_GUIDE.md#troubleshooting) |
| What changed | [COMPLETE_CHANGES.md](COMPLETE_CHANGES.md) |
| How it works | [ARCHITECTURE_DETAILED.md](ARCHITECTURE_DETAILED.md) |
| Verify setup | [VERIFY_SETUP.sh](VERIFY_SETUP.sh) |
| Testing | [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) |
| Overview | [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) |

---

**Last Updated**: January 11, 2026  
**Status**: ✅ Complete and ready for use  
**Documentation**: 8 guides + 1 script  
**Files Changed**: 6  
**Lines Added**: ~104  

Start with [README_IMPLEMENTATION.md](README_IMPLEMENTATION.md) or [RUN_COMMANDS.md](RUN_COMMANDS.md).
