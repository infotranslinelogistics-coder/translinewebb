const fs = require('fs');
const path = require('path');
const glob = require('glob');

const uiDir = path.join(__dirname, 'src', 'ui');

glob(path.join(uiDir, '*.tsx'), (err, files) => {
  if (err) {
    console.error('Error finding files:', err);
    return;
  }

  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf-8');
    
    // Fix double prefixed @radix-ui/@radix-ui
    content = content.replace(/@radix-ui\/@radix-ui/g, '@radix-ui');
    
    // Remove version specifiers from imports
    content = content.replace(/"@radix-ui\/[^@]*@[^"]*"/g, match => {
      const pkg = match.replace(/@[^"]*$/, '"');
      return pkg;
    });
    
    content = content.replace(/"lucide-react@[^"]*"/g, '"lucide-react"');
    content = content.replace(/"cmdk@[^"]*"/g, '"cmdk"');
    content = content.replace(/"react-day-picker@[^"]*"/g, '"react-day-picker"');
    content = content.replace(/"class-variance-authority@[^"]*"/g, '"class-variance-authority"');
    
    fs.writeFileSync(file, content, 'utf-8');
    console.log('Fixed:', path.basename(file));
  });

  console.log('Done!');
});
