import os
import re

def revert_avatar(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    original = content
    
    # 1. Revert <img src={getAvatarIcon(m.avatar)} ... /> to {m.avatar || '👤'}
    # Also handle the className variations if there are any
    content = re.sub(
        r'<img src=\{getAvatarIcon\(([a-zA-Z0-9_\.\?]+)\.avatar\)\} className="[^"]+" alt="avatar" />',
        r'{\1.avatar || \'👤\'}',
        content
    )
    
    # 2. Remove import { getAvatarIcon } ...
    content = re.sub(r'import \{ getAvatarIcon \} from \'[^\']+\';\n?', '', content)

    # 3. Replace any remaining {member.avatar ? <img /> : <img />} if fix_avatar_logic missed it
    content = re.sub(
        r'\{([a-zA-Z0-9_\.\?]+)\.avatar \? <img src=\{([a-zA-Z0-9_\.\?]+)\.avatar\} className="[^"]+" alt="avatar" /> : <img src="[^"]+" className="[^"]+" alt="avatar" />\}',
        r'{\1.avatar || \'👤\'}',
        content
    )
    
    # Update default avatar '/icons/icon_boy.png' in schedulerService etc.
    content = content.replace("'/icons/icon_boy.png'", "'👶'")
    content = content.replace("'/icons/icon_gentleman.png'", "'👤'")

    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            revert_avatar(path)

