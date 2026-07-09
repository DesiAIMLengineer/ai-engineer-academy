# AI Engineer Academy

A self-hosted, zero-cost learning platform for going from 0 coding knowledge to AI Engineer in 6 months (26 weeks).

## What's inside

- **Syllabus** — 26 weeks, 137 checklist items, each with a time estimate and free resources
- **Progress tracking** — check off tasks, see % complete per week and overall
- **Weekly quizzes** — 5 auto-graded questions per week, retakeable, best score saved
- **Time tracker** — start/stop timer + manual log, daily/weekly totals, day-streak counter
- **Doubt-clearing chatbot** — runs a small AI model **entirely inside the browser tab** via [WebLLM](https://webllm.mlc.ai/). No API key, no per-token cost, no external server call, no token limits — the model downloads once (~600MB–1.5GB depending on choice) and is cached by the browser after that.
- **Accounts** — simple email/password login, multiple learners can use the same install

Nothing here calls a paid API. The backend is Node + SQLite (a single local file, `academy.db` — no external database to pay for or manage).

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer
- A Chromium-based browser (Chrome or Edge, recent version) for the chatbot page — it needs [WebGPU](https://caniuse.com/webgpu). The rest of the site works in any modern browser.

## Setup

```bash
cd backend
npm install
npm start
```

Then open **http://localhost:4000** in your browser. Create an account (any email/password, it's stored only in your local `academy.db`) and start with Week 1.

To let someone else use it from another device on the same network, replace `localhost` with your machine's local IP address, e.g. `http://192.168.1.23:4000`.

## Project structure

```
ai-engineer-academy/
├── backend/
│   ├── server.js       # Express API: auth, progress, quizzes, timer, stats
│   ├── db.js            # SQLite schema (users, progress, quiz_attempts, time_logs)
│   ├── data/curriculum.js  # the full 26-week syllabus, checklist, resources, quiz questions
│   └── package.json
└── public/               # frontend (served by the backend, no separate build step)
    ├── index.html         # login / register
    ├── dashboard.html      # journey overview, streak, this week's tasks
    ├── syllabus.html        # full checklist + resources, week by week
    ├── quiz.html              # weekly quizzes
    ├── tracker.html            # time tracker
    └── chatbot.html              # in-browser doubt-clearing chatbot (WebLLM)
```

## Notes on the chatbot models

Three free local models are offered on the Ask a Doubt page, picked for running well on an ordinary laptop:

| Model | Size (download) | Best for |
|---|---|---|
| Llama 3.2 1B Instruct | ~600MB | Fastest, works on lower-RAM machines |
| Llama 3.2 3B Instruct | ~1.7GB | Better reasoning, needs 6GB+ RAM |
| Phi 3.5 mini Instruct | ~2.2GB | Strongest at step-by-step explanations |

If a machine can't run WebGPU or has limited RAM, stick with the 1B model.

## Customizing

- Edit `backend/data/curriculum.js` to change weeks, checklist items, resources, or quiz questions — the whole site reads from this one file.
- Change the JWT_SECRET environment variable before using this for more than personal/local use: `JWT_SECRET=something-long-and-random npm start`.
