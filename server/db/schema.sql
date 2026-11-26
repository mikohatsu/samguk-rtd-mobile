-- 삼국 랜덤 디펜스 계정 DB (PostgreSQL 15+)
-- 지금 서버(app.js)가 accounts.json에 두던 것을 표로 나눴다. 시간은 모두 timestamptz(UTC).
-- 개인정보는 최소: 로그인 고유번호(sub)와 닉네임뿐, 이메일·이름은 저장하지 않는다.

CREATE TABLE IF NOT EXISTS accounts (
  id          text PRIMARY KEY,                       -- g/a/G + 12자리 16진수(게스트·애플·구글), 옛 아이디 계정은 영문 소문자
  nick        varchar(12) NOT NULL CHECK (nick NOT LIKE '%<%' AND nick NOT LIKE '%>%'),
  track       text NOT NULL DEFAULT 'mil' CHECK (track IN ('mil', 'civ')),   -- 계급 칭호 갈래: 무관·문관
  xp          integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  games       integer NOT NULL DEFAULT 0,
  wins        integer NOT NULL DEFAULT 0,
  best_round  integer NOT NULL DEFAULT 0,
  coins       integer NOT NULL DEFAULT 0 CHECK (coins >= 0),
  gems        integer NOT NULL DEFAULT 0 CHECK (gems >= 0),
  icon        text NOT NULL DEFAULT 'cav',
  map_skin    text NOT NULL DEFAULT 'spring',
  clr         smallint NOT NULL DEFAULT -1,            -- 깬 가장 높은 난이도(0 쉬움 ~ 3 악몽, -1 없음)
  nmx         smallint NOT NULL DEFAULT -1,            -- 깬 악몽 +N 최고(-1 없음)
  guest_salt  text,                                    -- 게스트: 기기에만 있는 비밀값의 해시
  guest_hash  text,
  pw_salt     text,                                    -- 옛 아이디·비밀번호 계정(새로 만들지 않음)
  pw_hash     text,
  terms_ver   integer,
  agreed_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accounts_xp_idx ON accounts (xp DESC);

-- Apple·Google 로그인 연결(한 계정에 여러 개 가능)
CREATE TABLE IF NOT EXISTS identities (
  provider    text NOT NULL CHECK (provider IN ('apple', 'google')),
  subject     text NOT NULL,
  account_id  text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS identities_account_idx ON identities (account_id);

-- 로그인 토큰: 토큰 원문은 저장하지 않고 SHA-256만 둔다(DB가 새어도 토큰을 쓸 수 없게)
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  text PRIMARY KEY,
  account_id  text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_account_idx ON sessions (account_id);
CREATE INDEX IF NOT EXISTS sessions_exp_idx ON sessions (expires_at);

-- 난이도별 판 수·클리어 수
CREATE TABLE IF NOT EXISTS play_counts (
  account_id  text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  diff        text NOT NULL CHECK (diff IN ('easy', 'normal', 'hard', 'nightmare')),
  plays       integer NOT NULL DEFAULT 0,
  clears      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, diff)
);

-- 산 물건(아이콘·장수 외형·지도). 무료 아이콘은 넣지 않는다.
CREATE TABLE IF NOT EXISTS inventory (
  account_id  text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id     text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, item_id)
);

-- 장수별로 입힌 외형
CREATE TABLE IF NOT EXISTS unit_skins (
  account_id  text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  unit_id     text NOT NULL,
  skin_id     text NOT NULL,
  PRIMARY KEY (account_id, unit_id)
);

