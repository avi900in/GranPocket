import os
import re

# 1. Update src/utils/iconMap.ts
icon_map_path = 'src/utils/iconMap.ts'
with open(icon_map_path, 'r', encoding='utf-8') as f:
    icon_map_content = f.read()

if 'export function getAvatarIcon' not in icon_map_content:
    icon_map_content += """
export function getAvatarIcon(avatar?: string | null): string {
  if (!avatar) return '/icons/icon_gentleman.png';
  if (avatar.startsWith('/icons/')) return avatar;
  
  const map: Record<string, string> = {
    '👦': '/icons/icon_boy.png',
    '👶': '/icons/icon_boy.png',
    '👨': '/icons/icon_gentleman.png',
    '👴': '/icons/icon_grandpa.png',
    '👵': '/icons/icon_grandpa.png',
    '👩': '/icons/icon_helper.png',
    '🧕': '/icons/icon_helper.png',
    '👧': '/icons/icon_girl.png',
    '👤': '/icons/icon_gentleman.png'
  };
  
  for (const [emoji, path] of Object.entries(map)) {
    if (avatar.includes(emoji)) return path;
  }
  
  return '/icons/icon_gentleman.png';
}
"""
    with open(icon_map_path, 'w', encoding='utf-8') as f:
        f.write(icon_map_content)

# 2. Fix the 8 files
def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Calculate relative path to src/utils/iconMap
    # path is like src/components/MultiAgentSimulatorView.tsx
    # depth is 1
    depth = path.count('/') - 1
    rel_path = '../' * depth + 'utils/iconMap' if depth > 0 else './utils/iconMap'
    
    # Add import if not present
    if 'getAvatarIcon' not in content:
        import_stmt = f"import {{ getAvatarIcon }} from '{rel_path}';\n"
        # Find last import
        last_import_idx = content.rfind('import ')
        if last_import_idx != -1:
            end_of_line = content.find('\n', last_import_idx)
            content = content[:end_of_line+1] + import_stmt + content[end_of_line+1:]
        else:
            content = import_stmt + content
            
    # Replace the img pattern
    # Old pattern:
    # {m.avatar ? <img src={m.avatar} className="w-[1em] h-[1em] inline-block align-middle object-contain" alt="avatar" /> : <img src="/icons/icon_gentleman.png" className="w-[1em] h-[1em] inline-block align-middle object-contain" alt="avatar" />}
    # We want:
    # <img src={getAvatarIcon(m.avatar)} className="w-[1em] h-[1em] inline-block align-middle object-contain" alt="avatar" />
    
    content = re.sub(
        r'\{([a-zA-Z0-9_\.\?]+)\.avatar \? <img src=\{([a-zA-Z0-9_\.\?]+)\.avatar\} className="([^"]+)" alt="avatar" /> : <img src="[^"]+" className="[^"]+" alt="avatar" />\}',
        r'<img src={getAvatarIcon(\1.avatar)} className="\3" alt="avatar" />',
        content
    )
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                c = f.read()
            if 'alt="avatar"' in c and ' ? <img src={' in c:
                fix_file(path)

