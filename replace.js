const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

const excludeDirs = ['node_modules', 'build', 'dist', '.git', 'public'];

function processFile(filePath) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.js')) return;
    if (excludeDirs.some(dir => filePath.includes(path.sep + dir + path.sep) || filePath.endsWith(path.sep + dir))) return;

    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('import.meta.env.VITE_')) {
        // If we've already replaced it here perfectly, don't double replace
        if (content.match(/window\.EXCALIDRAW_ENV\?\.VITE_/)) {
            // It might have multiple instances, some replaced, some not, but let's assume it's fine 
            // Actually we should safely replace all exact matches of import.meta.env.VITE_xxx
        }

        const newContent = content.replace(/import\.meta\.env\.(VITE_[A-Za-z0-9_]+)/g, '(window.EXCALIDRAW_ENV?.$1 || import.meta.env.$1)');

        if (newContent !== content) {
            fs.writeFileSync(filePath, newContent);
            console.log(`Updated ${filePath}`);
        }
    }
}

walk('excalidraw-app', processFile);
walk('packages', processFile);
walk('examples', processFile);
