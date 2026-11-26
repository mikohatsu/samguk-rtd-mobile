-- ---------- 판 결과 보안 보강 — 2026-11-26 (secure-a) ----------
-- 여러 번 돌려도 안전하다(IF NOT EXISTS). 서버가 켜질 때 schema.sql(같은 내용)도 적용하므로 재시작만으로도 된다.
-- 운영 DB에 먼저 적용하려면: psql "$DATABASE_URL" -f server/db/migrate-2026-11-26-results.sql
--
-- accounts에 더하는 열
--   save_tk / save_tk_at      : 이어하기 칸. 지금 유효한 이어하기 표 번호(혼자 오프라인 새 판이 바꾼다, 결과를 받으면 비운다). 기한 없음.
--   last_reward_at            : 마지막으로 판 보상을 준 시각(겹치는 판 판정. 예전에는 서버 메모리에만 있어 다시 켜면 사라졌다)
--   reward_day / _xp / _coins : 오늘(일본 시간 날짜 'YYYY-MM-DD') 판 보상으로 준 경험치·동전(하루 상한. 예전에는 메모리에만)
--   coin_debt                 : 회수한 동전 가운데 잔액이 모자라 못 뺀 몫. 다음 동전 수입에서 먼저 갚는다(잔액은 음수로 두지 않는다)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS save_tk          text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS save_tk_at       timestamptz;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_reward_at   timestamptz;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS reward_day       text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS reward_day_xp    integer NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS reward_day_coins integer NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS coin_debt        integer NOT NULL DEFAULT 0;

-- 판 결과 한 줄(검증·회수용). 전적(games)은 계정마다 최근 200판만 남지만 이 표는 지우지 않는다(회수할 때 무엇을 줬는지 알아야 한다).
-- id = 결과 열쇠 'tk-<표 번호>'(games.result_key와 같다). 재연산 작업자가 verify를 ok(확인)·bad(회수)로 바꾼다.
-- verify: pending(재연산 대기) / ok / bad(회수됨) / norec(입력 기록이 없어 재연산 못 함 — 보상은 그대로, 운영자가 회수할 수는 있다)
--         / legacy(업데이트 전에 받은 표 — 재연산 없이 받아 두고 회수하지 않는다, 2026-11-26 사용자 결정)
CREATE TABLE IF NOT EXISTS results (
  id           text PRIMARY KEY,
  account_id   text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  issued_at    timestamptz NOT NULL,              -- 표 발급 시각(서버 시계)
  reported_at  timestamptz NOT NULL DEFAULT now(),
  kind         text NOT NULL,                     -- save(이어하기 칸 표) / live(협동·AI 동맹·온라인 혼자) / legacy(예전 표)
  online       boolean NOT NULL DEFAULT false,
  diff         text NOT NULL,                     -- 쳐 준 난이도(진행·보상용, 깬 난이도 + 1까지)
  played       text NOT NULL,                     -- 실제로 고른 난이도(전적 표시)
  mut          smallint NOT NULL DEFAULT 0,
  round        smallint NOT NULL DEFAULT 0,
  win          boolean NOT NULL DEFAULT false,
  time_sec     integer NOT NULL DEFAULT 0,
  seats        smallint NOT NULL DEFAULT 0,
  seed         integer,                           -- 서버가 표에 넣은 씨앗(예전 표는 NULL)
  room         text,
  xp           integer NOT NULL DEFAULT 0,        -- 하루 상한을 적용해 실제로 준 경험치
  coins        integer NOT NULL DEFAULT 0,        -- 실제로 준 판 동전
  prev_clr     smallint,                          -- 이 판을 받기 전 진행(회수 때 되돌릴 값)
  prev_nmx     smallint,
  prev_best    integer,
  clear_board  text,                              -- 순위 줄(clear_records.diff / party_key), 이 판의 시간, 이 판 앞의 그 줄 시간
  clear_party  text,
  clear_time   integer,
  clear_mut    smallint,
  clear_prev   integer,
  imm          jsonb NOT NULL DEFAULT '{}',       -- 이 판에서 더한 불멸 소환 수
  grants       jsonb NOT NULL DEFAULT '{}',       -- 이 판 때문에 준 한 번짜리 보상 { ach: [{id, coins}], ranks: [{id, rank, coins}] }
  verify       text NOT NULL DEFAULT 'pending' CHECK (verify IN ('pending', 'ok', 'bad', 'norec', 'legacy')),
  verified_at  timestamptz,
  verify_note  text,
  revoked_at   timestamptz,
  revoke_coins integer NOT NULL DEFAULT 0,        -- 회수로 되돌린 동전 합(알림용)
  notified     boolean NOT NULL DEFAULT false     -- 회수 알림을 이용자에게 보였는지
);
CREATE INDEX IF NOT EXISTS results_account_idx ON results (account_id, reported_at);
CREATE INDEX IF NOT EXISTS results_verify_idx ON results (verify, reported_at);
CREATE INDEX IF NOT EXISTS results_clear_idx ON results (clear_board, clear_party);
-- 2026-11-26 사용자 결정 "검증된 거만 올리게 해줘 랭킹은": 순위(최단 클리어·불멸)는 verify = ok가 된 판만, confirmResult 때 넣는다. ranked = 그 판을 순위에 넣었는지(회수 때 되돌릴지)
ALTER TABLE results ADD COLUMN IF NOT EXISTS ranked boolean NOT NULL DEFAULT false;
-- 레벨 순위 값(rank_xp): 검증 ok 판의 경험치 + 미션 경험치 + 이 업데이트 전 경험치. 판 경험치는 판 끝에 xp에 바로 들어가고, rank_xp에는 확정(confirmResult ok) 때 더한다.
-- 처음 적용 때 기존 계정은 xp로 채운다(예전 판은 그대로). 새 계정은 서버가 0으로 만든다. 서버가 켜질 때마다 돌아도 NULL인 줄만 채운다.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS rank_xp integer;
UPDATE accounts SET rank_xp = xp WHERE rank_xp IS NULL;
CREATE INDEX IF NOT EXISTS accounts_rank_xp_idx ON accounts (rank_xp DESC);
