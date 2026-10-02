import os

replacements = {
    '<img src="/icons/icon_shield.png" className="w-[1em] h-[1em] inline-block align-middle" alt="shield" />': "🛡️",
    '<img src="/icons/icon_lock.png" className="w-[1em] h-[1em] inline-block align-middle" alt="lock" />': "🔒",
    '<img src="/icons/icon_medicine.png" className="w-[1em] h-[1em] inline-block align-middle" alt="med" />': "💊",
    '<img src="/icons/icon_warning.png" className="w-[1em] h-[1em] inline-block align-middle" alt="warn" />': "⚠️",
    '<img src="/icons/icon_stop.png" className="w-[1em] h-[1em] inline-block align-middle" alt="stop" />': "❌",
    '<img src="/icons/icon_perfect.png" className="w-[1em] h-[1em] inline-block align-middle" alt="perfect" />': "👌",
    '<img src="/icons/icon_star.png" className="w-[1em] h-[1em] inline-block align-middle" alt="star" />': "🌟",
    '<img src="/icons/icon_milk.png" className="w-[1em] h-[1em] inline-block align-middle" alt="milk" />': "🍼",
    '<img src="/icons/icon_sick.png" className="w-[1em] h-[1em] inline-block align-middle" alt="sick" />': "🤒",
    '<img src="/icons/icon_notes.png" className="w-[1em] h-[1em] inline-block align-middle" alt="notes" />': "📋",
    '<img src="/icons/icon_tick.png" className="w-[1em] h-[1em] inline-block align-middle" alt="tick" />': "✓",
    '<img src="/icons/icon_people.png" className="w-[1em] h-[1em] inline-block align-middle" alt="people" />': "👥",
    '<img src="/icons/icon_bulb.png" className="w-[1em] h-[1em] inline-block align-middle" alt="bulb" />': "💡",
    '<img src="/icons/icon_car.png" className="w-[1em] h-[1em] inline-block align-middle" alt="car" />': "🚗",
    '<img src="/icons/icon_location_pin.png" className="w-[1em] h-[1em] inline-block align-middle" alt="map" />': "🗺️",
    '<img src="/icons/icon_hospital.png" className="w-[1em] h-[1em] inline-block align-middle" alt="hospital" />': "🏥",
    '<img src="/icons/icon_clock.png" className="w-[1em] h-[1em] inline-block align-middle" alt="clock" />': "🕒",
    '<img src="/icons/icon_hourglass.png" className="w-[1em] h-[1em] inline-block align-middle" alt="hourglass" />': "⏳",
    '<img src="/icons/icon_prescription.png" className="w-[1em] h-[1em] inline-block align-middle" alt="script" />': "📝",
    '<img src="/icons/icon_camera.png" className="w-[1em] h-[1em] inline-block align-middle" alt="camera" />': "📷",

    '<img src="/icons/icon_medicine.png" className="w-5 h-5 inline-block align-middle mr-1"/> Active Meds': '💊 Active Meds',
    '><img src="/icons/icon_sick.png" className="w-10 h-10 inline-block align-middle"/><': '>🤒<',
    '<><img src="/icons/icon_star.png" className="w-4 h-4 inline-block align-middle mr-1"/> Outstanding</>': "'🌟 Outstanding'",
    '<><img src="/icons/icon_perfect.png" className="w-4 h-4 inline-block align-middle mr-1"/> Satisfactory / Average</>': "'👌 Satisfactory / Average'",
    '<><img src="/icons/icon_warning.png" className="w-4 h-4 inline-block align-middle mr-1"/> Needs Improvement</>': "'⚠️ Needs Improvement'",
    '<><img src="/icons/icon_stop.png" className="w-4 h-4 inline-block align-middle mr-1"/> Unsatisfactory</>': "'❌ Unsatisfactory'",
    '<><img src="/icons/icon_star.png" className="w-4 h-4 inline-block align-middle mr-1"/> Outstanding & Life-saving</>': "'🌟 Outstanding & Life-saving'",
    '<><img src="/icons/icon_warning.png" className="w-4 h-4 inline-block align-middle mr-1"/> Needs Clinical Improvement</>': "'⚠️ Needs Clinical Improvement'",

    '<img src="/icons/icon_boy.png" className="w-4 h-4 inline-block align-middle mr-1"/> Baby Lucas Fever': '👶 Baby Lucas Fever',
    '<img src="/icons/icon_grandpa.png" className="w-4 h-4 inline-block align-middle mr-1"/> Grandpa Stroke FAST': '👴 Grandpa Stroke FAST',
    '<img src="/icons/icon_boy.png" className="w-4 h-4 inline-block align-middle mr-1"/> Infant Rash Sample': '👶 Infant Rash Sample',
    '<img src="/icons/icon_medicine.png" className="w-4 h-4 inline-block align-middle mr-1"/> Medicine Bottle Sample': '💊 Medicine Bottle Sample',
    
    '<span><img src="/icons/icon_milk.png" className="w-5 h-5 inline-block align-middle"/></span>': '<span>🍼</span>',
    '<span><img src="/icons/icon_grandpa.png" className="w-5 h-5 inline-block align-middle"/></span>': '<span>👴</span>',
    '<span><img src="/icons/icon_sick.png" className="w-5 h-5 inline-block align-middle"/></span>': '<span>🤒</span>',

    '<div><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> Pediatric': '<div>✓ Pediatric',
    '<div><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> SCDF': '<div>✓ SCDF',
    '<div><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> Medisave': '<div>✓ Medisave',
    '<div><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> Dedicated': '<div>✓ Dedicated',
    '<div><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> Direct insurer': '<div>✓ Direct insurer',
    '<div><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> Electronic': '<div>✓ Electronic',

    '<img src="/icons/icon_notes.png" className="w-4 h-4 inline-block align-middle mr-1"/> Teleconsult': '📋 Teleconsult',

    '<><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> Full</>': "'✅ Full'",
    '<><img src="/icons/icon_people.png" className="w-4 h-4 inline-block align-middle mr-1"/> Care Recip.</>': "'👥 Care Recip.'",
    '<><img src="/icons/icon_gentleman.png" className="w-4 h-4 inline-block align-middle mr-1"/> Own</>': "'👤 Own'",
    '<><img src="/icons/icon_stop.png" className="w-4 h-4 inline-block align-middle mr-1"/> None</>': "'❌ None'",

    '<img src="/icons/icon_stop.png" className="w-3 h-3 inline-block align-middle mr-1"/> RED Tier': '🔴 RED Tier',
    '<img src="/icons/icon_stop.png" className="w-4 h-4 inline-block align-middle mr-1"/> RED (995 Emergency / Immediate A&E)': '🔴 RED (995 Emergency / Immediate A&E)',
    
    '<img src="/icons/icon_bulb.png" className="w-4 h-4 inline-block align-middle mr-1"/> <strong>': '💡 <strong>',

    '<img src="/icons/icon_location_pin.png" style="width: 1em; height: 1em; display: inline-block; vertical-align: middle;" /> ${language === "zh" ? "您的当前位置" : "Your Current Location"}': "📍 ${language === 'zh' ? '您的当前位置' : 'Your Current Location'}",
    '<img src="/icons/icon_location_pin.png" style="width: 1em; height: 1em; display: inline-block; vertical-align: middle;" /> ${facility.distance} km': '📍 ${facility.distance} km',
    '<img src="/icons/icon_car.png" style="width: 1em; height: 1em; display: inline-block; vertical-align: middle;" /> ${facility.eta}': '🚗 ${facility.eta}',
    "iconEmoji = '<img src=\"/icons/icon_boy.png\" style=\"width:1.5em;height:1.5em;\"/>'": "iconEmoji = '👶'",
    "iconEmoji = '<img src=\"/icons/icon_hospital.png\" style=\"width:1.5em;height:1.5em;\"/>'": "iconEmoji = '🏥'",
    '<img src="/icons/icon_location_pin.png" className="w-4 h-4 inline-block align-middle mr-1"/> Navigate': '🗺️ Navigate',
    '<img src="/icons/icon_clock.png" className="w-4 h-4 inline-block align-middle mr-1"/> 24-Hour Urgent': '🕒 24-Hour Urgent',
    '<img src="/icons/icon_hospital.png" className="w-4 h-4 inline-block align-middle mr-1"/> Polyclinics / GP': '🏥 Polyclinics / GP',
    '<img src="/icons/icon_boy.png" className="w-4 h-4 inline-block align-middle mr-1"/> Pediatric Emergency (KKH)': '👶 Pediatric Emergency (KKH)',
    '<span><img src="/icons/icon_bulb.png" className="w-4 h-4 inline-block align-middle mr-1"/> Click any marker': '<span>💡 Click any marker',

    '<img src="/icons/icon_hourglass.png" className="w-4 h-4 inline-block align-middle mr-1"/> {elapsed}': '⏳ {elapsed}',
    '<img src="/icons/icon_prescription.png" className="w-4 h-4 inline-block align-middle mr-1"/> {log.notes}': '📝 {log.notes}',
    '<img src="/icons/icon_camera.png" className="w-4 h-4 inline-block align-middle mr-1"/> Dose packaging': '📷 Dose packaging',
    '<img src="/icons/icon_tick.png" className="w-3 h-3 inline-block align-middle mr-1"/> Attached': '✓ Attached',
    
    '<><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> Active Pre-Output Gate</>': "'✓ Active Pre-Output Gate'",
    '<><img src="/icons/icon_tick.png" className="w-4 h-4 inline-block align-middle mr-1"/> Inf/Snr Gate Active</>': "'✓ Inf/Snr Gate Active'",
    '<img src="/icons/icon_boy.png" className="w-4 h-4 inline-block align-middle mr-1"/> Infants §3.1': '👶 Infants §3.1',
    '<img src="/icons/icon_grandpa.png" className="w-4 h-4 inline-block align-middle mr-1"/> Seniors §3.2': '👴 Seniors §3.2',
    '<><img src="/icons/icon_boy.png" className="w-4 h-4 inline-block align-middle mr-1"/> Infant §3.1</>': "'👶 Infant §3.1'",
    '<><img src="/icons/icon_grandpa.png" className="w-4 h-4 inline-block align-middle mr-1"/> Senior §3.2</>': "'👴 Senior §3.2'",
    
    '><img src="/icons/icon_shield.png" className="w-[1em] h-[1em] inline-block align-middle"/> <': '>🛡️<',
    '><img src="/icons/icon_lock.png" className="w-[1em] h-[1em] inline-block align-middle"/> <': '>🔒<',

    "avatar: '/icons/icon_boy.png'": "avatar: '👶'",
    "avatar: '/icons/icon_grandpa.png'": "avatar: '👴'",
    "avatar: '/icons/icon_gentleman.png'": "avatar: '👨'",
    "avatar: '/icons/icon_helper.png'": "avatar: '🧕'",
    "avatar: '/icons/icon_girl.png'": "avatar: '👧🏻'",
    "avatar: newRelationship.toLowerCase().includes('baby') ? '/icons/icon_boy.png' : newRelationship.toLowerCase().includes('child') ? '/icons/icon_girl.png' : '/icons/icon_gentleman.png'": "avatar: newRelationship.toLowerCase().includes('baby') ? '👶' : newRelationship.toLowerCase().includes('child') ? '👧' : '👤'"
}

def replace_in_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    if content != original_content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            replace_in_file(path)

