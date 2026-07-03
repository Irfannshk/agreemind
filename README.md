# AgreeMind

A local-first legal intelligence dashboard. Built for the Imagine Hackathon.

![Dashboard Preview](./assets/dashboard.png)

## What is this?
Reading legal contracts sucks, especially for freelancers and small businesses who don't have lawyers on retainer. But pasting sensitive, confidential NDAs or leases into ChatGPT is a massive privacy risk. 

I built AgreeMind to solve this. It's a full-stack dashboard that parses contracts, flags risks, and extracts payment deadlines—but it runs the LLM (Llama 3.2) entirely locally on your machine via Ollama. Zero data leaves your computer.

## Features
- **100% Local AI:** No OpenAI API keys, no cloud data leaks.
- **Smart Parsing:** Handles PDFs, DOCX, and raw text formats.
- **Automated Extraction:** Pulls out key clauses, risk levels, and 3-sentence executive summaries.
- **Deadline Aggregator:** Finds renewal and payment dates and pins them to an alert board.
- **Agentic Chat:** A global AI assistant that can actually execute database updates in Supabase through natural language.

## Tech Stack
- **Frontend:** React, Tailwind CSS v4, Recharts
- **Backend:** Node.js, Express, Supabase (PostgreSQL)
- **AI:** Ollama (Llama 3.2 2B)
- **File Parsing:** pdf2json, mammoth

## How to run locally
You will need Node.js and Ollama installed. 

First, pull the model:
`ollama pull llama3.2`

Then start the backend:
```bash
cd server
npm install
node index.js
