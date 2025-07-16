# Product Description

## Overview
This project is an enterprise-grade RAG (Retrieval-Augmented Generation) chatbot. It is designed to be embedded into other web applications to provide contextual assistance and answer user questions based on a specialized knowledge base.

## Problem Solved
The chatbot solves the problem of providing instant, accurate, and context-aware support to users within a specific application. Instead of generic answers, it leverages a vector database (Pinecone) to retrieve relevant information from a knowledge base and uses a powerful generative model (Google Gemini) to formulate answers. This allows for a more "intelligent" and helpful user experience.

## Core Functionality
- **RAG Pipeline:** The core of the application is a Node.js backend service that implements a RAG pipeline.
  - It receives a user query.
  - Generates a vector embedding of the query.
  - Queries a Pinecone vector database to find relevant text chunks.
  - Constructs a detailed prompt including the original query and the retrieved context.
  - Sends the prompt to the Google Gemini model to generate a natural language response.
- **Frontend Chat Widget:** A React-based frontend provides a simple and clean user interface for the chat functionality. It displays the conversation history and sends user messages to the backend.
- **Context-Aware Interactions:** The chatbot is designed to receive external context from the parent application where it is embedded. This context (e.g., product details, user information) is passed to the backend and included in the prompt to the language model, allowing the chatbot's responses to be tailored to the user's current activity in the parent application.

## User Experience Goals
- Provide fast and accurate answers to user queries.
- Ensure responses are grounded in the provided knowledge base.
- Offer a seamless and intuitive chat interface.
- Be contextually aware of the user's current state in the embedding application to provide more relevant and helpful information.