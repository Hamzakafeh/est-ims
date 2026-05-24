import glob

files = glob.glob('templates/*.html')

for fname in files:
    with open(fname, 'rb') as f:
        raw = f.read()
    
    try:
        # عكس العملية - قرأها كـ utf-8 وحولها لـ latin-1
        text = raw.decode('utf-8')
        fixed = text.encode('latin-1')
        
        with open(fname, 'wb') as f:
            f.write(fixed)
        print(f'Reverted: {fname}')
    except Exception as e:
        print(f'Error in {fname}: {e}')

print('Done!')