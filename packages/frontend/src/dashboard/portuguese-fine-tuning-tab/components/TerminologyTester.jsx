// packages/frontend/src/dashboard/portuguese-fine-tuning-tab/components/TerminologyTester.jsx
// Component for testing Portuguese terminology replacement functionality.
// To allow administrators to test how terminology mappings work on sample text.
// Relevant files: PortugueseFineTuningTab.jsx, apiClient.js

import React, { useState } from 'react';

const TerminologyTester = ({ clientId }) => {
    const [inputText, setInputText] = useState('Este apartamento tem 2 banheiros modernos e uma piscina.');
    const [context, setContext] = useState('property_description');
    const [result, setResult] = useState(null);
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState(null);

    const testTerminology = async () => {
        if (!inputText.trim()) {
            setError('Please enter some text to test');
            return;
        }

        try {
            setTesting(true);
            setError(null);

            const response = await fetch('http://localhost:3007/api/admin/terminology/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: inputText,
                    clientId,
                    context: context || undefined
                })
            });

            if (!response.ok) throw new Error('Failed to test terminology');

            const data = await response.json();
            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setTesting(false);
        }
    };

    const sampleTexts = [
        {
            text: 'Este apartamento tem 2 banheiros modernos e uma piscina.',
            context: 'property_description',
            description: 'Property description with bathrooms'
        },
        {
            text: 'O cliente quer saber sobre os banheiros e a localização.',
            context: 'chat_message',
            description: 'Chat message about bathrooms and location'
        },
        {
            text: 'Apartamento T3 com 2 banheiros completos.',
            context: 'property_description',
            description: 'Property listing with bathroom count'
        }
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-medium text-gray-900 mb-2">Terminology Tester</h2>
                <p className="text-sm text-gray-600">
                    Test how your terminology mappings work on sample Portuguese text. This shows exactly what terms will be replaced.
                </p>
            </div>

            {/* Sample Texts */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-3">Quick Test Samples</h3>
                <div className="grid gap-2">
                    {sampleTexts.map((sample, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                setInputText(sample.text);
                                setContext(sample.context);
                            }}
                            className="text-left p-3 bg-white border border-blue-200 rounded hover:bg-blue-25 transition-colors"
                        >
                            <div className="text-sm font-medium text-blue-900">{sample.description}</div>
                            <div className="text-xs text-blue-700 mt-1">"{sample.text}"</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Input Form */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Test Text
                        </label>
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            rows={3}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter Portuguese text to test terminology replacement..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Context (Optional)
                        </label>
                        <select
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">No context</option>
                            <option value="property_description">Property Description</option>
                            <option value="chat_message">Chat Message</option>
                            <option value="listing_title">Listing Title</option>
                        </select>
                    </div>

                    <button
                        onClick={testTerminology}
                        disabled={testing}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {testing ? 'Testing...' : 'Test Terminology'}
                    </button>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Test failed</h3>
                            <p className="text-sm text-red-700 mt-1">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Display */}
            {result && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Test Results</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Original Text */}
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Original Text</h4>
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm">
                                {result.originalText}
                            </div>
                        </div>

                        {/* Localized Text */}
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Localized Text</h4>
                            <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">
                                {result.localizedText}
                            </div>
                        </div>
                    </div>

                    {/* Terms Replaced */}
                    {result.termsReplaced && result.termsReplaced.length > 0 && (
                        <div className="mt-6">
                            <h4 className="text-sm font-medium text-gray-700 mb-3">Terms Replaced</h4>
                            <div className="space-y-2">
                                {result.termsReplaced.map((replacement, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded">
                                        <div className="flex items-center space-x-3">
                                            <span className="text-sm font-medium text-red-700">"{replacement.sourceTerm}"</span>
                                            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>
                                            <span className="text-sm font-medium text-green-700">"{replacement.targetTerm}"</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Performance Info */}
                    <div className="mt-6 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between text-sm text-gray-600">
                            <span>Processing Time: {result.processingTimeMs}ms</span>
                            {result.termsReplaced && (
                                <span>Terms Replaced: {result.termsReplaced.length}</span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TerminologyTester;