-- 재화 변동 기록: 동전·보석이 바뀔 때마다 한 줄(얼마, 왜, 바뀐 뒤 잔액). 결제·환불 추적용.
CREATE TABLE IF NOT EXISTS currency_ledger (
  id            bigserial PRIMARY KEY,
  account_id    text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  currency      text NOT NULL CHECK (currency IN ('coin', 'gem')),
  delta         integer NOT NULL,
  balance_after integer NOT NULL,
  reason        text NOT NULL,          -- result / buy / iap / refund / admin
  ref           text,                   -- 판 열쇠·물건 id·결제 거래 번호
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_account_idx ON currency_ledger (account_id, created_at DESC);

-- 앱스토어 결제(보석 묶음). 거래 번호가 같으면 두 번 지급하지 않는다.
CREATE TABLE IF NOT EXISTS purchases (
  transaction_id text PRIMARY KEY,      -- App Store originalTransactionId / transactionId
  account_id     text REFERENCES accounts(id) ON DELETE SET NULL,
  product_id     text NOT NULL,
  gems           integer NOT NULL,
  status         text NOT NULL DEFAULT 'granted' CHECK (status IN ('granted', 'refunded')),
  purchased_at   timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
-- 2026-11-24(SEC-101·105): 결제 환경(Production / Sandbox / Test), 이 거래로 새로 넣은 열쇠(JSON 배열, 환불 때 이것만 뺀다), 환불 처리 시각
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS environment text;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS items text;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
CREATE INDEX IF NOT EXISTS purchases_account_idx ON purchases (account_id);

-- 판 기록(전적). 온라인 판은 result_key로 한 번만 받는다.
CREATE TABLE IF NOT EXISTS games (
  id          bigserial PRIMARY KEY,
  account_id  text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  played_at   timestamptz NOT NULL DEFAULT now(),
  diff        text NOT NULL,
  mut         smallint NOT NULL DEFAULT 0,
  round       smallint NOT NULL DEFAULT 0,
  win         boolean NOT NULL,
  time_sec    integer NOT NULL DEFAULT 0,
  online      boolean NOT NULL,
  mode        text NOT NULL DEFAULT '',
  result_key  text,                     -- 온라인 판 열쇠(중복 보고 막기)
  xp_gained   integer NOT NULL DEFAULT 0,
  coins_gained integer NOT NULL DEFAULT 0,
  myth        jsonb NOT NULL DEFAULT '{}',   -- 신화 이상 소환 { 장수id: 횟수 }
  stats       jsonb NOT NULL DEFAULT '{}'    -- 판 끝 통계(처치·중간보스·금화…)
);
CREATE INDEX IF NOT EXISTS games_account_idx ON games (account_id, played_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS games_result_key_idx ON games (account_id, result_key);

-- 불멸 장수 소환 누적(장수별 랭킹)
CREATE TABLE IF NOT EXISTS immortal_counts (
  account_id  text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  unit_id     text NOT NULL,
  n           integer NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, unit_id)
);
CREATE INDEX IF NOT EXISTS immortal_rank_idx ON immortal_counts (unit_id, n DESC);

-- 난이도별 가장 빠른 클리어(파티 한 줄). 탈퇴한 사람은 이름만 남는다.
-- diff: 온라인 협동(2인 이상)은 난이도 이름, 솔로(혼자·AI 동맹)는 'solo:난이도'이고 party_key는 'solo:계정ID'(계정마다 한 줄).
CREATE TABLE IF NOT EXISTS clear_records (
  id          bigserial PRIMARY KEY,
  diff        text NOT NULL,
  party_key   text NOT NULL,
  time_sec    integer NOT NULL,
  mut         smallint NOT NULL DEFAULT 0,
  cleared_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diff, party_key)
);
CREATE INDEX IF NOT EXISTS clear_rank_idx ON clear_records (diff, time_sec);
CREATE TABLE IF NOT EXISTS clear_members (
  record_id   bigint NOT NULL REFERENCES clear_records(id) ON DELETE CASCADE,
  slot        smallint NOT NULL,
  account_id  text REFERENCES accounts(id) ON DELETE SET NULL,
  nick        varchar(12) NOT NULL,
  icon        text NOT NULL,
  PRIMARY KEY (record_id, slot)
);

-- 채팅 신고(운영자가 확인)
CREATE TABLE IF NOT EXISTS reports (
  id          bigserial PRIMARY KEY,
  reporter_id text REFERENCES accounts(id) ON DELETE SET NULL,
  target_id   text REFERENCES accounts(id) ON DELETE SET NULL,
  nick        varchar(12),
  text        varchar(120),
  room        varchar(12),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- 운영 제재(채팅 금지·계정 정지) — 2026-11-18 ----------
-- 여러 번 돌려도 안전하다(IF NOT EXISTS). 운영 DB에는 db/migrate-2026-11-18-moderation.sql(같은 내용)을 먼저 적용한다.
-- muted_until: 그때까지 로비·방 채팅을 보낼 수 없다(게임은 된다). banned_until: 그때까지 로그인·API·WebSocket을 모두 거절한다.
-- 영구는 먼 미래 날짜(9999-12-31). NULL이거나 지난 시각이면 제재 없음.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS muted_until  timestamptz;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS mute_reason  text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS banned_until timestamptz;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ban_reason   text;
-- 서버가 30초마다 '지금 걸려 있는 제재'를 읽는다: 제재가 있는 줄만 담는 작은 색인
CREATE INDEX IF NOT EXISTS accounts_muted_idx  ON accounts (muted_until)  WHERE muted_until  IS NOT NULL;
CREATE INDEX IF NOT EXISTS accounts_banned_idx ON accounts (banned_until) WHERE banned_until IS NOT NULL;
-- 제재 이력(누가 언제 무엇을). 계정을 지워도 이력은 남는다(계정 ID만, 닉네임은 두지 않는다).
CREATE TABLE IF NOT EXISTS mod_log (
  id          bigserial PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  actor       text NOT NULL,                      -- 명령을 돌린 사람(서버 로그인 이름)
  action      text NOT NULL CHECK (action IN ('mute', 'unmute', 'ban', 'unban')),
  account_id  text NOT NULL,
  until       timestamptz,
  reason      text
);
CREATE INDEX IF NOT EXISTS mod_log_account_idx ON mod_log (account_id, id DESC);
-- 신고 열람·신고 몰림 확인(대상별, 최근 것부터)
CREATE INDEX IF NOT EXISTS reports_target_idx ON reports (target_id, created_at DESC);

-- ---------- 미션(2026-11-18): 일일 미션 진행·수령, 난이도 첫 클리어 보상 수령 ----------
-- 일일 미션: 계정·날(일본 시간 날짜 'YYYY-MM-DD')·미션마다 한 줄. n = 그날 채운 횟수, claimed_at = 보상을 받은 시각(안 받았으면 NULL).
-- 지난 날의 줄은 서버가 진행을 적을 때 지운다.
CREATE TABLE IF NOT EXISTS mission_daily (
  account_id  text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  day         text NOT NULL,
  mission_id  text NOT NULL,              -- d_play / d_r30 / d_coop
  n           integer NOT NULL DEFAULT 0,
  claimed_at  timestamptz,
  PRIMARY KEY (account_id, day, mission_id)
);
-- 한 번만 받는 보상(난이도 첫 클리어): 받은 것만 한 줄. 조건(클리어 여부)은 accounts.clr·nmx, play_counts.clears로 판단한다.
CREATE TABLE IF NOT EXISTS mission_claims (
  account_id  text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  mission_id  text NOT NULL,              -- f_normal / f_hard / f_nightmare / f_nm1 ~ f_nm5
  claimed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, mission_id)
);

-- ---------- Sign in with Apple refresh token — 2026-11-20 ----------
-- 계정을 지울 때 Apple 연결을 끊으려고(App Store 지침 5.1.1(v), POST appleid.apple.com/auth/revoke) 로그인 때 받은 refresh token을 둔다.
-- 계정이 만들어지기 전에 올 수 있어 accounts와 묶지 않는다(열쇠 = Apple 이용자 식별자 sub). 계정 삭제 때 철회한 뒤 지운다.
-- 연결된 계정 없이 하루가 지난 줄(가입을 끝내지 않음, 철회 실패)은 서버가 철회를 다시 시도하고 지운다.
-- 운영 DB에는 db/migrate-2026-11-20-apple-tokens.sql(같은 내용)을 적용한다(서버가 켜질 때 schema.sql도 적용하므로 재시작만으로도 된다).
CREATE TABLE IF NOT EXISTS apple_tokens (
  subject       text PRIMARY KEY,
  refresh_token text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

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
