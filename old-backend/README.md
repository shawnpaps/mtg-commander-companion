# MTG Commander Companion Backend

Express.js backend server for the MTG Commander Companion application with Supabase integration.

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account and project

### Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables:**

   ```bash
   cp env.example .env
   ```

   Edit `.env` and add your Supabase credentials:

   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_supabase_service_key
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3001` with hot reload enabled.

## 📋 Available Scripts

- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm test` - Run tests (not implemented yet)

## 🔌 API Endpoints

### Health Check

- `GET /health` - Server health status

### Games

- `GET /api/games` - Get all games
- `GET /api/games/:gameId` - Get specific game
- `POST /api/games` - Create new game
- `PUT /api/games/:gameId` - Update game
- `DELETE /api/games/:gameId` - Delete game

### Example Usage

**Create a new game:**

```bash
curl -X POST http://localhost:3001/api/games \
  -H "Content-Type: application/json" \
  -d '{"playerName": "John", "startingLife": 40}'
```

**Get all games:**

```bash
curl http://localhost:3001/api/games
```

## 🛠️ Project Structure

```
backend/
├── config/
│   └── supabase.js      # Supabase client configuration
├── routes/
│   └── games.js         # Game-related API routes
├── server.js            # Main server file
├── package.json         # Dependencies and scripts
├── nodemon.json         # Nodemon configuration
├── env.example          # Environment variables template
└── README.md           # This file
```

## 🔧 Configuration

### Environment Variables

| Variable               | Description           | Default                 |
| ---------------------- | --------------------- | ----------------------- |
| `PORT`                 | Server port           | `3001`                  |
| `NODE_ENV`             | Environment           | `development`           |
| `FRONTEND_URL`         | Frontend URL for CORS | `http://localhost:3000` |
| `SUPABASE_URL`         | Supabase project URL  | Required                |
| `SUPABASE_SERVICE_KEY` | Supabase service key  | Required                |

## 🗄️ Database Schema

The backend expects a `games` table in Supabase with the following structure:

```sql
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'active',
  starting_life INTEGER DEFAULT 40,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔒 Security

- CORS enabled for frontend communication
- Helmet.js for security headers
- Input validation and sanitization
- Error handling middleware

## 🐛 Troubleshooting

1. **Server won't start:** Check if port 3001 is available
2. **Supabase connection error:** Verify your environment variables
3. **CORS errors:** Ensure `FRONTEND_URL` is set correctly

## 📝 Development

The server uses nodemon for automatic restarts during development. Any changes to `.js` files in the watched directories will trigger a restart.
