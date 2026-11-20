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
