#!/usr/bin/env python3
import re
import os

ui_dir = '/workspaces/Translineweb/portal/src/ui'

for filename in os.listdir(ui_dir):
    if not filename.endswith('.tsx'):
        continue
    
    filepath = os.path.join(ui_dir, filename)
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Fix double prefixed @radix-ui/@radix-ui
    content = re.sub(r'@radix-ui/@radix-ui', '@radix-ui', content)
    
    # Remove version specifiers from @radix-ui imports
    content = re.sub(r'"@radix-ui/([^@"]+)@[^"]*"', r'"@radix-ui/\1"', content)
    
    # Remove version specifiers from other imports
    content = re.sub(r'"lucide-react@[^"]*"', '"lucide-react"', content)
    content = re.sub(r'"cmdk@[^"]*"', '"cmdk"', content)
    content = re.sub(r'"react-day-picker@[^"]*"', '"react-day-picker"', content)
    content = re.sub(r'"class-variance-authority@[^"]*"', '"class-variance-authority"', content)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f'Fixed: {filename}')

print('Done!')
