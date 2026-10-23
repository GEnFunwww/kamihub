import re
p = 'push-to-github.bat'
s = open(p, encoding='gbk').read()
s2, n = re.subn(r'chcp 65001 >nul\r?\n', '', s, count=1)
open(p, 'w', encoding='gbk').write(s2)
raw = open(p, 'rb').read()
print('removed:', n)
print('has 65001:', b'65001' in raw)
print('first 50:', raw[:50])
print('total:', len(raw))
