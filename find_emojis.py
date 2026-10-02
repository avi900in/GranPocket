import os
import re

emojis = {
    "👧🏻": "icon_girl.png",
    "🛡️": "icon_shield.png",
    "🛡": "icon_shield.png",
    "🔒": "icon_lock.png",
    "🧕": "icon_helper.png",
    "👨": "icon_gentleman.png",
    "🏡": "icon_household.png",
    "💊": "icon_medicine.png",
    "⚠": "icon_warning.png",
    "👴": "icon_grandpa.png",
    "👵🏻": "icon_grandpa.png",  # wait, grandma/grandpa?
    "❌": "icon_stop.png",
    "👌": "icon_perfect.png",
    "🌟": "icon_star.png",
    "🍼": "icon_milk.png",
    "🤒": "icon_sick.png",
    "📋": "icon_notes.png",
    "✓": "icon_tick.png",
    "🔴": "icon_stop.png",
    "👥": "icon_people.png",
    "💡": "icon_bulb.png",
    "🚗": "icon_car.png",
    "🗺": "icon_location_pin.png",
    "🏥": "icon_hospital.png",
    "🕒": "icon_clock.png",
    "📍": "icon_location_pin.png",
    "⏳": "icon_hourglass.png",
    "📝": "icon_prescription.png",
    "📷": "icon_camera.png",
    "👶": "icon_boy.png",  # default avatar in schedulerService?
    "👩🏻": "icon_helper.png",
    "👤": "icon_gentleman.png"
}

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                for i, line in enumerate(lines):
                    for emoji, icon in emojis.items():
                        if emoji in line:
                            print(f"{path}:{i+1}:{emoji}:{line.strip()}")
