# Customized Messaging Portal & AI Voice System

**A full-stack, enterprise-grade communication hub built for handling multi-line SMS and AI-driven voice interactions.**

> **Status:** Active / Production  
> **Tech Stack:** Node.js, Express, MongoDB, Telnyx API, Vapi.ai, EJS

---

## 📖 Overview

This project is a custom-built **PBX & SMS Dashboard** designed to replace expensive, limited tools like RingCentral or Zapier. It provides a real-time web interface for sending and receiving SMS across multiple international phone lines and integrates with **Vapi.ai** to handle inbound voice calls using fully autonomous AI agents.

Unlike standard VoIP apps, this system supports **AI Tool Calling**, allowing the Voice Agent to book appointments directly into the database during a conversation.

## 🚀 Key Features

### 📨 SMS Command Center
- **Multi-Line Support:** Send messages from specific "Identities" (e.g., Hungarian Main, US Sales Line).
- **Real-Time Inbox:** Instant message delivery using Webhooks (no polling).
- **Contact Management:** Automatically saves and labels new client numbers.
- **Message Logging:** Permanent history of all inbound/outbound communications stored in MongoDB.

### 🤖 AI Voice Agents (Vapi.ai Integration)
- **Intelligent Call Routing:** Handles calls differently based on the dialed extension (e.g., Hungarian vs. English).
- **Automated Booking:** AI can perform "Tool Calls" to check availability and book appointments directly in the system.
- **Call Summaries:** Post-call transcripts and audio recordings are automatically pushed to the dashboard.

### 🛡️ Architecture
- **Self-Hosted:** Designed for VPS deployment (Contabo/DigitalOcean) for full data ownership.
- **Secure:** Environment-variable based configuration for API keys.
- **Scalable:** Built on Node.js non-blocking I/O to handle high concurrency.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose)
- **Frontend:** EJS Templating, Bootstrap 5
- **Telephony API:** Telnyx (SMS & SIP)
- **AI Voice:** Vapi.ai (LLM + TTS integration)
- **Process Management:** PM2

---

## ⚙️ Installation & Setup

### 1. Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas)
- Telnyx Account (for SMS)
- Vapi.ai Account (for Voice)

### 2. Clone the Repository
```bash
git clone [https://github.com/zenvila/Customized-Messaging-portal.git](https://github.com/zenvila/Customized-Messaging-portal.git)
cd Customized-Messaging-portal
