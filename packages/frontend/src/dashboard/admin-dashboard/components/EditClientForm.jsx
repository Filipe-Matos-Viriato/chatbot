import React from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../../../config/apiClient';
import DocumentExtractionEditor from './DocumentExtractionEditor';
import ChunkingRulesEditor from './ChunkingRulesEditor';
import TaggingRulesEditor from './TaggingRulesEditor';
import UrlPatternEditor from './UrlPatternEditor';
import PromptsEditor from './PromptsEditor';
import ChatHistoryTaggingRulesEditor from './ChatHistoryTaggingRulesEditor';
import LeadScoringRulesEditor from './LeadScoringRulesEditor';
import OnboardingQuestionsEditor from './OnboardingQuestionsEditor';
import EmbedScriptGenerator from './EmbedScriptGenerator';

const EditClientForm = ({ editingClient, editFormData, setEditFormData, setEditingClient, fetchClients, setError }) => {
  const navigate = useNavigate();

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormData({ ...editFormData, [name]: value });
  };

  const handleUpdateClient = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = { ...editFormData };
      const jsonFields = ['document_extraction', 'chunking_rules', 'tagging_rules', 'prompts', 'chat_history_tagging_rules', 'lead_scoring_rules', 'default_onboarding_questions'];

      for (const field of jsonFields) {
        if (dataToSend[field]) {
          // The 'default_onboarding_questions' field is already an object, not a string.
          // The other fields are stringified JSON from their respective editors.
          if (field !== 'default_onboarding_questions') {
            try {
              dataToSend[field] = JSON.parse(dataToSend[field]);
            } catch (jsonError) {
              setError(new Error(`Invalid JSON for ${field.replace(/([A-Z])/g, ' $1').trim()}. Please correct it.`));
              return;
            }
          }
        } else {
          dataToSend[field] = null;
        }
      }

      await axios.put(`${API_BASE_URL}/v1/clients/${editingClient.client_id}`, dataToSend);
      setEditingClient(null);
      fetchClients();
      setError(null);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="mt-8 p-4 border rounded shadow-sm bg-white">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Edit Client: {editingClient.client_name}</h3>
        <button
          type="button"
          onClick={() => navigate(`/admin/document-upload/${editingClient.client_id}`)}
          className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
        >
          Upload Documents
        </button>
      </div>
      <form onSubmit={handleUpdateClient} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="edit_client_name" className="block text-sm font-medium text-gray-700">Client Name</label>
          <input
            type="text"
            name="client_name"
            id="edit_client_name"
            value={editFormData.client_name}
            onChange={handleEditFormChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div>
          <label htmlFor="edit_chatbot_name" className="block text-sm font-medium text-gray-700">Chatbot Name</label>
          <input
            type="text"
            name="chatbot_name"
            id="edit_chatbot_name"
            value={editFormData.chatbot_name}
            onChange={handleEditFormChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div>
          <label htmlFor="edit_client_id" className="block text-sm font-medium text-gray-700">Client ID</label>
          <input
            type="text"
            name="client_id"
            id="edit_client_id"
            value={editFormData.client_id}
            onChange={handleEditFormChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            disabled
          />
        </div>
        <DocumentExtractionEditor
          value={editFormData.document_extraction}
          onChange={handleEditFormChange}
        />
        <ChunkingRulesEditor
          value={editFormData.chunking_rules}
          onChange={handleEditFormChange}
        />
        <TaggingRulesEditor
          value={editFormData.tagging_rules}
          onChange={handleEditFormChange}
        />
        <UrlPatternEditor
          value={editFormData.url_pattern}
          onChange={handleEditFormChange}
        />
        <PromptsEditor
          value={editFormData.prompts}
          onChange={handleEditFormChange}
        />
        <ChatHistoryTaggingRulesEditor
          value={editFormData.chat_history_tagging_rules}
          onChange={handleEditFormChange}
        />
        <LeadScoringRulesEditor
          value={editFormData.lead_scoring_rules}
          onChange={handleEditFormChange}
        />
        <OnboardingQuestionsEditor
          value={editFormData.default_onboarding_questions}
          onChange={handleEditFormChange}
        />
        <EmbedScriptGenerator
          clientId={editFormData.client_id}
          clientName={editFormData.client_name}
        />
        <div className="md:col-span-3 flex justify-end items-center">
          <button
            type="button"
            onClick={() => setEditingClient(null)}
            className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 mr-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            Update Client
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditClientForm;