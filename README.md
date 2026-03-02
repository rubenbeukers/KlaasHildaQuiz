# QuizBlast ⚡

A real-time multiplayer Kahoot-style quiz application supporting up to 100 simultaneous players.

## Features

- **Host view** – create a game, show QR code + PIN, manage pacing, see live leaderboard
- **Player view** – mobile-first, 4 coloured answer buttons, speed-based scoring
- **Real-time** via Socket.io (WebSockets)
- **Scoring** – up to 1000 pts per question based on speed + streak bonuses (+100/consecutive correct)
- **10-question Tech Trivia** quiz included out of the box
- Animated leaderboard, podium finish, countdown timer

---

## Project Structure

```
quiz-app/
├── server/          Node.js + Express + Socket.io backend
│   ├── index.js
│   ├── gameManager.js
│   └── quizData.js
├── client/          React + Tailwind CSS frontend
│   └── src/
│       ├── pages/
│       │   ├── Home.jsx
│       │   ├── HostView.jsx   ← projector/big-screen view
│       │   └── PlayerView.jsx ← mobile player view
│       └── components/
│           ├── Timer.jsx
│           └── Leaderboard.jsx
└── README.md
```

---

## Quick Start (local)

### 1. Install & run the server

```bash
cd quiz-app/server
npm install
npm start          # runs on http://localhost:4000
# or for auto-reload during development:
npm run dev
```

### 2. Install & run the client

```bash
cd quiz-app/client
npm install
npm start          # runs on http://localhost:3000
```

### 3. Play

| Role   | URL                          |
|--------|------------------------------|
| Host   | http://localhost:3000/host   |
| Player | http://localhost:3000/join   |

- Host opens `/host` → game PIN + QR code appear
- Players open `/join` or scan QR code → enter nickname
- Host clicks **Start Game** when ready
- After each question the host clicks **Next Question**
- Final podium shown after the last question

---

## Using on a local network (phones)

To let phones on your Wi-Fi network participate:

1. Find your machine's local IP (e.g. `192.168.1.42`)

2. Create `quiz-app/client/.env`:
   ```
   VITE_SERVER_URL=http://192.168.1.42:4000
   ```

3. The server already listens on `0.0.0.0`, so phones can reach it.
   The QR code URL is built from the browser's hostname automatically,
   so it will point to the correct IP when you open the host view from
   `http://192.168.1.42:3000/host`.

---

## Socket.io Events

| Event            | Direction        | Description                              |
|------------------|------------------|------------------------------------------|
| `host:create`    | Client → Server  | Host requests a new game                 |
| `player:join`    | Client → Server  | Player joins with PIN + nickname         |
| `player:joined`  | Server → Host    | Updated player list                      |
| `game:start`     | Host → Server    | Start the game                           |
| `game:started`   | Server → All     | Game is beginning                        |
| `question:show`  | Server → All     | Send current question data               |
| `answer:submit`  | Player → Server  | Player submits answer index              |
| `answer:count`   | Server → Host    | Live count of answers received           |
| `question:end`   | Server → All     | Reveal correct answer + results          |
| `next:question`  | Host → Server    | Advance to next question                 |
| `game:end`       | Server → All     | Final leaderboard                        |

---

## Scoring

- **Speed bonus**: `floor(1000 × timeRemaining / timeLimit)` — faster = more points
- **Streak bonus**: +100 pts for each consecutive correct answer (e.g. 3 in a row = +200)
- **Wrong answer**: 0 points, streak resets

---

## Tech Stack

| Layer      | Technology              |
|------------|-------------------------|
| Frontend   | React 18 + React Router |
| Styling    | Tailwind CSS 3          |
| Build tool | Vite 4                  |
| Backend    | Node.js + Express 4     |
| Real-time  | Socket.io 4             |
| QR Code    | qrcode npm package      |
| Storage    | In-memory (no DB)       |
