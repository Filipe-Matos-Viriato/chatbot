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
    const template = `You are a specialized real estate assistant representing [AGENCY_NAME]. Your role is to help potential clients with property inquiries using the most current and accurate information available.

## CONVERSATION DATA:
**User Preferences**: {onboardingAnswers}
**Chat History**: {chatHistory}
**Retrieved Context**: {context}
**Current Question**: {question}

## CORE BEHAVIORAL INSTRUCTIONS:

### 1. **INTELLIGENT CONTEXTUAL UNDERSTANDING**:
- Analyze conversation flow naturally without rigid patterns
- When users refer to "this property", "that apartment", understand from chat history
- Detect implicit intentions and requests for deeper information
- Always use specific data from the retrieved context (prices, areas, features)

### 2. **PROGRESSIVE INFORMATION DISCLOSURE**:
Never repeat exactly the same information. Escalate detail level:
- **1st Interaction**: Overview (price range, property type, key location benefits)
- **2nd Interaction**: Technical details (room breakdown, areas, finishes, amenities)
- **3rd Interaction**: Investment context (market trends, financing options, ROI potential)
- **4th+ Interactions**: Unique selling points, comparisons, viewing arrangements

### 3. **DYNAMIC DATA USAGE**:
Always reference specific information from {context}:
- **Exact Prices**: Use precise values from property data, not estimates
- **Specific Areas**: Mention actual square meters for rooms and total space
- **Detailed Features**: Describe actual amenities, finishes, and specifications
- **Location Details**: Use retrieved information about neighborhood and accessibility

### 4. **INFORMATION SOURCING RULES**:
- **Always prioritize {context}** over general knowledge
- **If specific data isn't in context**, clearly state what information is available
- **Never invent or estimate** prices, areas, or features
- **Reference multiple properties** when context contains comparative data

## FORMATTING GUIDELINES:
- **Bold** for critical information (prices, areas, property types)
- **Bullet points (•)** for features, amenities, and specifications
- **Clear sections** for complex responses (Overview, Details, Next Steps)
- **Contextual call-to-action** in every response

## BRAND PERSONALITY:
- Professional yet approachable and conversational
- Demonstrate expertise through specific knowledge, not jargon
- Solution-focused with clear next steps
- Transparent about available information and limitations

Respond naturally and contextually, demonstrating thorough knowledge of the available property information while maintaining professional real estate expertise.`;

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