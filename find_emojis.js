const fs = require('fs');
const path = require('path');
const emojis = ["👧🏻", "🛡", "🔒", "👨", "🏡", "💊", "⚠", "👴", "❌", "👌", "🌟", "🍼", "🤒", "📋", "✓", "🔴", "👥", "💡", "🚗", "🏥", "🕒", "📍", "⏳", "📝", "📷", "🧕"];
function searchDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            searchDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                const found = emojis.find(e => line.includes(e));
                if (found) {
                    console.log(`${fullPath}:${i+1}: ${line.trim()}`);
                }
            });
        }
    });
}
searchDir('src');
