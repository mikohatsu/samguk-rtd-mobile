"""한 번만 쓰는 도구: ui.js(3천 줄)를 src/ui/NN-이름.js 조각으로 나눈다.
조각을 이어 붙이면 원래 파일과 글자 하나 다르지 않다(검사 후 저장)."""
import io, os
src = io.open('ui.js', encoding='utf-8', newline='').read()
lines = src.splitlines(keepends=True)
CUTS = [  # (시작 줄 번호(1부터), 파일 이름, 한 줄 설명)
  (1, '01-setup', '공통 준비: 모듈 참조, 화질 설정, 상태(S)'),
  (60, '02-map', '전장 배경 지도 그리기'),
  (162, '03-unit', '유닛 자세·버프 표시·유닛 한 명 그리기(piece)'),
  (290, '04-fx-text', '전투 이펙트(drawFx), 피해 숫자(drawText), 밤 효과'),
  (539, '05-lane', '라인 화면 그리기(내 라인·동료 라인), 딜미터'),
  (699, '06-boss-vfx', '보스 기술 연출: 장판(drawHazard)·착탄(hazardImpact)·잔상(drawVfx)'),
  (1131, '07-arena', '보스전 화면 그리기(drawArena): 보스·장수·타격감·체력 막대'),
  (1310, '08-pop', '신화·불멸 등장 연출, 보스 승리 연출, 배너'),
  (1775, '09-render-camera', '한 프레임 그리기(render), 화면 배율, 카메라'),
  (1831, '10-input', '입력: 터치·마우스·확대·선택'),
  (2010, '11-actions', '버튼 행동(doAct), 알림(toast)'),
  (2096, '12-panels', '오른쪽 서랍 내용(renderPane): 강화·명사·선택권·설정'),
  (2339, '13-info-timers', '선택 정보 창(renderInfo), 보스 타이머·시너지(renderTimers)'),
  (2506, '14-endstats-xp', '판 끝 통계창(endStats), 경험치 연출'),
  (2569, '15-pad', '보스전 직접 조작: 조이스틱·공격 버튼·스킬 조준·스킬 버튼'),
  (2736, '16-hud', '화면 위 정보 줄, 오른쪽 버튼 열, 전체 창(renderOverlay)'),
  (2898, '17-loop', '메인 루프(tick), 게임 이벤트 처리, 판 시작(begin)'),
  (3004, '18-account', '계정(온라인) 연결'),
  (3047, '19-title', '시작 화면'),
]
# 자를 줄 바로 위의 주석 줄은 아래 조각에 붙인다
starts = []
for ln, name, desc in CUTS:
    i = ln - 1
    while i > 0 and lines[i - 1].lstrip().startswith('//') and lines[i - 1].startswith('  //'): i -= 1
    starts.append(i)
starts[0] = 0
os.makedirs('src/ui', exist_ok=True)
parts = []
for k, (ln, name, desc) in enumerate(CUTS):
    a = starts[k]; b = starts[k + 1] if k + 1 < len(CUTS) else len(lines)
    parts.append((name, desc, ''.join(lines[a:b])))
assert ''.join(p[2] for p in parts) == src, '이어 붙인 결과가 원본과 다름'
for name, desc, text in parts:
    io.open(f'src/ui/{name}.js', 'w', encoding='utf-8', newline='').write(text)
    print(f'{name:20s} {text.count(chr(10)):5d}줄  {desc}')
