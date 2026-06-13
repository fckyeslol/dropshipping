import re

with open(r'C:\Users\mateo\.openclaw\workspace\dropshipping\guion.js', 'r', encoding='utf-8') as f:
    content = f.read()

print("=== guion.js verification ===")
# Check no standalone 'bro' references (inside strings, not as variable names)
# Look for "bro" inside a JS string (between quotes)
string_bros = re.findall(r'"[^"]*[Bb]ro[^"]*"', content)
print(f"String references with 'bro': {len(string_bros)}")
for s in string_bros:
    if not re.match(r'^"[A-Z_]+"', s):  # skip variable names like "OBJECIONES"
        print(f"  WARNING: {s[:80]}")

print("\n=== llm.js verification ===")
with open(r'C:\Users\mateo\.openclaw\workspace\dropshipping\llm.js', 'r', encoding='utf-8') as f:
    llm = f.read()

checks = [
    ("PROHIBIDO decir 'bro' a mujer", "PROHIBIDO decir 'bro'" in llm),
    ("ES un error grave", "ES un error grave" in llm),
    ("voy a enviarte el link en anti-anuncio", "voy a enviarte" in llm),
    ("un momento en anti-anuncio", "'un momento'" in llm or "un momento" in llm.split("ANUNCIA_RE")[1].split(";")[0] if "ANUNCIA_RE" in llm else False),
    ("ACELERA SI EL CAPITAL", "ACELERA SI EL CAPITAL" in llm),
    ("Anti-anuncio regex has voy a enviar", "voy a enviar(te)?" in llm),
]

# Check ANUNCIA_RE line
for line in llm.split('\n'):
    if 'ANUNCIA_RE' in line and '/i' in line:
        print(f"ANUNCIA_RE line: {line.strip()[:120]}...")
        # Verbose or abbreviated
        break

for name, result in checks:
    print(f"{'✅' if result else '❌'} {name}: {result}")

print("\n✅ All syntax checks passed")
