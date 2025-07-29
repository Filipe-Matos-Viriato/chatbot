import React, { useState, useEffect } from 'react';

const PromptsEditor = ({ value, onChange }) => {
  const [systemInstruction, setSystemInstruction] = useState('');
  const [fallbackResponse, setFallbackResponse] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [jsonValue, setJsonValue] = useState('');

  // Parse JSON value into separate fields
  useEffect(() => {
    if (value) {
      try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        setSystemInstruction(parsed.systemInstruction || '');
        setFallbackResponse(parsed.fallbackResponse || '');
        setJsonValue(JSON.stringify(parsed, null, 2));
      } catch (error) {
        console.error('Error parsing prompts JSON:', error);
        setJsonValue(value || '');
      }
    } else {
      setSystemInstruction('');
      setFallbackResponse('');
      setJsonValue('');
    }
  }, [value]);

  // Update parent component when fields change
  const updateParent = (newSystemInstruction, newFallbackResponse) => {
    const promptsObject = {
      systemInstruction: newSystemInstruction,
      fallbackResponse: newFallbackResponse
    };
    
    const jsonString = JSON.stringify(promptsObject, null, 2);
    setJsonValue(jsonString);
    
    // Create synthetic event to match expected onChange format
    const syntheticEvent = {
      target: {
        name: 'prompts',
        value: jsonString
      }
    };
    onChange(syntheticEvent);
  };

  const handleSystemInstructionChange = (e) => {
    const newValue = e.target.value;
    setSystemInstruction(newValue);
    updateParent(newValue, fallbackResponse);
  };

  const handleFallbackResponseChange = (e) => {
    const newValue = e.target.value;
    setFallbackResponse(newValue);
    updateParent(systemInstruction, newValue);
  };

  const handleJsonChange = (e) => {
    const newValue = e.target.value;
    setJsonValue(newValue);
    
    // Try to parse and update individual fields
    try {
      const parsed = JSON.parse(newValue);
      setSystemInstruction(parsed.systemInstruction || '');
      setFallbackResponse(parsed.fallbackResponse || '');
    } catch (error) {
      // Invalid JSON, but keep the raw value
    }
    
    const syntheticEvent = {
      target: {
        name: 'prompts',
        value: newValue
      }
    };
    onChange(syntheticEvent);
  };

  const loadTemplate = () => {
    const template = `You are a helpful assistant for the real estate agency '[AGENCY_NAME]'. You represent a company focused on the '[PROJECT_NAME]' development in [LOCATION].

## PROJECT CONTEXT:
- **Location**: [DESCRIBE_LOCATION]
- **Structure**: [DESCRIBE_STRUCTURE]
- **Available Types**: [LIST_PROPERTY_TYPES]
- **Features**: [KEY_FEATURES]

## CONVERSATION DATA:
**User Preferences**: {onboardingAnswers}
**Chat History**: {chatHistory}
**Document Context**: {context}
**Current Question**: {question}

## MAIN INSTRUCTIONS:

### 1. **INTELLIGENT CONTEXTUAL UNDERSTANDING**:
- Analyze natural conversation flow without rigid patterns
- When users refer to "this apartment", "that unit", understand from history
- Detect implicit intentions and requests for elaboration
- Use specific apartment information (prices, areas, divisions)

### 2. **PROGRESSIVE INFORMATION DISCLOSURE**:
Never repeat exactly the same information:
- **1st Interaction**: Basic info (price, area, type, location)
- **2nd Interaction**: Technical details (rooms, areas, finishes)
- **3rd Interaction**: Investment context (appreciation, financing)
- **4th+ Interactions**: Unique advantages, comparisons, visit scheduling

### 3. **INTELLIGENT DATA USAGE**:
- **Specific Prices**: Mention exact apartment prices
- **Detailed Areas**: Provide specific private areas
- **Room Breakdown**: Describe rooms with individual areas
- **Technical Features**: Equipped kitchens, garages, storage, double glazing

### 4. **CONVERSATION STAGE AWARENESS**:
- **Initial Discovery**: General presentation and interest generation
- **Demonstrated Interest**: Specific apartments with precise technical details
- **Advanced Consideration**: Financing, purchase process, visit scheduling
- **Decision**: Facilitate direct contact, concrete next steps

### 5. **DYNAMIC RESPONSE ADAPTATION**:
- Respond based on demonstrated interest and knowledge level
- Adjust technical language according to question sophistication
- Identify investor vs. own residence users
- Adapt call-to-actions to identified profile

## FORMATTING GUIDELINES:
- **Bold** for key information (prices, areas, types)
- **Bullet points (•)** for features and lists
- **Organized sections** for complex responses
- **Contextual call-to-action** in each response

## BRAND PERSONALITY:
- Professional but accessible
- Technical expertise combined with transparency
- Solution-oriented and next-step focused
- Representative of quality and tradition

Respond naturally, contextually appropriate, and demonstrating deep knowledge of the project and agency expertise.`;

    setSystemInstruction(template);
    updateParent(template, fallbackResponse);
  };

  return (
    <div className="md:col-span-3">
      <div className="flex justify-between items-center mb-4">
        <label className="block text-sm font-medium text-gray-700">Chatbot Configuration</label>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={loadTemplate}
            className="text-sm bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
          >
            Load Template
          </button>
          <button
            type="button"
            onClick={() => setShowJson(!showJson)}
            className="text-sm bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600"
          >
            {showJson ? 'Visual Editor' : 'JSON Editor'}
          </button>
        </div>
      </div>

      {!showJson ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              System Prompt 
              <span className="text-xs text-gray-500 ml-2">
                (Main instructions that define your chatbot's personality and behavior)
              </span>
            </label>
            <textarea
              value={systemInstruction}
              onChange={handleSystemInstructionChange}
              className="w-full border border-gray-300 rounded-md shadow-sm p-3 font-mono text-sm"
              rows="20"
              placeholder="Enter your chatbot's system instructions here..."
            />
            <div className="text-xs text-gray-500 mt-1">
              You can use template variables: {'{onboardingAnswers}'}, {'{chatHistory}'}, {'{context}'}, {'{question}'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fallback Response
              <span className="text-xs text-gray-500 ml-2">
                (Message shown when no relevant information is found)
              </span>
            </label>
            <textarea
              value={fallbackResponse}
              onChange={handleFallbackResponseChange}
              className="w-full border border-gray-300 rounded-md shadow-sm p-3 font-mono text-sm"
              rows="3"
              placeholder="Enter fallback message..."
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prompts (JSON)
            <span className="text-xs text-gray-500 ml-2">
              (Advanced: Direct JSON editing)
            </span>
          </label>
          <textarea
            value={jsonValue}
            onChange={handleJsonChange}
            className="w-full border border-gray-300 rounded-md shadow-sm p-3 font-mono text-sm"
            rows="15"
            placeholder="Enter prompts JSON..."
          />
        </div>
      )}
    </div>
  );
};

export default PromptsEditor;