import React, { useState } from 'react';

const OnboardingQuestionsEditor = ({ value, onChange }) => {
  const [isJsonView, setIsJsonView] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [lastValidatedValue, setLastValidatedValue] = useState('');

  // Default Portuguese onboarding questions template
  const defaultTemplate = {
    "questions": [
      {
        "id": "tipologia",
        "type": "multiple_choice",
        "question": "Que tipo de imóvel procura?",
        "options": [
          { "value": "T0", "label": "T0 - Estúdio" },
          { "value": "T1", "label": "T1 - 1 Quarto" },
          { "value": "T2", "label": "T2 - 2 Quartos" },
          { "value": "T3", "label": "T3 - 3 Quartos" },
          { "value": "T4+", "label": "T4+ - 4 ou mais Quartos" },
          { "value": "moradia", "label": "Moradia" },
          { "value": "comercial", "label": "Comercial" }
        ],
        "required": true
      },
      {
        "id": "orcamento",
        "type": "range_select",
        "question": "Qual o seu orçamento?",
        "options": [
          { "value": "<150k", "label": "Até 150.000€" },
          { "value": "150k-300k", "label": "150.000€ - 300.000€" },
          { "value": "300k-500k", "label": "300.000€ - 500.000€" },
          { "value": "500k-750k", "label": "500.000€ - 750.000€" },
          { "value": ">750k", "label": "Mais de 750.000€" }
        ],
        "required": true
      },
      {
        "id": "objetivo",
        "type": "multiple_choice",
        "question": "Qual o objetivo da compra?",
        "options": [
          { "value": "habitacao", "label": "Habitação Própria" },
          { "value": "investimento", "label": "Investimento" },
          { "value": "ambos", "label": "Ambos" }
        ],
        "required": true
      },
      {
        "id": "prazo",
        "type": "multiple_choice",
        "question": "Em que prazo pretende comprar?",
        "options": [
          { "value": "imediato", "label": "Imediatamente" },
          { "value": "3-6meses", "label": "3-6 meses" },
          { "value": "6-12meses", "label": "6-12 meses" },
          { "value": "+12meses", "label": "Mais de 12 meses" }
        ],
        "required": true
      },
      {
        "id": "localizacao",
        "type": "text_input",
        "question": "Onde prefere que seja localizado o imóvel? (Concelho, Distrito)",
        "placeholder": "Ex: Lisboa, Porto, Cascais...",
        "required": false
      },
      {
        "id": "caracteristicas",
        "type": "multiple_select",
        "question": "Que características considera importantes?",
        "options": [
          { "value": "varanda", "label": "Varanda/Terraço" },
          { "value": "garagem", "label": "Garagem" },
          { "value": "elevador", "label": "Elevador" },
          { "value": "piscina", "label": "Piscina" },
          { "value": "jardim", "label": "Jardim" },
          { "value": "vista_mar", "label": "Vista Mar" },
          { "value": "centro_cidade", "label": "Centro da Cidade" },
          { "value": "transportes", "label": "Perto de Transportes" }
        ],
        "required": false
      }
    ],
    "settings": {
      "completion_message": "Obrigado! Com base nas suas preferências, posso agora ajudá-lo a encontrar o imóvel perfeito.",
      "skip_option": "Continuar sem responder",
      "title": "Ajude-nos a encontrar o seu imóvel ideal",
      "subtitle": "Responda a algumas perguntas para recebermos recomendações personalizadas"
    }
  };

  // Only use default template if value is null/undefined, allow empty string
  const currentValue = (value === null || value === undefined) ? JSON.stringify(defaultTemplate, null, 2) : value;

  const handleJsonChange = (e) => {
    const newValue = e.target.value;
    // Clear validation result when content changes after validation
    if (lastValidatedValue && newValue !== lastValidatedValue) {
      setValidationResult(null);
      setLastValidatedValue('');
    }
    onChange({ target: { name: 'default_onboarding_questions', value: newValue } });
  };

  const loadDefaultTemplate = () => {
    const templateJson = JSON.stringify(defaultTemplate, null, 2);
    setValidationResult(null);
    setLastValidatedValue('');
    onChange({ target: { name: 'default_onboarding_questions', value: templateJson } });
  };

  const validateTemplate = () => {
    try {
      const parsed = JSON.parse(currentValue);
      
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        return 'Template must have a questions array';
      }

      if (!parsed.settings || typeof parsed.settings !== 'object') {
        return 'Template must have a settings object';
      }

      for (let i = 0; i < parsed.questions.length; i++) {
        const question = parsed.questions[i];
        if (!question.id || !question.question || !question.type) {
          return `Question ${i + 1} is missing required fields (id, question, type)`;
        }

        const validTypes = ['multiple_choice', 'multiple_select', 'text_input', 'range_select'];
        if (!validTypes.includes(question.type)) {
          return `Question ${i + 1} has invalid type: ${question.type}`;
        }

        if (question.type !== 'text_input' && (!question.options || !Array.isArray(question.options))) {
          return `Question ${i + 1} with type ${question.type} must have options array`;
        }
      }

      return null;
    } catch (error) {
      return 'Invalid JSON syntax';
    }
  };

  const handleManualValidation = () => {
    const error = validateTemplate();
    setValidationResult({
      isValid: !error,
      message: error || 'Template is valid!',
      timestamp: new Date().toLocaleTimeString()
    });
    setLastValidatedValue(currentValue);
  };

  const clearAllContent = () => {
    setValidationResult(null);
    setLastValidatedValue('');
    onChange({ target: { name: 'default_onboarding_questions', value: '' } });
  };

  return (
    <div className="grid-item">
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium text-gray-700">
          Onboarding Questions Template
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleManualValidation}
            className="text-xs bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
          >
            Validate Template
          </button>
          <button
            type="button"
            onClick={loadDefaultTemplate}
            className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
          >
            Load Default Template
          </button>
          <button
            type="button"
            onClick={() => setIsJsonView(!isJsonView)}
            className="text-xs bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600"
          >
            {isJsonView ? 'Visual Preview' : 'JSON Editor'}
          </button>
        </div>
      </div>

      {!isJsonView ? (
        <div className="space-y-4">
          {/* Validation Results */}
          {validationResult && (
            <div className={`text-sm p-3 border rounded ${
              validationResult.isValid 
                ? 'text-green-700 bg-green-50 border-green-200' 
                : 'text-red-700 bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <span>{validationResult.isValid ? '✅' : '⚠️'} {validationResult.message}</span>
                <span className="text-xs opacity-75">Validated at {validationResult.timestamp}</span>
              </div>
            </div>
          )}
          
          {/* Visual Preview */}
          <div className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Preview</h3>
            <OnboardingPreview template={currentValue} />
          </div>
          <div className="text-sm text-gray-600">
            <p className="mb-2"><strong>Supported Question Types:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li><code>multiple_choice</code> - Single selection from options</li>
              <li><code>multiple_select</code> - Multiple selections from options</li>
              <li><code>range_select</code> - Single selection for ranges (e.g., price)</li>
              <li><code>text_input</code> - Free text input</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Validation Results */}
          {validationResult && (
            <div className={`text-sm p-3 border rounded ${
              validationResult.isValid 
                ? 'text-green-700 bg-green-50 border-green-200' 
                : 'text-red-700 bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <span>{validationResult.isValid ? '✅' : '⚠️'} {validationResult.message}</span>
                <span className="text-xs opacity-75">Validated at {validationResult.timestamp}</span>
              </div>
            </div>
          )}
          
          <div className="relative">
            <textarea
              name="default_onboarding_questions"
              value={currentValue}
              onChange={handleJsonChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 font-mono text-sm"
              rows={20}
              placeholder="Enter onboarding questions configuration in JSON format"
            />
            <button
              type="button"
              onClick={clearAllContent}
              className="absolute top-2 right-2 text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
              title="Clear all content"
            >
              Clear All
            </button>
          </div>
          
          <div className="text-sm text-gray-600">
            <p>💡 <strong>Tip:</strong> Edit freely without syntax restrictions. Use "Clear All" to start fresh, then paste your JSON. Click "Validate Template" when ready to check your configuration.</p>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600 border-t pt-4">
        <p><strong>Template Variables Available:</strong></p>
        <p>The onboarding answers will be automatically formatted and passed to the chatbot as structured preferences for personalized recommendations.</p>
      </div>
    </div>
  );
};

// Component to preview the onboarding questions
const OnboardingPreview = ({ template }) => {
  let parsedTemplate;
  
  // Try to parse the template if it's a string
  try {
    parsedTemplate = typeof template === 'string' ? JSON.parse(template) : template;
  } catch (error) {
    return (
      <div className="text-gray-500 text-center py-8">
        <p>Unable to preview - invalid JSON format</p>
        <p className="text-xs mt-2">Click "Validate Template" to check for specific errors</p>
      </div>
    );
  }

  if (!parsedTemplate || !parsedTemplate.questions) {
    return <div className="text-gray-500">No questions configured</div>;
  }

  return (
    <div className="space-y-4">
      {/* Settings Preview */}
      <div className="bg-white p-4 rounded border border-gray-200">
        <h4 className="font-semibold text-blue-600">{parsedTemplate.settings?.title || 'Onboarding Title'}</h4>
        <p className="text-sm text-gray-600 mt-1">{parsedTemplate.settings?.subtitle || 'Onboarding subtitle'}</p>
      </div>

      {/* Questions Preview */}
      {parsedTemplate.questions.map((question, index) => (
        <div key={question.id || index} className="bg-white p-4 rounded border border-gray-200">
          <h5 className="font-medium text-gray-800 mb-2">
            {question.question}
            {question.required && <span className="text-red-500">*</span>}
          </h5>
          <div className="text-sm text-gray-600 mb-2">
            Type: <code className="bg-gray-100 px-1 rounded">{question.type}</code>
          </div>
          
          {question.type === 'text_input' ? (
            <input
              type="text"
              placeholder={question.placeholder || ''}
              className="w-full p-2 border border-gray-300 rounded text-sm"
              disabled
            />
          ) : question.options ? (
            <div className="space-y-1">
              {question.options.slice(0, 3).map((option, optIndex) => (
                <div key={optIndex} className="flex items-center text-sm">
                  <input
                    type={question.type === 'multiple_select' ? 'checkbox' : 'radio'}
                    disabled
                    className="mr-2"
                  />
                  <span>{option.label}</span>
                </div>
              ))}
              {question.options.length > 3 && (
                <div className="text-xs text-gray-500 italic">
                  ... and {question.options.length - 3} more options
                </div>
              )}
            </div>
          ) : (
            <div className="text-red-500 text-sm">No options configured</div>
          )}
        </div>
      ))}

      {/* Completion Message Preview */}
      <div className="bg-green-50 p-4 rounded border border-green-200">
        <div className="text-sm text-green-800">
          <strong>Completion Message:</strong> {parsedTemplate.settings?.completion_message}
        </div>
        <div className="text-sm text-gray-600 mt-1">
          <strong>Skip Option:</strong> {parsedTemplate.settings?.skip_option}
        </div>
      </div>
    </div>
  );
};

export default OnboardingQuestionsEditor;