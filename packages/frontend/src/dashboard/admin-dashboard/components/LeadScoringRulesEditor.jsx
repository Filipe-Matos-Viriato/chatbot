import React from 'react';

const LeadScoringRulesEditor = ({ value, onChange }) => {
  return (
    <div className="md:col-span-3">
      <label htmlFor="edit_lead_scoring_rules" className="block text-sm font-medium text-gray-700">Lead Scoring Rules (JSON)</label>
      <textarea
        name="lead_scoring_rules"
        id="edit_lead_scoring_rules"
        value={value}
        onChange={onChange}
        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono"
        rows="10"
      ></textarea>
    </div>
  );
};

export default LeadScoringRulesEditor;