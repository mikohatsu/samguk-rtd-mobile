"""배경음 원본(Kevin MacLeod, incompetech.com, CC BY 4.0)을 게임용 mp3로 가공해 bgm/에 넣는다.
사용: python scripts/build-bgm.py <원본 폴더> bgm   (soundfile, numpy 필요)
가공: 44.1kHz 스테레오 · 최대 4분(끝 4초 페이드) · 곡마다 같은 크기로 맞춤 · mp3로 저장."""
import sys, os
import numpy as np, soundfile as sf
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
# 저장 이름: (원본 파일, 쓰임)
TRACKS = {
  'lane_shenyang': 'Shenyang.mp3', 'lane_eastminster': 'Eastminster.mp3', 'lane_tearoots': 'Tea_Roots.mp3',
  'lane_opium': 'Opium.mp3', 'lane_dragon': 'Dragon_and_Toast.mp3',
  'boss_lord': 'Lord_of_the_Land.mp3', 'boss_drums': 'Asian_Drums.mp3',
}
SR, MAXS, TARGET = 44100, 240, 0.09  # 목표 RMS(약 -21dB)
for name, f in TRACKS.items():
    x, sr = sf.read(os.path.join(src, f), always_2d=True)
    if x.shape[1] == 1: x = np.repeat(x, 2, axis=1)
    if sr != SR:
        n = int(len(x) * SR / sr); idx = np.linspace(0, len(x) - 1, n)
        x = np.stack([np.interp(idx, np.arange(len(x)), x[:, c]) for c in range(2)], axis=1)
    # 앞뒤 무음 자르기
    a = np.abs(x).max(axis=1); on = np.where(a > 0.003)[0]; x = x[on[0]: on[-1] + 1]
    if len(x) > MAXS * SR:
        x = x[: MAXS * SR]; fade = 4 * SR; x[-fade:] *= np.linspace(1, 0, fade)[:, None]
    else:
        fade = SR // 2; x[-fade:] *= np.linspace(1, 0, fade)[:, None]
    x[: SR // 10] *= np.linspace(0, 1, SR // 10)[:, None]
    g = TARGET / (np.sqrt(np.mean(x ** 2)) + 1e-9)
    x = x * g
    pk = np.abs(x).max()
    if pk > 0.98: x = x * (0.98 / pk)  # 봉우리가 넘치면 그 곡만 전체를 조금 낮춘다(소리를 찌그러뜨리지 않는다)
    dst = os.path.join(out, name + '.mp3')
    sf.write(dst, x, SR, format='MP3', subtype='MPEG_LAYER_III', compression_level=0.72, bitrate_mode='CONSTANT')
    print(f'{name:18s} {len(x)/SR/60:4.1f}min  {os.path.getsize(dst)/1e6:4.1f}MB')
