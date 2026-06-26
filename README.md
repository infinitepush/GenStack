# 🚀 GenStack

<h3 align="center">
Build Full-Stack Applications from Natural Language
</h3>

<p align="center">
An AI-powered platform that transforms plain English into production-ready internal business applications using a configuration-driven runtime engine.
</p>

<p align="center">

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Express](https://img.shields.io/badge/Express.js-Backend-000000?logo=express)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-38BDF8?logo=tailwindcss)
![Google Gemini](https://img.shields.io/badge/Google-Gemini-4285F4?logo=google)


</p>

---

# ✨ Overview

GenStack is an AI-powered application generation platform that converts natural language into fully functional internal business applications.

Instead of manually building database schemas, REST APIs, forms, dashboards, authentication, and administrative interfaces, users simply describe the application they need.

GenStack uses Google Gemini to generate a structured application configuration, validates and normalizes it, and renders a complete application through a dynamic runtime engine.

The project demonstrates modern full-stack engineering by combining AI, runtime rendering, backend architecture, authentication, integrations, data management, analytics, and deployment tooling into one platform.

---

# 🎯 Why GenStack?

Building internal business software typically requires creating:

* Database schemas
* Backend APIs
* CRUD interfaces
* Forms & validation
* Data tables
* Dashboards
* Authentication
* Analytics
* Localization
* Administrative tools

GenStack automates much of this workflow by generating configuration instead of source code, allowing applications to be rendered dynamically through a reusable runtime engine.

---

# ✨ Features

## 🤖 AI Studio

* Generate applications from natural language
* AI-powered configuration generation
* Configuration validation & repair
* Prompt history

## ⚙ Runtime Engine

* Dynamic routing
* Dynamic page rendering
* Forms & tables
* CRUD operations
* Dashboard generation
* Analytics widgets

## 🛠 Configuration System

* Live configuration editor
* Runtime updates
* Validation
* Version history
* Runtime Inspector

## 📊 Data Management

* Dynamic schema rendering
* Runtime database operations
* CSV import
* Intelligent field mapping
* Record management

## 🌍 Internationalization

* Translation Manager
* Multi-language support
* Localization export

## 🔐 Authentication

* Credentials authentication
* GitHub OAuth
* Protected routes
* Session management

## 🔌 Integrations

* Google Sheets
* Slack Webhooks
* Custom Webhooks

## 📦 Export

* GitHub Repository Export
* ZIP Export
* JSON Configuration Export

---

# 🎬 Application Generation Flow

```text
Natural Language Prompt
          │
          ▼
    Google Gemini AI
          │
          ▼
Configuration Generation
          │
          ▼
Validation & Normalization
          │
          ▼
Configuration Runtime
          │
     ┌────┴────┐
     ▼         ▼
 Next.js    Express API
 Frontend     Backend
     └────┬────┘
          ▼
     Prisma ORM
          ▼
      Database
```

---

# 🏗 System Architecture

```text
                  User
                   │
                   ▼
          Natural Language Prompt
                   │
                   ▼
             Google Gemini AI
                   │
                   ▼
      Configuration Generation
                   │
                   ▼
      Validation & Normalization
                   │
                   ▼
        Runtime Configuration
          ┌────────┴────────┐
          ▼                 ▼
   Next.js Runtime      Express API
          │                 │
          └────────┬────────┘
                   ▼
              Prisma ORM
                   ▼
               Database
```

---

# 🛠 Tech Stack

### Frontend

* Next.js 14
* React 18
* TypeScript
* Tailwind CSS
* NextAuth.js

### Backend

* Node.js
* Express.js
* Prisma ORM
* Zod

### AI

* Google Gemini

### Database

* Prisma-based persistence layer

### Deployment

* Vercel
* Render

---

# 📂 Project Structure

```text
GenStack
│
├── apps
│   ├── api
│   └── web
│
├── packages
│   └── config-types
│
├── configs
│
├── docs
│
└── README.md
```

---

# 🚀 Getting Started

## Clone the Repository

```bash
git clone https://github.com/your-username/GenStack.git
cd GenStack
```

## Install Dependencies

```bash
npm install
```

## Configure Environment Variables

Create a `.env` file.

```env
DATABASE_URL=

NEXTAUTH_SECRET=

NEXTAUTH_URL=

GOOGLE_API_KEY=
```

## Start the Development Server

```bash
npm run dev
```

---

# 🚀 Future Roadmap

* Runtime Theme Builder
* Multi-tenant Workspaces
* Docker Export
* Plugin SDK
* Workflow Automation
* Runtime Template Marketplace
* Advanced AI Agents

---

# 👨‍💻 About

GenStack is my flagship full-stack engineering project focused on AI-assisted software generation and configuration-driven application development.

Rather than generating static code, GenStack demonstrates how modern AI can power an entire application lifecycle—from natural language input and configuration generation to validation, runtime rendering, authentication, integrations, exports, and operational tooling.

The project showcases expertise in:

* Full-stack development
* AI integration
* Backend architecture
* Runtime systems
* Database design
* Authentication
* Developer experience
* Scalable SaaS engineering

---

<p align="center">

⭐ **If you found this project interesting, consider giving it a star!**

Built with ❤️ using **Next.js**, **Express.js**, **Prisma**, and **Google Gemini**

</p>
