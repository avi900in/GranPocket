import re

replacements = {
    "🛡️": '<img src="/icons/icon_shield.png" className="w-[1em] h-[1em] inline-block align-middle" alt="shield" />',
    "🔒": '<img src="/icons/icon_lock.png" className="w-[1em] h-[1em] inline-block align-middle" alt="lock" />',
    "💊": '<img src="/icons/icon_medicine.png" className="w-[1em] h-[1em] inline-block align-middle" alt="med" />',
    "⚠️": '<img src="/icons/icon_warning.png" className="w-[1em] h-[1em] inline-block align-middle" alt="warn" />',
    "⚠": '<img src="/icons/icon_warning.png" className="w-[1em] h-[1em] inline-block align-middle" alt="warn" />',
    "❌": '<img src="/icons/icon_stop.png" className="w-[1em] h-[1em] inline-block align-middle" alt="stop" />',
    "👌": '<img src="/icons/icon_perfect.png" className="w-[1em] h-[1em] inline-block align-middle" alt="perfect" />',
    "🌟": '<img src="/icons/icon_star.png" className="w-[1em] h-[1em] inline-block align-middle" alt="star" />',
    "🍼": '<img src="/icons/icon_milk.png" className="w-[1em] h-[1em] inline-block align-middle" alt="milk" />',
    "🤒": '<img src="/icons/icon_sick.png" className="w-[1em] h-[1em] inline-block align-middle" alt="sick" />',
    "📋": '<img src="/icons/icon_notes.png" className="w-[1em] h-[1em] inline-block align-middle" alt="notes" />',
    "✓": '<img src="/icons/icon_tick.png" className="w-[1em] h-[1em] inline-block align-middle" alt="tick" />',
    "🔴": '<img src="/icons/icon_stop.png" className="w-[1em] h-[1em] inline-block align-middle" alt="stop" />',
    "👥": '<img src="/icons/icon_people.png" className="w-[1em] h-[1em] inline-block align-middle" alt="people" />',
    "💡": '<img src="/icons/icon_bulb.png" className="w-[1em] h-[1em] inline-block align-middle" alt="bulb" />',
    "🚗": '<img src="/icons/icon_car.png" className="w-[1em] h-[1em] inline-block align-middle" alt="car" />',
    "🗺️": '<img src="/icons/icon_location_pin.png" className="w-[1em] h-[1em] inline-block align-middle" alt="map" />',
    "🗺": '<img src="/icons/icon_location_pin.png" className="w-[1em] h-[1em] inline-block align-middle" alt="map" />',
    "🏥": '<img src="/icons/icon_hospital.png" className="w-[1em] h-[1em] inline-block align-middle" alt="hospital" />',
    "🕒": '<img src="/icons/icon_clock.png" className="w-[1em] h-[1em] inline-block align-middle" alt="clock" />',
    "📍": '<img src="/icons/icon_location_pin.png" className="w-[1em] h-[1em] inline-block align-middle" alt="pin" />',
    "⏳": '<img src="/icons/icon_hourglass.png" className="w-[1em] h-[1em] inline-block align-middle" alt="hourglass" />',
    "📝": '<img src="/icons/icon_prescription.png" className="w-[1em] h-[1em] inline-block align-middle" alt="script" />',
    "📷": '<img src="/icons/icon_camera.png" className="w-[1em] h-[1em] inline-block align-middle" alt="camera" />',
}

