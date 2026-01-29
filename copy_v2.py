import shutil
import os
import sys

def ignore_patterns(path, names):
    keep = []
    # Ignore the destination folder itself to avoid infinite recursion
    if "NUMBER 2 CHECKLIST" in path:
        return names
    
    for name in names:
        if name == "NUMBER 2 CHECKLIST" or name == ".git" or name == "__pycache__":
            keep.append(name)
    return keep

src = os.getcwd()
dest = os.path.join(src, "NUMBER 2 CHECKLIST")

if os.path.exists(dest):
    print(f"Removing existing directory: {dest}")
    shutil.rmtree(dest)

print(f"Copying from {src} to {dest}...")
try:
    # Removed dirs_exist_ok=True for Python < 3.8 compatibility
    shutil.copytree(src, dest, ignore=ignore_patterns)
    print("Success! Project cloned to 'NUMBER 2 CHECKLIST'")
except Exception as e:
    print(f"Error copying: {e}")
