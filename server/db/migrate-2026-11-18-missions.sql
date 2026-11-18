-- 운영 DB에 한 번 적용한다(여러 번 돌려도 안전: IF NOT EXISTS). server/db/schema.sql 끝의 미션 블록과 같은 내용이다.
-- 서버는 켤 때 schema.sql 전체를 적용하므로(store/index.js) 서버를 새 코드로 다시 켜기만 해도 만들어진다. 미리 만들어 두고 싶을 때 이 파일을 쓴다:
--   psql "$DATABASE_URL" -f server/db/migrate-2026-11-18-missions.sql
-- 기존 표·열은 바꾸지 않는다(새 표 2개만). 판 보상 원장(currency_ledger)의 reason에 'mission'이 새로 생긴다(열 제약 없음).

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
