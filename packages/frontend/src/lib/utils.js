/* packages/frontend/src/lib/utils.js */
/* Defines utility functions for the React application, including class name merging for Tailwind CSS. */
/* This file exists to provide common helper functions that can be reused across components. */
/* packages/frontend/src/index.css, packages/frontend/src/App.jsx, packages/frontend/src/dashboard/Dashboard.jsx, packages/frontend/src/chatbot/ChatInterface.jsx */

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
