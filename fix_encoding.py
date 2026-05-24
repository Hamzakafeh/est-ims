import glob

files = glob.glob('*.html')

for fname in files:
    with open(fname, 'rb') as f:
        raw = f.read()
    
    # إعادة تفسير الـ bytes كـ latin-1 ثم encode كـ utf-8
    fixed = raw.decode('latin-1').encode('utf-8').decode('utf-8')
    
    # تأكد إن في تغيير فعلي
    original = raw.decode('utf-8', errors='replace')
    if fixed != original:
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(fixed)
        print(f'Fixed: {fname}')
    else:
        print(f'No change: {fname}')

print('Done!')