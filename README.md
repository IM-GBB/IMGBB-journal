# OKX Journal

개인 선물 매매일지. 날짜를 고르고 **그 날만** OKX에서 읽기 전용으로 가져옵니다.

## 한 번만 할 일

1. [Node.js LTS](https://nodejs.org) 설치
2. 이 폴더에서:

```bash
npm install
cp .env.example .env.local
```

3. `.env.local`에 OKX **Read-only** 키 3개를 넣는다.
4. 실행:

```bash
npm run dev
```

5. 브라우저에서 http://localhost:3000

폰·다른 노트북에서 보려면 이 폴더를 GitHub에 올린 뒤 Vercel로 Deploy 하면 된다. 키는 Vercel Environment Variables에만 넣는다. Trade 권한 키는 쓰지 않는다.

## 규칙

- 표의 날짜 = 청산 시각의 KST 달력일
- 동기화는 선택한 하루만
- 같은 포지션을 다시 가져와도 메모는 유지
- API는 최근 3개월만. 그 이전은 아직 CSV
