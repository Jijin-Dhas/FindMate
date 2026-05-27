# 🏠 FindMate – Smart Roommate & Flatmate Finder System

A clean, beginner-friendly Node.js + Express + MongoDB backend starter.

---

## 📁 Folder Structure

```
findmate-backend/
│
├── src/                          ← All source code lives here
│   ├── config/
│   │   └── db.js                 ← MongoDB connection setup
│   │
│   ├── controllers/              ← Business logic (what happens for each request)
│   │   ├── authController.js     ← Register, Login, Get profile
│   │   └── listingController.js  ← CRUD for room listings
│   │
│   ├── middleware/               ← Functions that run BETWEEN request and response
│   │   ├── auth.js               ← JWT token verification (protect private routes)
│   │   ├── errorHandler.js       ← Global error catcher
│   │   └── notFound.js           ← 404 handler for unknown routes
│   │
│   ├── models/                   ← MongoDB schemas (shape of your data)
│   │   ├── User.js               ← User schema + password hashing
│   │   └── Listing.js            ← Room/flat listing schema
│   │
│   ├── routes/                   ← URL definitions → connect to controllers
│   │   ├── authRoutes.js         ← /api/auth/*
│   │   ├── listingRoutes.js      ← /api/listings/*
│   │   └── healthRoutes.js       ← /api/health
│   │
│   ├── utils/
│   │   └── apiResponse.js        ← Helper functions for consistent responses
│   │
│   ├── app.js                    ← Express app setup (middleware + routes)
│   └── server.js                 ← Entry point (starts the server)
│
├── logs/                         ← Log files (auto-created)
├── .env                          ← Your secret config (never commit this!)
├── .env.example                  ← Template for .env (safe to commit)
├── .gitignore                    ← Files Git should ignore
├── package.json                  ← Project info + dependencies
└── README.md                     ← This file
```

---

## 🚀 Setup Instructions

### Step 1 – Prerequisites
Make sure you have these installed:
- [Node.js](https://nodejs.org) v18 or later → `node --version`
- [MongoDB](https://www.mongodb.com/try/download/community) (local) OR a free [MongoDB Atlas](https://cloud.mongodb.com) account

### Step 2 – Install Dependencies
```bash
cd findmate-backend
npm install
```

### Step 3 – Configure Environment Variables
```bash
# Copy the example file
cp .env.example .env

# Open .env and fill in your values:
# - MONGO_URI: your MongoDB connection string
# - JWT_SECRET: any long random string
```

### Step 4 – Run the Server
```bash
# Development mode (auto-restarts on file changes)
npm run dev

# Production mode
npm start
```

You should see:
```
✅ MongoDB Connected: localhost
╔════════════════════════════════════════╗
║       FindMate API Server              ║
╠════════════════════════════════════════╣
║  Status   : Running ✅                 ║
║  Port     : 5000                       ║
╚════════════════════════════════════════╝
```

---

## 📡 API Endpoints

### Health Check
| Method | URL          | Description          | Auth |
|--------|--------------|----------------------|------|
| GET    | /api/health  | Server status check  | None |

### Authentication
| Method | URL                  | Description           | Auth     |
|--------|----------------------|-----------------------|----------|
| POST   | /api/auth/register   | Register new user     | None     |
| POST   | /api/auth/login      | Login & get token     | None     |
| GET    | /api/auth/me         | Get my profile        | Required |

### Listings
| Method | URL                  | Description           | Auth     |
|--------|----------------------|-----------------------|----------|
| GET    | /api/listings        | Get all listings      | None     |
| GET    | /api/listings/:id    | Get one listing       | None     |
| POST   | /api/listings        | Create new listing    | Required |
| PUT    | /api/listings/:id    | Update listing        | Required |
| DELETE | /api/listings/:id    | Delete listing        | Required |

### Query Filters (GET /api/listings)
```
/api/listings?city=Chennai
/api/listings?maxRent=15000
/api/listings?roomType=single
/api/listings?gender=any
/api/listings?page=1&limit=10
```

---

## 🧪 Testing with curl

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Arjun","email":"arjun@test.com","password":"pass1234","city":"Chennai"}'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"arjun@test.com","password":"pass1234"}'
```

### Create Listing (use token from login)
```bash
curl -X POST http://localhost:5000/api/listings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "title": "Spacious room in T. Nagar",
    "description": "Clean room, close to metro",
    "location": { "city": "Chennai", "area": "T. Nagar" },
    "rent": { "amount": 8000, "isNegotiable": true },
    "roomType": "single"
  }'
```

---

## 🔧 Tech Stack

| Package          | Purpose                              |
|------------------|--------------------------------------|
| express          | Web framework                        |
| mongoose         | MongoDB ORM                          |
| dotenv           | Load .env variables                  |
| bcryptjs         | Hash passwords securely              |
| jsonwebtoken     | Create and verify JWT tokens         |
| cors             | Allow cross-origin requests          |
| helmet           | Set secure HTTP headers              |
| morgan           | Log HTTP requests                    |
| express-validator| Validate request inputs              |
| nodemon          | Auto-restart server in dev mode      |
