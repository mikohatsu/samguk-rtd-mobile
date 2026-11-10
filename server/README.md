# 삼국지 랜덤 디펜스 협동 서버

게임 파일을 제공하고 WebSocket으로 방 메시지를 중계합니다. 게임 판정은 방장 브라우저가 맡습니다.

## 내 컴퓨터에서 실행

```bash
cd server
npm install
npm start
```

`http://localhost:8200`을 열고 `방 협동`을 고릅니다. 같은 공유기의 다른 사람은 `http://내-컴퓨터-IP:8200`으로 들어옵니다.

## 인터넷에 올리기

Node.js 웹 서비스를 지원하고 WebSocket이 되는 호스팅이면 됩니다.

- 시작 명령: `cd server && npm install && npm start`
- 포트: 호스팅이 주는 `PORT` 환경 변수를 그대로 씁니다.
- 프로젝트 폴더 전체를 올려야 합니다. 서버가 위 폴더의 게임 파일을 읽습니다.

배포된 주소를 친구에게 보내면 로그인 없이 방 코드로 들어올 수 있습니다.

## 현재 배포

- 주소: `http://34.64.107.109:8200`
- GCP 프로젝트 `mikoserver-513016`, 인스턴스 `rtd-server` (서울 `asia-northeast3-a`, e2-micro)
- 방화벽 규칙 `rtd-game-8200`이 TCP 8200을 엽니다.
- 서버는 systemd 서비스 `rtd`로 돌고 재부팅하면 자동으로 켜집니다. 파일 위치는 `/opt/rtd`입니다.

게임을 고친 뒤 다시 올릴 때는 프로젝트 폴더에서:

```bash
tar -czf rtd.tar.gz --exclude=server/node_modules samguk-rtd.html theme-samguk.js engine.js art.js audio.js net.js ui.js server
gcloud.cmd compute scp rtd.tar.gz rtd-server:/tmp/rtd.tar.gz --project mikoserver-513016 --zone asia-northeast3-a
gcloud.cmd compute ssh rtd-server --project mikoserver-513016 --zone asia-northeast3-a --command "sudo tar -xzf /tmp/rtd.tar.gz -C /opt/rtd && sudo systemctl restart rtd"
```

서버를 지우려면 인스턴스 `rtd-server`와 방화벽 규칙 `rtd-game-8200`을 삭제합니다.

## 제한

- 방 하나에 최대 5명입니다.
- 방장이 나가면 남은 사람 중 한 명이 방장을 이어받습니다.
- 클로드 아티팩트 페이지는 외부 WebSocket 접속이 막혀 있어 이 서버에 연결되지 않습니다. 서버 주소로 직접 들어와야 합니다.