def replace_in_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Manual safe replacements for string literals containing emojis in JSX (e.g. '🌟 Outstanding' -> <><img /> Outstanding</>)
    # We will just do a simple replacement. If it breaks syntax, we can fix it. But we must be careful with strings.
    # To be safe, we will just manually write regexes for common patterns we saw.

    # 1. TriageFlowView.tsx
    content = content.replace("💊 Active Meds", '<img src="/icons/icon_medicine.png" className="w-5 h-5 inline-block align-middle mr-1"/> Active Meds')
    content = content.replace(">🤒<", '><img src="/icons/icon_sick.png" className="w-10 h-10 inline-block align-middle"/><')
    content = content.replace("'🌟 Outstanding'", '<><img src="/icons/icon_star.png" className="w-4 h-4 inline-block align-middle mr-1"/> Outstanding</>')
    content = content.replace("'👌 Satisfactory / Average'", '<><img src="/icons/icon_perfect.png" className="w-4 h-4 inline-block align-middle mr-1"/> Satisfactory / Average</>')
    content = content.replace("'⚠️ Needs Improvement'", '<><img src="/icons/icon_warning.png" className="w-4 h-4 inline-block align-middle mr-1"/> Needs Improvement</>')
    content = content.replace("'❌ Unsatisfactory'", '<><img src="/icons/icon_stop.png" className="w-4 h-4 inline-block align-middle mr-1"/> Unsatisfactory</>')
    content = content.replace("'🌟 Outstanding & Life-saving'", '<><img src="/icons/icon_star.png" className="w-4 h-4 inline-block align-middle mr-1"/> Outstanding & Life-saving</>')
    content = content.replace("'⚠️ Needs Clinical Improvement'", '<><img src="/icons/icon_warning.png" className="w-4 h-4 inline-block align-middle mr-1"/> Needs Clinical Improvement</>')

    content = content.replace("👶 Baby Lucas Fever", '<img src="/icons/icon_boy.png" className="w-4 h-4 inline-block align-middle mr-1"/> Baby Lucas Fever')
    content = content.replace("👴 Grandpa Stroke FAST", '<img src="/icons/icon_grandpa.png" className="w-4 h-4 inline-block align-middle mr-1"/> Grandpa Stroke FAST')
    content = content.replace("👶 Infant Rash Sample", '<img src="/icons/icon_boy.png" className="w-4 h-4 inline-block align-middle mr-1"/> Infant Rash Sample')
    content = content.replace("💊 Medicine Bottle Sample", '<img src="/icons/icon_medicine.png" className="w-4 h-4 inline-block align-middle mr-1"/> Medicine Bottle Sample')
    
    content = content.replace("<span>🍼</span>", '<span><img src="/icons/icon_milk.png" className="w-5 h-5 inline-block align-middle"/></span>')
    content = content.replace("<span>👴</span>", '<span><img src="/icons/icon_grandpa.png" className="w-5 h-5 inline-block align-middle"/></span>')
    content = content.replace("<span>🤒</span>", '<span><img src="/icons/icon_sick.png" className="w-5 h-5 inline-block align-middle"/></span>')

    content = content.replace("<div>✓ Pediatric", '<div><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> Pediatric')
    content = content.replace("<div>✓ SCDF", '<div><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> SCDF')
    content = content.replace("<div>✓ Medisave", '<div><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> Medisave')
    content = content.replace("<div>✓ Dedicated", '<div><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> Dedicated')
    content = content.replace("<div>✓ Direct insurer", '<div><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> Direct insurer')
    content = content.replace("<div>✓ Electronic", '<div><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> Electronic')

    content = content.replace("📋 Teleconsult", '<img src="/icons/icon_notes.png" className="w-4 h-4 inline-block align-middle mr-1"/> Teleconsult')

    content = content.replace("⚠️ Hard Fall", '⚠️ Hard Fall') # leave string literals alone if they are used in showToast strings or just manually fix.
    
    # AppOwnerPortalView
    content = content.replace("'✅ Full'", '<><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> Full</>')
    content = content.replace("'👥 Care Recip.'", '<><img src="/icons/icon_people.png" className="w-4 h-4 inline-block align-middle mr-1"/> Care Recip.</>')
    content = content.replace("'👤 Own'", '<><img src="/icons/icon_gentleman.png" className="w-4 h-4 inline-block align-middle mr-1"/> Own</>')
    content = content.replace("'❌ None'", '<><img src="/icons/icon_stop.png" className="w-4 h-4 inline-block align-middle mr-1"/> None</>')

    content = content.replace("🔴 RED Tier", '<img src="/icons/icon_stop.png" className="w-3 h-3 inline-block align-middle mr-1"/> RED Tier')
    content = content.replace("🔴 RED (995 Emergency / Immediate A&E)", '<img src="/icons/icon_stop.png" className="w-4 h-4 inline-block align-middle mr-1"/> RED (995 Emergency / Immediate A&E)')
    content = content.replace("`🔴 RED Emergency (${redCount})`", "`🔴 RED Emergency (${redCount})`") # string literal inside template, better not to change to JSX. Or use 🔴.
    
    content = content.replace("💡 <strong>", '<img src="/icons/icon_bulb.png" className="w-4 h-4 inline-block align-middle mr-1"/> <strong>')

    # HospitalFinderView HTML strings
    content = content.replace("📍 ${language === 'zh' ? '您的当前位置' : 'Your Current Location'}", '<img src="/icons/icon_location_pin.png" style="width: 1em; height: 1em; display: inline-block; vertical-align: middle;" /> ${language === "zh" ? "您的当前位置" : "Your Current Location"}')
    content = content.replace("📍 ${facility.distance} km", '<img src="/icons/icon_location_pin.png" style="width: 1em; height: 1em; display: inline-block; vertical-align: middle;" /> ${facility.distance} km')
    content = content.replace("🚗 ${facility.eta}", '<img src="/icons/icon_car.png" style="width: 1em; height: 1em; display: inline-block; vertical-align: middle;" /> ${facility.eta}')
    content = content.replace("iconEmoji = '👶'", "iconEmoji = '<img src=\"/icons/icon_boy.png\" style=\"width:1.5em;height:1.5em;\"/>'")
    content = content.replace("iconEmoji = '🏥'", "iconEmoji = '<img src=\"/icons/icon_hospital.png\" style=\"width:1.5em;height:1.5em;\"/>'")
    content = content.replace("🗺️ Navigate", '<img src="/icons/icon_location_pin.png" className="w-4 h-4 inline-block align-middle mr-1"/> Navigate')
    content = content.replace("🕒 24-Hour Urgent", '<img src="/icons/icon_clock.png" className="w-4 h-4 inline-block align-middle mr-1"/> 24-Hour Urgent')
    content = content.replace("🏥 Polyclinics / GP", '<img src="/icons/icon_hospital.png" className="w-4 h-4 inline-block align-middle mr-1"/> Polyclinics / GP')
    content = content.replace("👶 Pediatric Emergency (KKH)", '<img src="/icons/icon_boy.png" className="w-4 h-4 inline-block align-middle mr-1"/> Pediatric Emergency (KKH)')
    content = content.replace("<span>💡 Click any marker", '<span><img src="/icons/icon_bulb.png" className="w-4 h-4 inline-block align-middle mr-1"/> Click any marker')

    # MedicationLogView
    content = content.replace("⏳ {elapsed}", '<img src="/icons/icon_hourglass.png" className="w-4 h-4 inline-block align-middle mr-1"/> {elapsed}')
    content = content.replace("📝 {log.notes}", '<img src="/icons/icon_prescription.png" className="w-4 h-4 inline-block align-middle mr-1"/> {log.notes}')
    content = content.replace("📷 Dose packaging", '<img src="/icons/icon_camera.png" className="w-4 h-4 inline-block align-middle mr-1"/> Dose packaging')
    content = content.replace("✓ Attached", '<img src="/icons/icon_tick.png" className="w-3 h-3 inline-block align-middle mr-1"/> Attached')
    
    # ClinicalKbConsoleView
    content = content.replace("'✓ Active Pre-Output Gate'", '<><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> Active Pre-Output Gate</>')
    content = content.replace("'✓ Inf/Snr Gate Active'", '<><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> Inf/Snr Gate Active</>')
    content = content.replace("👶 Infants §3.1", '<img src="/icons/icon_boy.png" className="w-4 h-4 inline-block align-middle mr-1"/> Infants §3.1')
    content = content.replace("👴 Seniors §3.2", '<img src="/icons/icon_grandpa.png" className="w-4 h-4 inline-block align-middle mr-1"/> Seniors §3.2')
    content = content.replace("'👶 Infant §3.1'", '<><img src="/icons/icon_boy.png" className="w-4 h-4 inline-block align-middle mr-1"/> Infant §3.1</>')
    content = content.replace("'👴 Senior §3.2'", '<><img src="/icons/icon_grandpa.png" className="w-4 h-4 inline-block align-middle mr-1"/> Senior §3.2</>')
    
    # App.tsx specific UI replacements
    content = content.replace(">🛡️<", '><img src="/icons/icon_shield.png" className="w-[1em] h-[1em] inline-block align-middle"/> <')
    content = content.replace(">🔒<", '><img src="/icons/icon_lock.png" className="w-[1em] h-[1em] inline-block align-middle"/> <')

    # Avatar replacements in data/mockData.ts & App.tsx
    content = content.replace("avatar: '👶'", "avatar: '/icons/icon_boy.png'")
    content = content.replace("avatar: '👴'", "avatar: '/icons/icon_grandpa.png'")
    content = content.replace("avatar: '👨'", "avatar: '/icons/icon_gentleman.png'")
    content = content.replace("avatar: '🧕'", "avatar: '/icons/icon_helper.png'")
    content = content.replace("avatar: '👩🏻'", "avatar: '/icons/icon_helper.png'")
    content = content.replace("avatar: '👩🏻‍⚕️'", "avatar: '/icons/icon_helper.png'")
    content = content.replace("avatar: '👧🏻'", "avatar: '/icons/icon_girl.png'")
    content = content.replace("avatar: '👵🏻'", "avatar: '/icons/icon_grandpa.png'")
    content = content.replace("avatar: newRelationship.toLowerCase().includes('baby') ? '👶' : newRelationship.toLowerCase().includes('child') ? '👧' : '👤'", "avatar: newRelationship.toLowerCase().includes('baby') ? '/icons/icon_boy.png' : newRelationship.toLowerCase().includes('child') ? '/icons/icon_girl.png' : '/icons/icon_gentleman.png'")
    
    # Render Avatar updates: {member.avatar || '👤'} -> <Avatar src={member.avatar} />
    # We will create a helper Avatar component or just inline it if it's easy.
    # Actually, inline:
    # {member.avatar ? <img src={member.avatar} alt="avatar" className="w-full h-full object-contain" /> : '👤'}
    # But some spans have text-2xl or text-xl. We need to be careful.
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

import os
for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            replace_in_file(path)

