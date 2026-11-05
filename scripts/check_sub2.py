with open('public/assets/index-C5RZm4w3.js', 'r', encoding='utf-8') as f:
    text = f.read()
idx = text.find('h===`subscription`')
print(text[idx-50:idx+150])
