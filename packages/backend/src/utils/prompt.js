// Simple prompt templating with brace-escaping safety

export function renderTemplate(template, variables) {
  if (!template) return '';
  let output = String(template);
  // Escape single braces that could be mistaken
  // We only replace explicit {var} placeholders
  for (const key of Object.keys(variables)) {
    const placeholder = new RegExp(`\\{${escapeRegExp(key)}\\}`, 'g');
    output = output.replace(placeholder, variables[key] ?? '');
  }
  return output;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


