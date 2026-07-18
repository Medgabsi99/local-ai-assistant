# Local AI Assistant

> **A privacy-first, browser-based AI assistant.** All AI inference runs locally in your browser — no data is sent to any server.

<p align="center">
  <img src="./screenshots/demo.png" alt="Local AI Assistant Screenshot" width="800"/>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-blueviolet)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Tests](https://img.shields.io/badge/Tests-54%20passing-brightgreen)](.)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
  - [Downloading AI Models](#downloading-ai-models)
  - [Chatting with RAG](#chatting-with-rag)
  - [Agent Mode](#agent-mode)
  - [Connecting to Ollama](#connecting-to-ollama)
  - [Audio Transcription](#audio-transcription)
  - [Conversation Management](#conversation-management)
- [UI Features](#ui-features)
  - [Themes & Accents](#themes--accents)
  - [Multi-Language Support](#multi-language-support)
  - [Markdown Toolbar](#markdown-toolbar)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
  - [Accessibility](#accessibility)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
  - [Component Tree](#component-tree)
  - [Data Flow](#data-flow)
  - [Worker Architecture](#worker-architecture)
- [Configuration](#configuration)
- [Development](#development)
  - [Scripts](#scripts)
  - [Testing](#testing)
  - [Building](#building)
- [FAQ](#faq)
- [License](#license)

---

## Overview

Local AI Assistant (LocalAI) is a Progressive Web Application (PWA) that brings state-of-the-art AI models — language models, embedding models, and speech-to-text — directly to your browser using WebAssembly and ONNX runtime. Everything runs client-side using [@xenova/transformers](https://github.com/xenova/transformers.js) and [onnxruntime-web](https://github.com/microsoft/onnxruntime-web).

The app supports **Retrieval-Augmented Generation (RAG)**: you can upload documents (PDF, TXT, MD, CSV), which are chunked, embedded, and stored in a local vector database (IndexedDB). When you ask a question, the system retrieves the most relevant chunks using hybrid BM25 + vector similarity search and provides them as context to the AI model.

For users with local AI servers, you can connect to [Ollama](https://ollama.com), [LM Studio](https://lmstudio.ai), or any OpenAI-compatible API.

---

## Features

### Core AI
- **In-Browser LLM** — Language models like LaMini-Flan-T5, TinyLlama, and Qwen running entirely in your browser via WebAssembly
- **Embedding Model** — all-MiniLM-L6-v2 for semantic search and RAG
- **Whisper Speech-to-Text** — Transcribe audio recordings using Whisper Tiny EN
- **Local Server Mode** — Connect to Ollama or any OpenAI-compatible API for alternative inference
- **Agent Tools** — Built-in calculator (with `^` exponentiation), unit converter, date/time, and URL fetch
- **Web Search** — Optional DuckDuckGo integration for current information

### RAG & Documents
- **Upload & Process** — Drag-and-drop or upload PDF, TXT, MD, and CSV files
- **Hybrid Search** — BM25 keyword search + vector similarity re-ranking with corpus-wide IDF statistics
- **Vector Database** — Each document is chunked (500 characters with 100 overlap), embedded, and stored in IndexedDB
- **Document Viewer** — Inline PDF viewer and text preview with tag management
- **Source Attribution** — AI responses show which documents were used

### Chat
- **Streaming Responses** — Real-time token-by-token streaming
- **Stop Generation** — Cancel inference mid-response
- **Edit & Regenerate** — Edit your messages and regenerate AI responses
- **Star / Copy / Delete** — Per-message actions
- **Text-to-Speech** — Read AI responses aloud using the Web Speech API
- **Smart Titles** — Conversations are automatically titled from the first exchange

### Conversation Management
- **Pin / Rename / Archive** — Organize conversations with pinning, renaming, and archiving
- **Date Grouping** — Conversations grouped into Today, Yesterday, This Week, Older
- **In-Chat Search** — Search messages with role filtering (All / User / AI) and match counting
- **Export** — Export conversations as JSON or Markdown
- **Share** — Copy conversation as text or download as Markdown

### UI / UX
- **Dark & Light Themes** — Toggle between dark and light modes
- **6 Accent Colors** — Emerald, Blue, Violet, Amber, Rose, Cyan
- **Multi-Language** — English, Français, العربية (Arabic RTL support)
- **Markdown Rendering** — Full Markdown support with syntax highlighting
- **Markdown Toolbar** — Bold, Italic, Code, Links, Lists, Code Blocks
- **Responsive Design** — Mobile-friendly with collapsible sidebar
- **Loading Skeletons** — Animated placeholders during model loading
- **Toast Notifications** — Non-intrusive success/error messages
- **Error Boundaries** — Graceful error handling with reload option

### PWA
- **Installable** — Works as a standalone desktop/mobile app
- **Offline Support** — Cached assets via service worker
- **Auto-Update** — Service worker auto-updates on new releases

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI Framework** | [React 19](https://react.dev/) | Component rendering |
| **Build Tool** | [Vite 8](https://vitejs.dev/) | Dev server, bundling |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) + CSS custom properties | Utility-first styling with dynamic theming |
| **AI Inference** | [@xenova/transformers](https://github.com/xenova/transformers.js) v2.17 | In-browser ML model execution |
| **Runtime** | [onnxruntime-web](https://github.com/microsoft/onnxruntime-web) 1.14 | ONNX model runtime |
| **Vector Database** | [Dexie.js](https://dexie.org/) 4.4 | IndexedDB wrapper for vector and app data |
| **Icons** | [lucide-react](https://lucide.dev/) | Consistent SVG icon set |
| **Markdown** | [react-markdown](https://github.com/remarkjs/react-markdown) + [react-syntax-highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter) | Message rendering |
| **PDF** | [pdfjs-dist](https://mozilla.github.io/pdf.js/) 5.7 | PDF text extraction and rendering |
| **PWA** | [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) 1.3 | Service worker, manifest |
| **Testing** | [Vitest](https://vitest.dev/) 4.1 + [Testing Library](https://testing-library.com/) | Unit and integration tests |
| **Linting** | [ESLint](https://eslint.org/) 10 | Code quality |
| **Formatting** | [Prettier](https://prettier.io/) 3.9 | Code formatting |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (recommended: 20+)
- **npm** 9+ (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/Medgabsi99/local-ai-assistant.git
cd local-ai-assistant

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173` (or the next available port).

### Production Build

```bash
# Build for production
npm run build

# Preview the production build locally
npm run preview
```

The production build will be in the `dist/` directory and can be served by any static file server.

---

## Usage Guide

### Downloading AI Models

When you first open the app, you'll see the sidebar with model status panels. You need to download at least these two models:

1. **Embedding Model (all-MiniLM-L6-v2)** — Required for RAG and semantic search
2. **Language Model (LaMini-Flan-T5-783M)** — Required for chat and AI responses
3. **Whisper (optional)** — Required for audio transcription

Click the **Download** button for each model. Models are cached in your browser's IndexedDB after download and don't need to be re-downloaded.

> **Note:** Language models are large (700MB–1.5GB). First download may take several minutes depending on your connection.

### Chatting with RAG

RAG (Retrieval-Augmented Generation) allows the AI to answer questions based on your documents:

1. **Enable RAG Mode** — Toggle the "RAG Mode" checkbox in the chat top bar
2. **Upload Documents** — Switch to the "Documents" tab and upload PDFs, TXT, MD, or CSV files
3. **Ask Questions** — Type questions about your documents. The AI will retrieve relevant chunks and answer based on them

The RAG pipeline works as follows:
```
Upload → Extract text → Chunk (500 char) → Embed → Store in IndexedDB
Query → Embed query → Search similar vectors → BM25 re-rank → Context → LLM → Answer
```

### Agent Mode

Enable "Agent mode" in the top bar to use built-in tools:

| Tool | Example | Result |
|------|---------|--------|
| Calculator | `2^10` | `1024` |
| Unit Converter | `100 km to m` | `100000 m` |
| Date/Time | `current time` | Current time |
| URL Fetch | `https://example.com` | Extracted text |

### Connecting to Ollama

If you have [Ollama](https://ollama.com) running locally:

1. Open **Settings** (gear icon in the sidebar)
2. Scroll to **Local LLM Server (Ollama)**
3. Enable the toggle
4. Enter your server URL (default: `http://localhost:11434`)
5. Enter the model name (default: `llama3.2:1b`)
6. Click **Test** to verify the connection

Once connected, AI inference will use your Ollama server instead of the browser-based model.

### Audio Transcription

1. Click the **microphone button** next to the input field
2. Grant microphone permission when prompted
3. Speak — the recording will show audio level visualization
4. Click **Stop** to transcribe
5. The transcribed text will be inserted into the input field

Requires the **Whisper** model to be downloaded first.

### Conversation Management

| Action | How |
|--------|-----|
| **New Chat** | Click `+` or press `⌘N` |
| **Pin** | Hover over a conversation and click the pin icon |
| **Rename** | Hover and click the pencil icon |
| **Archive** | Hover and click the archive icon; toggle archived view with the "Archived" button |
| **Delete** | Hover and click the trash icon |
| **Export JSON** | Hover and click the download icon |
| **Search** | Press `⌘F` or click the search icon in the top bar |
| **Share** | Click the share icon to copy or download as Markdown |

---

## UI Features

### Themes & Accents

Toggle between **Dark** and **Light** themes using the sun/moon button in the top bar.

Choose from 6 accent colors in **Settings → Accent Color**:
- Emerald (default, green)
- Blue
- Violet
- Amber
- Rose
- Cyan

### Multi-Language Support

The app supports three languages, switchable in **Settings**:

| Language | Code | Label |
|----------|------|-------|
| English | `en` | English |
| French | `fr` | Français |
| Arabic | `ar` | العربية (RTL support) |

Language preference is saved to localStorage and persists across sessions.

### Markdown Toolbar

The input area includes a toolbar for quick Markdown insertion:

| Button | Inserts |
|--------|---------|
| **B** (Bold) | `**text**` |
| *I* (Italic) | `*text*` |
| `<>` (Code) | `` `text` `` |
| 🔗 (Link) | `[text](url)` |
| • (List) | `- text` |
| 📄 (Code Block) | ```` ``` ```` |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘N` | New conversation |
| `⌘1` | Switch to Chat tab |
| `⌘2` | Switch to Documents tab |
| `⌘,` | Open Settings |
| `⌘F` | Search messages |
| `Enter` | Send message |
| `Shift+Enter` | New line in input |
| `Escape` | Close search, modals |

### Accessibility

The app includes:
- **45+ aria-labels** on all icon-only buttons
- **Semantic HTML** structure
- **Keyboard navigation** support
- **Screen reader** friendly messages
- **Focus management** on modals and search
- **High contrast** theming options

---

## Project Structure

```
local-ai-assistant/
├── public/                    # Static assets (favicon, icons, offline page)
├── screenshots/               # App screenshots
├── src/
│   ├── App.jsx                # Root component, contexts (Lang, Toast, ModelStatus)
│   ├── main.jsx               # Entry point
│   ├── index.css              # Global styles, CSS custom properties, Tailwind
│   ├── test-setup.js          # Vitest setup file
│   │
│   ├── components/            # React UI components
│   │   ├── ChatArea.jsx       # Main chat interface (messages, input, toolbar)
│   │   ├── ChatTopBar.jsx     # Top bar controls (RAG, web, theme, agent)
│   │   ├── SearchBar.jsx      # In-chat search with role filtering
│   │   ├── SystemPromptEditor.jsx  # System prompt editor
│   │   ├── TemplatesPanel.jsx # Prompt template selector
│   │   ├── ShareModal.jsx     # Share/export modal
│   │   ├── AudioRecorder.jsx  # Audio recording + transcription
│   │   ├── Sidebar.jsx        # Conversation list, model status
│   │   ├── SettingsModal.jsx  # Settings (language, accent, storage, server)
│   │   ├── DocumentPane.jsx   # Document management (upload, view, tags)
│   │   ├── PdfViewer.jsx      # Inline PDF viewer
│   │   ├── ModelStatus.jsx    # Model download/load/unload UI
│   │   ├── ErrorBoundary.jsx  # Error boundary with i18n support
│   │   ├── Icons.jsx          # Centralized lucide-react icon mapping
│   │   ├── Layout.jsx         # Main layout wrapper
│   │   └── Skeleton.jsx      # Loading skeleton components
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useChatSend.js     # Chat send/generate/reply logic
│   │   ├── useMessageSearch.js# In-chat search with filtering
│   │   ├── useRAG.js          # Document processing, embedding, search
│   │   ├── useSettings.js     # Theme, system prompt persistence
│   │   ├── useModelStatus.js  # (deprecated — use ModelStatusContext)
│   │   ├── useOnlineStatus.js # Online/offline detection
│   │   └── usePWAInstall.js   # PWA install prompt
│   │
│   ├── lib/                   # Utilities and libraries
│   │   ├── i18n.js            # Internationalization (110+ keys, 3 languages)
│   │   ├── constants.js        # Named constants (timeouts, sizes, etc.)
│   │   ├── error-handler.js   # Centralized error reporting
│   │   ├── hybrid-search.js   # BM25 + vector similarity hybrid search
│   │   ├── agent-tools.js     # Calculator, converter, datetime, URL fetch
│   │   ├── web-search.js      # DuckDuckGo instant answer API
│   │   ├── llm-server.js      # Ollama API connector
│   │   └── vector-store-access.js  # Vector store index access
│   │
│   ├── workers/               # Web Workers (separate threads)
│   │   ├── ai.worker.js       # AI model loading, inference, embedding
│   │   ├── worker-bridge.js   # Async message passing bridge
│   │   ├── audio-processor.js # Audio recording and processing
│   │   ├── pdf-extractor.js   # PDF text extraction and chunking
│   │   └── vector-store.js    # Vector storage (IndexedDB-backed)
│   │
│   ├── db/                    # Database
│   │   └── database.js        # Dexie schema, CRUD helpers
│   │
│   └── __tests__/             # Test files
│       ├── agent-tools.test.js    # 21 tests for agent tools
│       ├── bug-regression.test.js # 14 regression tests
│       ├── hybrid-search.test.js  # 9 tests for search
│       └── i18n.test.js           # 10 tests for translations
│
├── .prettierrc                # Prettier configuration
├── eslint.config.js           # ESLint configuration
├── vite.config.js             # Vite + Vitest configuration
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

---

## Architecture

### Component Tree

```
App (ErrorBoundary)
├── LangContext.Provider
│   └── ModelStatusContext.Provider
│       └── ToastProvider
│           └── Layout
│               ├── Sidebar
│               │   ├── ConversationList
│               │   └── ModelStatus
│               ├── [ChatArea / DocumentPane]
│               └── SettingsModal
```

### Data Flow

```
User Input → ChatArea
  → useChatSend hook
    → [RAG Mode] searchSimilar() → Vector Store → getEmbeddingsBatch
    → [Agent Mode] detectTool() → executeTool()
    → [Web Search] searchWeb()
    → [Server Mode] llm-server generate()
    → [Browser Mode] ai.runInference() → ai.worker.js
  → addMessage() → IndexedDB
  → Streaming tokens → UI update via onToken
```

### Worker Architecture

The app uses Web Workers to keep the UI responsive during heavy AI computations:

```
Main Thread                    Workers
┌─────────────┐               ┌────────────────┐
│ ChatArea    │──message──▶   │ ai.worker.js   │
│             │◀──response──  │ • Model loading │
│ worker-     │               │ • Inference     │
│ bridge.js   │               │ • Embeddings    │
│             │               │ • Transcription │
│             │               └────────────────┘
│             │               ┌────────────────┐
│             │──message──▶   │ audio-         │
│             │◀──response──  │ processor.js   │
│             │               │ • Recording    │
│             │               │ • Processing   │
│             │               └────────────────┘
│             │               ┌────────────────┐
│             │──message──▶   │ pdf-           │
│             │◀──response──  │ extractor.js   │
│             │               │ • Text extract │
│             │               │ • Chunking     │
│             │               └────────────────┘
└─────────────┘
```

Messages are passed via `worker-bridge.js` using a Promise-based request/response pattern with request IDs for correlation.

---

## Configuration

### Environment Variables

The app has no required environment variables. All configuration is done through the Settings UI or by modifying `src/lib/constants.js`.

### Key Constants (`src/lib/constants.js`)

| Constant | Default | Description |
|----------|---------|-------------|
| `MODEL_POLL_INTERVAL_MS` | 3000 | Polling interval for model status |
| `TOAST_DURATION_MS` | 3000 | Toast notification duration |
| `INFERENCE_MAX_TOKENS` | 512 | Max tokens for browser inference |
| `INFERENCE_TEMPERATURE` | 0.3 | Temperature for browser inference |
| `INFERENCE_SERVER_MAX_TOKENS` | 2048 | Max tokens for server inference |
| `INFERENCE_SERVER_TEMPERATURE` | 0.3 | Temperature for server inference |
| `CHUNK_SIZE` | 500 | Document chunk size (characters) |
| `CHUNK_OVERLAP` | 100 | Chunk overlap (characters) |
| `RAG_TOP_K` | 3 | Top-K results for RAG |
| `RAG_VECTOR_WEIGHT` | 0.6 | Weight for vector score in hybrid search |
| `AUDIO_SAMPLE_RATE` | 16000 | Microphone sample rate |
| `AUDIO_BITS_PER_SECOND` | 64000 | Audio encoding bitrate |
| `SCROLL_THRESHOLD_PX` | 80 | Auto-scroll threshold |
| `WEB_SEARCH_TIMEOUT_MS` | 8000 | Web search timeout |
| `TAGS_MAX_COUNT` | 20 | Maximum tags per document |

---

## Development

### Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start development server with HMR |
| `build` | `npm run build` | Build for production |
| `preview` | `npm run preview` | Preview production build |
| `test` | `npm test` | Run all tests once |
| `test:watch` | `npm run test:watch` | Run tests in watch mode |
| `lint` | `npm run lint` | Lint all source files |
| `format` | `npx prettier --write "src/**/*.{js,jsx}"` | Format all source files |

### Testing

Tests use Vitest with jsdom environment:

```bash
# Run all tests
npm test

# Run tests in watch mode (great for development)
npm run test:watch

# Run a specific test file
npx vitest run src/__tests__/agent-tools.test.js

# Run with coverage
npx vitest run --coverage
```

The test suite currently covers:
- **Agent Tools** — Calculator (with `^` exponentiation), unit converter, date/time, URL fetch
- **Bug Regression** — Every known bug has a regression test
- **Hybrid Search** — BM25 scoring, text search
- **i18n** — All translation keys in all 3 languages

### Building

```bash
# Production build
npm run build

# The output will be in the dist/ directory
# Serve with any static file server:
npx serve dist
```

The production build includes:
- Minified and tree-shaken JavaScript
- CSS extraction and minification
- Service worker with asset caching
- PWA manifest and offline page
- Optimized WASM modules for ONNX runtime

---

## FAQ

### Does this app send my data anywhere?

**No.** All AI inference runs locally in your browser. The only external network requests are:
- Model downloads (from Hugging Face CDN)
- Web search (if enabled, uses DuckDuckGo API)
- Local Ollama server (if enabled, to your local machine)

No data is sent to any external server for AI processing.

### How much RAM does it need?

- **Embedding Model** ~200MB
- **Language Model (LaMini)** ~1.5GB
- **Language Model (TinyLlama)** ~700MB
- **Whisper** ~150MB

Total: 1–2.5GB depending on which models are loaded.

### Why is the first message slow?

The first message after loading a model can be slow because the model needs to warm up. Subsequent messages are faster.

### Can I use my own AI server?

Yes. The app supports any OpenAI-compatible API (Ollama, LM Studio, etc.). Go to **Settings → Local LLM Server** and configure your server URL and model name.

### How are documents stored?

Documents are stored in IndexedDB (via Dexie.js). Text content is chunked, embedded, and stored as vectors for similarity search. All data stays in your browser's IndexedDB storage.

### Can I clear all data?

Yes. Go to **Settings → Clear All Data**. This will delete all conversations, documents, vectors, and cached models. A page reload is required after clearing.

### How do I export my data?

You can:
1. **Export individual conversations** — Hover over a conversation and click the download icon (exports as JSON)
2. **Export all data** — Settings → Export Backup (includes all conversations, documents, and vectors)
3. **Share a conversation** — Click the share icon to copy as text or download as Markdown

### Which browsers are supported?

- **Chrome** 100+ (recommended for best WASM performance)
- **Edge** 100+
- **Firefox** 110+
- **Safari** 16+ (limited PWA support)

---

## License

[MIT](./LICENSE) — Free for personal and commercial use.

---

*Built with ❤️ by [Medgabsi99](https://github.com/Medgabsi99)*