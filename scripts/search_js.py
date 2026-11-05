with open('public/assets/index-C5RZm4w3.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'h===', text)]
print("h=== matches:", len(matches))
for m in matches:
    print(repr(text[m-30:m+50]))
