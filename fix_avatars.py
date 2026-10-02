import os
import re

def replace_in_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Update {XXX.avatar || '👤'}
    # e.g., {member.avatar || '👤'}
    content = re.sub(
        r'\{([a-zA-Z0-9_\.\?]+)\.avatar\s*\|\|\s*\'👤\'\}',
        r'{\1.avatar ? <img src={\1.avatar} className="w-[1em] h-[1em] inline-block align-middle object-contain" alt="avatar" /> : <img src="/icons/icon_gentleman.png" className="w-[1em] h-[1em] inline-block align-middle object-contain" alt="avatar" />}',
        content
    )

    # 2. Update default avatar '👶' in schedulerService etc. if any remaining.
    content = content.replace("'👶'", "'/icons/icon_boy.png'")
    content = content.replace("'👤'", "'/icons/icon_gentleman.png'")
    
    # Update <span className="text-xl p-1 bg-slate-100 dark:bg-[#0F1A20] rounded-xl">{m.avatar || '👤'}</span> 
    # to be rendered properly. Wait, the above regex replaces {m.avatar || '👤'} properly!
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            replace_in_file(path)

