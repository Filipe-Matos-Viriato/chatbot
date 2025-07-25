import React from 'react';

const ChatHistoryTaggingRulesEditor = ({ value, onChange }) => {
  return (
    <div className="md:col-span-3">
      <label htmlFor="edit_chat_history_tagging_rules" className="block text-sm font-medium text-gray-700">Chat History Tagging Rules (JSON)</label>
      <textarea
        name="chat_history_tagging_rules"
        id="edit_chat_history_tagging_rules"
        value={value}
        onChange={onChange}
        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono"
        rows="10"
      ></textarea>
    </div>
  );
};

export default ChatHistoryTaggingRulesEditor;