import React from 'react';

const QuestionTemplatesEditor = ({ value, onChange }) => {
  return (
    <div className="md:col-span-3">
      <label htmlFor="edit_question_templates" className="block text-sm font-medium text-gray-700">Question Templates (JSON)</label>
      <p className="mt-1 text-xs text-gray-500">
        Define the fallback question templates used when AI generation fails. Organized by context type and engagement level for personalized user experiences.
      </p>
      <textarea
        name="question_templates"
        id="edit_question_templates"
        value={value}
        onChange={onChange}
        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono"
        rows="20"
      ></textarea>
    </div>
  );
};

export default QuestionTemplatesEditor;