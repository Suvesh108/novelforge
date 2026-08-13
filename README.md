# NovelForge

NovelForge is an advanced, AI-assisted writing workspace built for long-form creative authors. It combines structured world-building workflows, dynamic continuity engines, and a version-controlled editor to help you outline, draft, and polish novels.

## Features

- **Guided Story Setup:** Captures protagonist details, sci-fi/fantasy elements, and general genre settings through an adaptive, step-by-step interview.
- **Story Bible Architect:** Generates and maintains a comprehensive, editable Story Bible detailing character attributes, magic systems, world maps, and story arcs.
- **Chapter Outline Mapper:** Designs outline segments and estimates required word counts based on target audio lengths (WPM).
- **Distraction-Free Editor:** A clean Notion-style writing layout with custom serif typography toggles and auto-saving.
- **Version Control:** Keeps multiple generations/drafts of each chapter so you can revert or compare variations.
- **AI Assist Panel:** Includes creative assistance modes (Dialogue generation, continuity checking, scenery expansion, brainstorming ideas) and writing modes (Draft, Normal, High-Quality).
- **Direct Format Exporting:** Compile and download your individual chapters or complete combined books as PDF, DOCX, EPUB, or Markdown files.
- **Local SQLite Database:** Fully self-contained local storage using Prisma Client.

## Technical Architecture

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, and Zustand.
- **Backend:** Node.js, Express, TypeScript, and Prisma ORM.
- **Database:** SQLite.

## Getting Started

### 1. Installation
Clone the repository and install dependencies at the root directory:
```bash
npm install
```

### 2. Database Synchronization
Run Prisma migrations to scaffold the local SQLite database file:
```bash
npx prisma db push
```

### 3. Running the App
Start both the client development server and the backend server concurrently:
```bash
npm run dev
```
Open your browser to `http://localhost:4000` to access the application workspace.

### 4. Compiling the Production Build
Generate optimized static production assets:
```bash
npm run build
```
The compiled client code compiles to `/server/dist/public` and is automatically served by the Express backend.

## Environment & Key Configurations

You can manually input your Google Gemini, OpenAI, OpenRouter, or Custom API Keys directly through the **API Keys** modal located in the top navigation bar. Key configurations are stored safely in local storage and linked to your active projects.
