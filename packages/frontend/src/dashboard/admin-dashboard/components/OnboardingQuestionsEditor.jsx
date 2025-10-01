import React from 'react';

const OnboardingQuestionsEditor = ({ value, onChange }) => {
  return (
    <div className="md:col-span-3">
      <label htmlFor="edit_default_onboarding_questions" className="block text-sm font-medium text-gray-700">Onboarding Questions (JSON)</label>
      <p className="mt-1 text-xs text-gray-500">
        Define the questions asked to new visitors to collect their preferences and qualify leads. Includes typology, budget, timeframe, and contact information.
      </p>
      <textarea
        name="default_onboarding_questions"
        id="edit_default_onboarding_questions"
        value={value}
        onChange={onChange}
        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono"
        rows="15"
      ></textarea>
    </div>
  );
};

export default OnboardingQuestionsEditor;