import glob

files = glob.glob('templates/*.html')

for fname in files:
    with open(fname, 'rb') as f:
        raw = f.read()
    
    try:
        # جرب تقرأها كـ latin-1 وتحولها لـ utf-8
        text = raw.decode('latin-1')
        fixed = text.encode('utf-8')
        
        with open(fname, 'wb') as f:
            f.write(fixed)
        print(f'Fixed: {fname}')
    except Exception as e:
        print(f'Error in {fname}: {e}')

print('Done!')