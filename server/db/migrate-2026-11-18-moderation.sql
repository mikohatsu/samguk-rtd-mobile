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
