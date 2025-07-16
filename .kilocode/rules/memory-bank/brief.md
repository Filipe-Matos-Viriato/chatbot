# Project Brief

## Project Goal
To develop a sophisticated, enterprise-grade RAG (Retrieval-Augmented Generation) chatbot that can be seamlessly embedded into other web applications. The primary goal is to provide users with instant, accurate, and contextually-aware support by leveraging a specialized knowledge base.

## Core Problem
This project addresses the need for intelligent, in-app support that goes beyond generic, pre-scripted answers. By using a RAG pipeline, the chatbot can provide responses that are grounded in a specific domain's knowledge, making it a more valuable and reliable tool for users.

## High-Level Requirements
- **Monorepo Architecture:** The project is structured as a monorepo with a Node.js backend and a React frontend to streamline development and dependency management.
- **RAG Pipeline:** The backend must implement a robust RAG pipeline utilizing:
    - **LLM:** Google's Gemini series for response generation.
    - **Embedding Model:** Google's `text-embedding-004` for vectorizing queries.
    - **Vector Database:** Pinecone for efficient, scalable storage and retrieval of knowledge base vectors.
- **Embeddable Frontend:** The React-based frontend must be designed as a clean, intuitive chat widget that can be easily embedded into other web applications using an `<iframe>`.
- **Context-Awareness:** The chatbot must be able to receive and utilize external context (e.g., user data, application state) from the parent webpage to provide more relevant and personalized responses. This communication is handled securely via the `postMessage` API.
- **Stable Development Environment:** A key focus is to maintain a stable and predictable development environment, resolving persistent issues like port conflicts to ensure smooth development and testing cycles.

markdown



Please review this text and, once you are satisfied, add it to the .kilocode/rules/memory-bank/brief.md file. As per the instructions, this file is the source of truth for the project, and having it complete will greatly improve our future interactions.