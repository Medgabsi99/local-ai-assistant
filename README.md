<a name="readme-top"></a>

<!-- PROJECT SHIELDS -->
[![MIT License][license-shield]][license-url]
[![PWA Ready][pwa-shield]][pwa-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <img src="public/icon-192.png" alt="Logo" width="120" height="120">
  <h1>🔒 Local AI Assistant</h1>
  <p>
    A privacy‑first AI assistant that runs <strong>entirely in your browser</strong>.<br />
    No API keys. No servers. No data leaving your device.
  </p>
  <a href="https://github.com/Medgabsi99/local-ai-assistant"><strong>Explore the docs »</strong></a>
  ·
  <a href="https://github.com/Medgabsi99/local-ai-assistant/issues">Report Bug</a>
  ·
  <a href="https://github.com/Medgabsi99/local-ai-assistant/issues">Request Feature</a>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About The Project</a></li>
    <li><a href="#features">Features</a></li>
    <li><a href="#demo">Demo</a></li>
    <li><a href="#architecture">Architecture</a></li>
    <li><a href="#tech-stack">Tech Stack</a></li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#project-structure">Project Structure</a></li>
    <li><a href="#testing">Testing</a></li>
    <li><a href="#privacy--security">Privacy & Security</a></li>
    <li><a href="#performance">Performance</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

---

## About The Project

**Local AI Assistant** is a Progressive Web Application that brings **real AI models** into the browser.  
It uses **Transformers.js** to run a language model (LaMini‑Flan‑T5), an embedding model (all‑MiniLM‑L6‑v2), and a speech‑to‑text model (Whisper Tiny) **directly on your device**.  

Upload a PDF, ask questions about it, and get answers – all without sending a single byte to a server.  
The app works **offline** after the initial model download and can be **installed** like a native desktop / mobile app.

> **Why?**  
> In 2026, privacy is not a feature – it’s a requirement.  
> This project demonstrates how modern web APIs (Web Workers, OPFS, PWA) can deliver a fully local AI experience that respects user data.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Features

| Category | Feature | Description |
|----------|---------|-------------|
| 🧠 **Local LLM** | LaMini‑Flan‑T5 | 1.5B parameter language model running in‑browser via Transformers.js |
| 📄 **RAG Pipeline** | Document Q&A | Upload PDFs, TXT, MD, CSV; ask questions and get context‑aware answers |
| 🎤 **Speech‑to‑Text** | Whisper Tiny EN | Record audio directly in the browser and transcribe it offline |
| 📡 **Offline‑First** | Full PWA | Works without internet after models are cached; service worker with offline page |
| 🔒 **100% Private** | Zero data exfiltration | All processing happens on‑device; no analytics, no API keys, no telemetry |
| 📱 **Installable** | Native app experience | Install on desktop & mobile via the browser’s “Add to Home Screen” |
| 🧬 **Local Vector Store** | OPFS + Cosine Similarity | Embeddings stored in Origin Private File System; fast semantic search |
| ⚡ **Non‑blocking UI** | Web Workers | Heavy AI tasks run off the main thread for a smooth experience |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Demo

![Local AI Assistant Demo](screenshots/demo.png)

---

## Architecture
The application is built around three dedicated Web Workers that handle all heavy computation, keeping the React UI snappy.

```text
┌─────────────────────────────────────────────────┐
│                 Browser (PWA)                    │
│                                                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │  React   │  │  Web      │  │  Transformers│  │
│  │  UI      │◄─┤  Workers  ├──┤  .js Engine  │  │
│  └──────────┘  └───────────┘  └──────────────┘  │
│        │              │               │          │
│        ▼              ▼               ▼          │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ IndexedDB│  │ OPFS      │  │  Model Cache │  │
│  │ (Docs)   │  │ (Vectors) │  │  (Local)     │  │
│  └──────────┘  └───────────┘  └──────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │         Service Worker (Offline)          │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```
Detailed design decisions are documented in DECISIONS.md – covering model selection, storage choices, RAG implementation, and more.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + Vite | UI framework and build tooling |
| Styling | Tailwind CSS v4 | Utility‑first design system |
| AI Engine | Transformers.js | Run LLM, embeddings, and Whisper in the browser |
| Vector Store | OPFS (Origin Private File System) | Persist vector embeddings locally |
| Database | IndexedDB via Dexie.js | Store documents, conversations, settings |
| Workers | Web Workers + custom bridge | Non‑blocking AI inference and file processing |
| PDF Extraction | pdfjs-dist | Extract text from PDFs client‑side |
| PWA | Vite PWA Plugin | Service worker, offline caching, installability |

---

## Getting Started
Follow these steps to get a local copy up and running.

### Prerequisites
* Node.js ≥ 20 LTS (v22 recommended)
* npm (comes with Node) or yarn
* A modern browser (Chrome / Edge recommended for best OPFS & WebGPU support)

### Installation

```bash
# Clone the repository
git clone https://github.com/Medgabsi99/local-ai-assistant.git
cd local-ai-assistant

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173` in your browser.

```bash
npm run build
npm run preview    # test the production build locally
```

---

## Usage

**1️⃣ Load the AI models**
* In the sidebar, click Download on the Embedding Model (~80 MB) and the Language Model (~1.5 GB).
* The download progress, speed, and ETA are displayed. You can cancel and resume downloads at any time.
* Once loaded, the models are cached for offline use.

**2️⃣ Upload documents**
* Switch to the Documents tab and upload a PDF, TXT, MD, or CSV file.
* The app will:
  * Extract text (PDFs are processed with pdf.js)
  * Split the text into overlapping chunks
  * Generate vector embeddings for each chunk
  * Store everything in IndexedDB and OPFS

**3️⃣ Chat with RAG**
* Go to the Chat tab.
* Make sure “RAG Mode” is enabled (toggle in the top bar).
* Type a question about your uploaded documents.
* The app retrieves the most semantically similar chunks and injects them into the LLM prompt.
* You’ll see a “📎 Using X document chunks” indicator when RAG is active.

**4️⃣ Work offline**
* After models and documents are loaded, disconnect your internet.
* The app still works perfectly – chat, search, and document processing all happen locally.

**5️⃣ Install as a native app**
* On desktop: click the install banner or use the browser menu → “Install page as app”.
* On mobile: use “Add to Home Screen”.
* The app opens in its own window, without browser chrome.

**6️⃣ Audio transcription (optional)**
* Click the 🎤 Record button in the chat input area.
* Allow microphone access.
* Speak, then stop recording – the Whisper model transcribes your speech directly into the chat input.

---

## Project Structure

```text
local-ai-assistant/
├── public/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── offline.html
├── src/
│   ├── components/               # React components
│   │   ├── AudioRecorder.jsx
│   │   ├── ChatArea.jsx
│   │   ├── DocumentPane.jsx
│   │   ├── InstallPrompt.jsx
│   │   ├── Layout.jsx
│   │   ├── ModelStatus.jsx
│   │   ├── SettingsModal.jsx
│   │   ├── Sidebar.jsx
│   │   └── VectorStoreManager.jsx
│   ├── workers/                  # Web Workers
│   │   ├── ai.worker.js          # Model loading, inference, embeddings
│   │   ├── audio-processor.js    # Audio capture & encoding
│   │   ├── pdf-extractor.js      # PDF text extraction
│   │   ├── vector-store.js       # OPFS‑based vector persistence
│   │   └── worker-bridge.js      # Clean async message‑passing API
│   ├── db/
│   │   └── database.js           # IndexedDB schema & helpers (Dexie)
│   ├── hooks/
│   │   ├── useOnlineStatus.js
│   │   ├── usePWAInstall.js
│   │   └── useRAG.js             # RAG pipeline orchestration
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── DECISIONS.md                  # Architecture Decision Record
├── README.md
├── package.json
└── vite.config.js
```

---

## Testing

**Manual test checklist**
- [ ] Embedding model downloads and loads successfully
- [ ] LLM downloads, loads, and generates coherent responses
- [ ] PDF upload extracts text, creates chunks, and generates embeddings
- [ ] RAG chat retrieves relevant context and incorporates it into answers
- [ ] Toggle RAG mode off – chat still works without context
- [ ] Offline mode: disable network in DevTools → app loads and AI works
- [ ] PWA installation: app installs and opens in standalone window
- [ ] Audio recording: microphone permission, recording, transcription
- [ ] Vector store persists across page reloads
- [ ] Storage management: clear vectors, clear all data
- [ ] Error handling: try chatting without loading models → meaningful error shown

**Performance benchmarks** (M1 Mac, Chrome, 50 Mbps)

| Metric | Value |
|---|---|
| First Contentful Paint | < 1.5 s |
| Embedding model download | ~ 30 s |
| LLM download | 2 – 5 min |
| Embedding generation (per 500‑char chunk) | ~ 50 ms |
| RAG query (search + generation) | 2 – 5 s |
| Memory (all models loaded) | ~ 2 GB |

---

## Privacy & Security
* **No telemetry** – The app does not collect any usage data.
* **No data leaves your device** – Documents, conversations, and vectors stay in your browser’s storage.
* **Model integrity** – Models are fetched from HuggingFace with pinned revisions.
* **Strict CSP** – Content Security Policy prevents cross‑site scripting.
* **Storage isolation** – OPFS is origin‑scoped; other websites cannot access your data.

---

## Roadmap
- [ ] WebGPU acceleration – 3‑5× faster LLM inference
- [ ] HNSW index – Sub‑linear vector search for larger document sets
- [ ] Multi‑language Whisper – Support for non‑English audio
- [ ] Conversation export – Export chats as JSON / Markdown
- [ ] LoRA fine‑tuning – Customise the LLM directly in the browser
- [ ] Collaborative RAG – Shared vector stores via CRDTs

See the open issues for a full list of proposed features.

---

## Contributing

Contributions are what make the open source community amazing.
If you have a suggestion, please fork the repo and create a pull request, or open an issue.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: add AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License
Distributed under the MIT License. See `LICENSE` for more information.

---

## Acknowledgments
* [Transformers.js](https://github.com/xenova/transformers.js) by Joshua Lochner
* [Dexie.js](https://dexie.org/) – a wonderful IndexedDB wrapper
* [pdfjs-dist](https://mozilla.github.io/pdf.js/) by Mozilla
* [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
* The amazing Hugging Face community for open models

---

## Contact
Mohamed Laroussi Gabsi – gabsimedlaroussi21@gmail.com

Project Link: [https://github.com/Medgabsi99/local-ai-assistant](https://github.com/Medgabsi99/local-ai-assistant)

---
<!-- MARKDOWN LINKS & IMAGES -->
[license-shield]: https://img.shields.io/github/license/Medgabsi99/local-ai-assistant.svg?style=for-the-badge
[license-url]: https://github.com/Medgabsi99/local-ai-assistant/blob/main/LICENSE
[pwa-shield]: https://img.shields.io/badge/PWA-Ready-blueviolet?style=for-the-badge&logo=pwa
[pwa-url]: https://github.com/Medgabsi99/local-ai-assistant
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=0077B5
[linkedin-url]: https://www.linkedin.com/in/mohamed-laroussi-gabsi-6b8397240/
