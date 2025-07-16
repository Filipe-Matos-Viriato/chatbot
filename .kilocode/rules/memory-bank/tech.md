# Technical Stack and Setup

## Backend Technologies
- **Runtime:** Node.js
- **Framework:** Express.js
- **Key Dependencies:**
  - `@google/generative-ai`: For accessing Google's `gemini-2.5-flash` and `text-embedding-004` models.
  - `@pinecone-database/pinecone`: For connecting to and querying a Pinecone vector database.
  - `cors`: To enable Cross-Origin Resource Sharing.
  - `dotenv`: To manage environment variables from a `.env` file.
  - `express`: Web server framework.

## Frontend Technologies
- **Framework:** React
- **Build Tool:** Vite
- **Key Dependencies:**
  - `react`: Core library for building the user interface.
  - `react-dom`: For rendering React components in the browser.

## Development Setup
- **Monorepo:** The project is structured as a monorepo using npm workspaces, with the root `package.json` defining the workspaces and providing convenience scripts.
- **Environment Variables:** The backend relies on a `.env` file to store sensitive information like API keys. This file is not checked into source control. An example file (`.env.example`) is provided.
- **Local Development:**
  - To run the backend server: `npm run start:backend`
  - To run the frontend development server: `npm run dev`
- **External Access:** The frontend development server is configured via `vite.config.js` to allow access from external URLs (like ngrok) for testing embedded scenarios.