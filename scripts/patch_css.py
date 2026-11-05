import os

css_addition = """
@media (min-width: 768px) {
  nav.fixed.bottom-0 {
    display: none !important;
  }
  aside.hidden.md\\:flex {
    display: flex !important;
  }
  main {
    margin-right: 16rem !important;
    max-width: 56rem !important;
    margin-left: auto !important;
    padding-left: 2rem !important;
    padding-right: 2rem !important;
  }
}

@media (max-width: 767.98px) {
  aside.hidden.md\\:flex {
    display: none !important;
  }
  nav.fixed.bottom-0 {
    display: block !important;
  }
}
"""

for path in ["public/assets/index-app.css", "dist/assets/index-app.css"]:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        if "@media (min-width: 768px)" not in content:
            content += css_addition
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"Added responsive CSS rules to {path}")
        else:
            print(f"CSS rules already present in {path}")
print("CSS update complete.")
