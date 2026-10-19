import json

with open('dashboard_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

js_content = "window.DASHBOARD_DATA = " + json.dumps(data, ensure_ascii=False) + ";"

with open('data.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print("data.js successfully generated! Size:", len(js_content))
