with open('public/assets/index-C5RZm4w3.js', 'r', encoding='utf-8') as f:
    text = f.read()
idx = 433206
start = max(0, idx - 100)
end = min(len(text), idx + 100)
print("Context around 433206:")
print(text[start:end])
