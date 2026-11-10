"""효과음 원본(CC0, OpenGameArt)을 게임용으로 가공해 sfxdata.js로 묶는다.
사용: python scripts/build-sfx.py <원본 폴더> sfxdata.js   (soundfile, numpy 필요)
원본 폴더 구조는 받은 zip을 이름대로 푼 것: sword/ clash/ swish/ melee/ rpg/ kenney/
가공: 모노 · 22050Hz · 앞뒤 무음 자르기 · 길이 제한 · 세기 맞춤 · 끝 페이드. 16비트 PCM을 base64로 넣어
브라우저에서 디코딩 없이 바로 AudioBuffer로 만든다(iOS에서 ogg가 안 되는 문제를 피한다)."""
import sys, os, json, base64
import numpy as np, soundfile as sf
src, out = sys.argv[1], sys.argv[2]
SR = 22050
S = 'sword/sword - StarNinjas/sword.%d.ogg'
B = 'rpg/RPG Sound Pack/battle/'
GROUPS = {  # 이름: (파일들, 최대 길이 초)
  'sword':  ([S % 2, S % 3, S % 4, S % 6], 0.40),
  'heavy':  ([S % 8, S % 9, S % 10], 0.55),
  'dagger': (['kenney/OGG/knifeSlice.ogg', 'kenney/OGG/knifeSlice2.ogg', S % 1], 0.35),
  'spear':  (['swish/swishes/swish-2.wav', 'swish/swishes/swish-7.wav', 'swish/swishes/swish-8.wav'], 0.40),
  'blunt':  (['melee/melee sounds/melee sound.wav', 'melee/melee sounds/animal melee sound.wav', 'kenney/OGG/chop.ogg'], 0.40),
  'bow':    ([B + 'swing.wav', B + 'swing2.wav', B + 'swing3.wav'], 0.30),
  'shield': (['rpg/RPG Sound Pack/inventory/metal-small1.wav', 'rpg/RPG Sound Pack/inventory/metal-small3.wav'], 0.35),
  'magic':  ([B + 'magic1.wav'], 0.60),
  'skill':  ([B + 'spell.wav'], 1.20),
  'clash':  (['clash/sword_clash.1.ogg', 'clash/sword_clash.2.ogg', 'clash/sword_clash.4.ogg', 'clash/sword_clash.9.ogg'], 0.35),
}
def load(f, cap):
    x, sr = sf.read(os.path.join(src, f), always_2d=True)
    m = x.mean(axis=1).astype(np.float64)
    if sr != SR:
        n = int(len(m) * SR / sr)
        # 저역 통과(간단 이동 평균) 뒤 선형 보간으로 다시 표본화
        k = max(1, int(round(sr / SR)))
        if k > 1: m = np.convolve(m, np.ones(k) / k, mode='same')
        m = np.interp(np.linspace(0, len(m) - 1, n), np.arange(len(m)), m)
    a = np.abs(m); pk = a.max() or 1
    on = np.where(a > pk * 0.02)[0]
    m = m[max(0, on[0] - 40): on[-1] + 1]
    m = m[: int(cap * SR)]
    m = m / (np.abs(m).max() or 1) * 0.9
    fade = min(len(m), int(0.04 * SR)); m[-fade:] *= np.linspace(1, 0, fade)
    m[: 20] *= np.linspace(0, 1, 20)
    return (m * 32767).astype('<i2')
clips, total = {}, 0
for name, (files, cap) in GROUPS.items():
    arr = []
    for f in files:
        pcm = load(f, cap); total += pcm.nbytes
        arr.append(base64.b64encode(pcm.tobytes()).decode('ascii'))
    clips[name] = arr
    print(name, len(arr))
js = ('// 효과음 데이터(자동 생성: scripts/build-sfx.py). 출처는 CREDITS.md — OpenGameArt CC0\n'
      '// 22050Hz 모노 16비트 PCM(base64). audio.js가 AudioBuffer로 만들어 무기 종류별로 골라 튼다.\n'
      "(function (root) { root.RTD_SFX_DATA = " + json.dumps({'sr': SR, 'clips': clips}) + "; })(typeof window !== 'undefined' ? window : globalThis);\n")
open(out, 'w', encoding='utf-8').write(js)
print('pcm KB', total // 1024, 'js KB', len(js) // 1024)
