# CLAUDE.md — RedirectHub Project Instructions

## What This Project Is
A URL shortening and analytics service built to learn backend engineering.
Stack: Node.js, Express, PostgreSQL, Redis, Docker, k6.
Developer: CS student, comfortable with Python/C++/SQL basics.
New to: JavaScript, Node.js, Express, PostgreSQL from an app, Redis, Docker, REST APIs.

## How to Work With Me

### Before Making Any Change
- Do not make changes unless you are at least 95% confident your plan
  is correct and complete. If you are not 95% confident, stop and ask
  a clarifying question instead of guessing.
- State what you are about to do in one sentence before doing it.
- If a task is ambiguous, ask ONE clarifying question. Do not proceed
  on assumptions.

### Code Style Rules
- Simple and readable over clever. No abstractions until they are needed.
- No new dependencies without explaining why the dependency exists.
- No TypeScript. Plain JavaScript (CommonJS, require/module.exports).
- Every new file gets a 2-3 line comment at the top explaining what it does.
- Keep functions short. If a function is over 30 lines, flag it and ask.

### What You Are Allowed To Do Without Asking
- Create new files if the path and purpose are explicit in the prompt.
- Add comments to existing code explaining what a block does.
- Run read-only commands (ls, cat, node --version, psql --version).
- Install npm packages that are explicitly named in the prompt.

### What You Must Never Do Without Explicit Permission
- Delete or overwrite an existing file.
- Rename files or folders.
- Change the database schema once it has been set up.
- Add features not mentioned in the current phase prompt.
- Refactor working code unless refactoring is the stated task.
- Run destructive database commands (DROP, DELETE, TRUNCATE).

## Project Structure
```
redirecthub/
├── src/
│   ├── index.js          # Entry point. Starts the Express server.
│   ├── db.js             # PostgreSQL connection pool and query wrapper.
│   ├── redis.js          # Redis client setup.
│   ├── routes/
│   │   ├── shorten.js    # POST /shorten
│   │   └── redirect.js   # GET /:code
│   ├── middleware/
│   │   └── rateLimit.js  # Sliding window rate limiter.
│   └── utils/
│       └── base62.js     # Base62 encode/decode logic.
├── tests/
│   └── base62.test.js    # Unit tests for Base62.
├── docker-compose.yml    # Postgres + Redis + App services.
├── .env.example          # Template. Never commit .env.
├── .env                  # Local config. Already in .gitignore.
└── package.json
```

## Environment Variables (from .env)
```
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/redirecthub
REDIS_URL=redis://localhost:6379
```

## Current Build Phases
- Phase 0: Environment setup         [DONE when PostgreSQL + Docker verified]
- Phase 1: Express server basics     []
- Phase 2: PostgreSQL from Node      []
- Phase 3: Base62 + core API         []
- Phase 4: Unit tests                []
- Phase 5: Redis caching             []
- Phase 6: Async analytics           []
- Phase 7: Rate limiting             []
- Phase 8: Docker Compose            []
- Phase 9: k6 load testing           []

Update the phase status above as phases complete.

## After Every Task
1. Run the verification command specified in the prompt.
2. Report the actual output, not a summary of it.
3. If the output shows an error, stop and report it in full before
   trying to fix anything.

## Learning Prompt Generation

After any phase is complete and verified working, if the developer 
asks "generate learning prompt for phase [N]", do this:

### Step 1: Identify What Changed
- List all NEW files created this phase
- List all MODIFIED files (existing files with edits)
- Note which files stayed unchanged

### Step 2: Build the ChatGPT Prompt Structure
Generate a ChatGPT prompt with this exact format:

---
I am a CS student with Python and C++ experience. I just built 
Phase [N] of RedirectHub. Teach me what I built from scratch.

**What was built this phase:** [one sentence summary]

**New concepts introduced:** [bullet list]

**Files to understand** (in order):
[dependency order - imports FROM first, then what imports it]

**Teach me:**
- What each concept is (plain English, no code)
- Why it exists and what problem it solves
- Python or real-world analogy for each
- One concrete example
- One question to check I understood

[Then show the code blocks with filenames]

**Then explain this code line by line:**
[code block 1]
[code block 2]
[etc]

**Finally ask me:**
Q1: [question about concept 1]
Q2: [question about concept 2]
Q3: [question about why we made this choice]

---

### Step 3: Attach Code in Correct Order
- NEW FILES: attach entire file (100% of content)
- MODIFIED FILES: attach only the changed sections plus 2 lines of context before/after
- UNCHANGED FILES: do not attach
- Always show filename in markdown code block

### Step 4: Code Order Rule
Attach code in DEPENDENCY order:
- If src/index.js imports from src/db.js, show db.js first
- If src/db.js imports from src/utils/base62.js, show base62.js first
- Then show db.js
- Then show index.js modifications

### Step 5: Example Format
For Phase 2 (creates db.js, modifies index.js):

---LEARNING PROMPT FOR PHASE 2---
I am a CS student... [full ChatGPT prompt above]

---CODE BLOCKS---

**File: src/db.js (NEW)**
```javascript
[entire src/db.js file]
```

**File: src/index.js (MODIFIED)**
```javascript
// Only the new lines added to src/index.js:
const db = require('./db')

// ... existing code unchanged ...

app.listen(PORT, async () => {
  console.log('Server running on port ' + PORT)
  await db.testConnection()
})
```

---

### Step 6: Never Do This
- Do not include node_modules, .env, .git, or package-lock.json
- Do not generate unless explicitly asked for "generate learning prompt"
- Do not guess at code — only attach actual file content
- Do not modify the generated prompt — the format is fixed
- Do not attach old/unchanged code

Rule: After completion, I will remind the developer 
with: "Learning prompt generated. Paste into ChatGPT to learn."

## Git Rules
- After every phase is verified working, commit with this exact format:
  git add .
  git commit -m "phase-[N]: [one line describing what was built]"
- Never commit .env (it is in .gitignore already)
- Never commit node_modules
- Push after every commit: git push origin main
- If I do not ask for a commit, remind me at the end of every phase

## SKILL.md Rules
- After every phase, update SKILL.md with:
  - Section 4: any decision made this phase (what we chose and why)
  - Section 5: any new skill demonstrated (with evidence - filename)
  - Section 7: any bug that happened (symptom, cause, fix, lesson)
- Do not leave any section blank. Write "none this phase" if nothing applies.
- Numbers in section 6 only get filled when we actually measure something.
  Never estimate or fabricate.
