# 📅 Calendar frontend

> A modern, privacy-first calendar frontend with EteSync and CalDAV support.

![Status](https://img.shields.io/badge/status-work%20in%20progress-orange)
![React](https://img.shields.io/badge/React-18-blue?logo=react)
![Vite](https://img.shields.io/badge/Vite-5-purple?logo=vite)

## ✨ Features
- Create, edit and delete calendars and events
- Color-coded calendars with custom color picker
- End-to-end encrypted sync via **EteSync**
- CalDAV support via **Radicale** *(planned)*
- EteSync ↔ CalDAV bridge for Calendar compatibility *(planned)*
- Responsive layout

## 🛠️ Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | TailwindCSS + DaisyUI |
| Sync (E2E) | Etebase (EteSync SDK) |
| Sync (CalDAV) | Radicale *(planned)* |

## 🚀 Getting Started

```bash
npm install
npm run dev
```

## 📌 Roadmap
- [x] Calendar & event management
- [x] EteSync sync
- [ ] CalDAV / Radicale integration
- [ ] Google Calendar bridge
- [ ] Mobile view
