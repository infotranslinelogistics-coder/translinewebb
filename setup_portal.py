#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys

def run_cmd(cmd):
    """Run a shell command with sudo"""
    result = subprocess.run(f"sudo bash -c '{cmd}'", shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return False
    return True

def main():
    src_dir = "/workspaces/Translineweb/portal_extracted"
    portal_base = "/portal"
    
    print("Setting up /portal directory structure...")
    
    # Create directory structure
    dirs = [
        "/portal/src/components/ui",
        "/portal/src/utils/supabase",
        "/portal/src/assets",
        "/portal/public"
    ]
    
    for d in dirs:
        run_cmd(f"mkdir -p {d}")
    
    # Make sure current user owns /portal
    user = os.getenv('USER')
    run_cmd(f"chown -R {user}:{user} /portal")
    
    # Copy extracted components
    components = [
        "AdminOverrides.tsx",
        "DriversManagement.tsx",
        "EventLogs.tsx",
        "LiveShiftsMonitor.tsx",
        "OdometerReview.tsx",
        "OverviewDashboard.tsx",
        "ShiftDetailView.tsx",
        "VehiclesManagement.tsx"
    ]
    
    for comp in components:
        src = f"{src_dir}/{comp}"
        dst = f"/portal/src/components/{comp}"
        if os.path.exists(src):
            shutil.copy(src, dst)
            print(f"Copied {comp}")
    
    # Copy UI components
    ui_dir = f"{src_dir}/ui"
    if os.path.exists(ui_dir):
        for file in os.listdir(ui_dir):
            src = os.path.join(ui_dir, file)
            dst = f"/portal/src/components/ui/{file}"
            if os.path.isfile(src):
                shutil.copy(src, dst)
        print("Copied UI components")
    
    # Copy utilities
    utils_files = ["info.tsx", "kv_store.tsx", "globals.css"]
    for f in utils_files:
        src = f"{src_dir}/{f}"
        if os.path.exists(src):
            if f == "globals.css":
                dst = f"/portal/src/{f}"
            else:
                dst = f"/portal/src/utils/supabase/{f}"
            shutil.copy(src, dst)
            print(f"Copied {f}")
    
    # Copy figma
    figma_src = f"{src_dir}/figma"
    if os.path.exists(figma_src):
        shutil.copytree(figma_src, "/portal/src/components/figma", dirs_exist_ok=True)
        print("Copied figma components")
    
    # Copy App.tsx
    app_src = "/workspaces/Translineweb/portal/App.tsx"
    if os.path.exists(app_src):
        shutil.copy(app_src, "/portal/src/App.tsx")
        print("Copied App.tsx")
    
    print("\nPortal structure created successfully!")
    
    # List what was created
    for root, dirs, files in os.walk("/portal"):
        level = root.replace("/portal", "").count(os.sep)
        indent = " " * 2 * level
        print(f"{indent}{os.path.basename(root)}/")
        sub_indent = " " * 2 * (level + 1)
        for file in files:
            print(f"{sub_indent}{file}")

if __name__ == "__main__":
    main()
