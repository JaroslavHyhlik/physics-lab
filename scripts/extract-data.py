"""Extract compact data files for the physics lab from AME2020, NUBASE2020 and HYG v4.1.
Usage: python3 -I extract.py <download dir> <project src/data dir>"""
import csv, json, math, sys

dl, out = sys.argv[1], sys.argv[2]

# ---------- AME2020: measured binding energies ----------
Z, N, BEA, MEX = [], [], [], []
with open(f'{dl}/mass_1.mas20.txt', encoding='ascii', errors='replace') as f:
    lines = f.readlines()
for ln in lines[36:]:
    if len(ln) < 80:
        continue
    try:
        n = int(ln[4:9]); z = int(ln[9:14]); a = int(ln[14:19])
    except ValueError:
        continue
    mex_s = ln[28:42]; bea_s = ln[54:67]
    if '#' in mex_s or '#' in bea_s:
        continue  # estimated from systematics, not measured
    try:
        mex = float(mex_s); bea = float(bea_s)
    except ValueError:
        continue
    if n + z != a:
        continue
    Z.append(z); N.append(n); BEA.append(round(bea, 3)); MEX.append(round(mex, 3))
print('AME measured nuclides:', len(Z))
with open(f'{out}/ame2020.ts', 'w') as f:
    f.write('// Generated from AME2020 (M. Wang et al., Chinese Phys. C 45, 030003, 2021; CC BY 3.0).\n')
    f.write('// Measured nuclides only (values from systematics, marked #, are left out).\n')
    f.write('// Z, N, binding energy per nucleon [keV], atomic mass excess [keV].\n')
    for name, arr in (('Z', Z), ('N', N), ('BEA', BEA), ('MEX', MEX)):
        f.write(f'export const {name} = {json.dumps(arr, separators=(",", ":"))};\n')

# ---------- NUBASE2020: ground states ----------
UNIT = {'ys': 1e-24, 'zs': 1e-21, 'as': 1e-18, 'fs': 1e-15, 'ps': 1e-12, 'ns': 1e-9, 'us': 1e-6, 'ms': 1e-3, 's': 1,
        'm': 60, 'h': 3600, 'd': 86400, 'y': 3.15576e7, 'ky': 3.15576e10, 'My': 3.15576e13, 'Gy': 3.15576e16,
        'Ty': 3.15576e19, 'Py': 3.15576e22, 'Ey': 3.15576e25, 'Zy': 3.15576e28, 'Yy': 3.15576e31}
A2, Z2, LT, MODE = [], [], [], []
with open(f'{dl}/nubase_4.mas20.txt', encoding='ascii', errors='replace') as f:
    for ln in f:
        if ln.startswith('#') or len(ln) < 80:
            continue
        a = int(ln[0:3]); zi = ln[4:8]; z = int(zi[:3]); i = zi[3]
        if i != '0':
            continue
        t = ln[69:78].strip().replace('#', ''); u = ln[78:80].strip()
        if t == 'stbl':
            lt = 99.0
        elif t in ('p-unst', '') or t.startswith('>') or t.startswith('<'):
            # p-unst: unbound; limits: use the number when present
            v = t.lstrip('<>~')
            try:
                lt = math.log10(float(v) * UNIT[u])
            except (ValueError, KeyError):
                lt = -22.0
        else:
            v = t.lstrip('~')
            try:
                lt = math.log10(float(v) * UNIT[u])
            except (ValueError, KeyError):
                continue
        br = ln[119:209].strip()
        parts = [x for x in br.split(';') if x.strip() and not x.strip().startswith('IS')]
        first = parts[0] if parts else ''
        mode = first.split('=')[0].split('~')[0].split('<')[0].split('>')[0].split(' ')[0].strip('?')
        if t == 'stbl':
            mode = 'stable'
        A2.append(a); Z2.append(z); LT.append(round(lt, 3)); MODE.append(mode)
modes = sorted(set(MODE))
print('NUBASE ground states:', len(A2), 'modes:', modes)
with open(f'{out}/nubase2020.ts', 'w') as f:
    f.write('// Generated from NUBASE2020 (F. G. Kondev et al., Chinese Phys. C 45, 030001, 2021; CC BY 3.0).\n')
    f.write('// Ground states: mass number A, proton number Z, log10(half-life / s) (99 = stable), first listed decay mode.\n')
    f.write(f'export const A = {json.dumps(A2, separators=(",", ":"))};\n')
    f.write(f'export const Z = {json.dumps(Z2, separators=(",", ":"))};\n')
    f.write(f'export const LOGT = {json.dumps(LT, separators=(",", ":"))};\n')
    f.write(f'export const MODES = {json.dumps(modes)};\n')
    f.write(f'export const MODE = {json.dumps([modes.index(m) for m in MODE], separators=(",", ":"))};\n')

# ---------- HYG v4.1 ----------
rows = []
with open(f'{dl}/hyg.csv', newline='', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        try:
            dist = float(r['dist']); mag = float(r['mag']); lum = float(r['lum']); ci = float(r['ci'])
        except (ValueError, TypeError):
            continue
        if dist <= 0 or dist >= 100000 or not (-0.4 <= ci <= 2.3):
            continue
        keep = (mag <= 6.0 and dist <= 500) or dist <= 20
        if not keep:
            continue
        name = (r['proper'] or '').strip()
        rows.append((name, round(lum, 5 if lum < 1 else 3), round(ci, 3), round(dist, 2), round(mag, 2), (r['spect'] or '')[:3]))
print('HYG stars:', len(rows), 'named:', sum(1 for r in rows if r[0]))
with open(f'{out}/hyg.ts', 'w') as f:
    f.write('// Generated from the HYG database v4.1 (D. Nash, astronexus/HYG-Database), CC BY-SA 4.0.\n')
    f.write('// This derived subset is therefore also CC BY-SA 4.0. Stars with V ≤ 6.0 within 500 pc, and all stars within 20 pc.\n')
    f.write('// lum = visual luminosity in solar units (from the absolute visual magnitude), ci = B−V colour index, dist in pc, mag = V.\n')
    for name, k in (('NAME', 0), ('LUM', 1), ('CI', 2), ('DIST', 3), ('MAG', 4), ('SPECT', 5)):
        f.write(f'export const {name} = {json.dumps([r[k] for r in rows], separators=(",", ":"), ensure_ascii=False)};\n')
