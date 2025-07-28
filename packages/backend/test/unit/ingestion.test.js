const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');

// Mock dependencies
const supabase = require('../../src/config/supabase');
const { Pinecone } = require('@pinecone-database/pinecone');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Import GoogleGenerativeAI

// The service to be tested
let ingestionService; // Declare as let so it can be assigned in beforeEach
const listingService = require('../../src/services/listing-service'); // Import listing service

describe('Ingestion Service Unit Tests', () => {
    let sandbox;
    let mockPineconeIndex;
    let mockEmbeddingModel;
    let mockGenAI;
    let mockPinecone;
    let mockExtractText; // Declare mockExtractText here

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Mock Supabase client
        sandbox.stub(supabase, 'from').returns({
            insert: sandbox.stub().returnsThis(),
            update: sandbox.stub().returnsThis(),
            select: sandbox.stub().returnsThis(),
            eq: sandbox.stub().returnsThis(),
            single: sandbox.stub().resolves({ data: {}, error: null }),
            upsert: sandbox.stub().returnsThis(),
            onConflict: sandbox.stub().returnsThis(),
            limit: sandbox.stub().returnsThis(),
            order: sandbox.stub().returnsThis(),
            in: sandbox.stub().returnsThis(),
            delete: sandbox.stub().resolves({ data: {}, error: null })
        });

        // Mock Pinecone
        mockPineconeIndex = {
            upsert: sandbox.stub().resolves({}),
            query: sandbox.stub().resolves({ matches: [] }),
            deleteOne: sandbox.stub().resolves({}),
            namespace: sandbox.stub().returns({ // Add namespace mock
                upsert: sandbox.stub().resolves({})
            })
        };
        sandbox.stub(Pinecone.prototype, 'Index').returns(mockPineconeIndex);

        // Mock GoogleGenerativeAI and Pinecone
        mockEmbeddingModel = {
            embedContent: sandbox.stub().resolves({ embedding: { values: [0.1, 0.2] } })
        };
        mockGenAI = {
            getGenerativeModel: sandbox.stub().returns(mockEmbeddingModel)
        };
        mockPinecone = {
            index: sandbox.stub().returns(mockPineconeIndex)
        };

        // Import ingestionService here after all stubs are set up
        ingestionService = require('../../src/services/ingestion-service');
        mockExtractText = sandbox.stub().resolves('mocked text'); // Stub the function directly
// Stub listingService
        sandbox.stub(listingService, 'updateListing').resolves({ data: [{ id: 'mock_listing_id' }], error: null });
        sandbox.stub(listingService, 'createListing').resolves({ listing: { id: 'new_mock_listing_id' }, error: null });


    });

    // Mock listingService globally


    afterEach(() => {
        sandbox.restore();
    });

    describe('processDocument', () => {
        it('should handle client_info document upload and upsert to Pinecone', async () => {
            const mockFile = {
                originalname: 'client_info.pdf',
                mimetype: 'application/pdf',
                buffer: Buffer.from('PDF content for client info')
            };
            const clientConfig = { clientId: 'test_client_id', ingestionPipeline: [] };
            const documentCategory = 'client';
            const metadata = {};

            let result = await ingestionService.processDocument({ clientConfig, file: mockFile, documentCategory, metadata }, {
                genAI: mockGenAI,
                pinecone: mockPinecone,
                pineconeIndex: mockPineconeIndex,
                embeddingModel: mockEmbeddingModel,
                extractText: mockExtractText, // Pass the mocked extractText
            });

            expect(result.success).to.be.true;
            expect(result.message).to.equal('Document processed successfully.');
            expect(mockExtractText.calledOnce).to.be.true;
            expect(mockPineconeIndex.upsert.calledOnce).to.be.true;
            const upsertArgs = mockPineconeIndex.upsert.getCall(0).args[0];
            expect(upsertArgs[0].metadata).to.have.property('client_id', clientConfig.clientId);
        });

        it('should handle development_info document upload and upsert to Pinecone and Supabase', async () => {
            const mockFile = {
                originalname: 'dev_info.docx',
                mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                buffer: Buffer.from('DOCX content for development info')
            };
            const clientConfig = { clientId: 'test_client_id', ingestionPipeline: [] };
            const documentCategory = 'development';
            const metadata = { development_id: 'dev_abc' };

            let result = await ingestionService.processDocument({ clientConfig, file: mockFile, documentCategory, metadata }, {
                genAI: mockGenAI,
                pinecone: mockPinecone,
                pineconeIndex: mockPineconeIndex,
                embeddingModel: mockEmbeddingModel,
                extractText: mockExtractText, // Pass the mocked extractText
            });

            expect(result.success).to.be.true;
            expect(mockExtractText.calledOnce).to.be.true;
            expect(mockPineconeIndex.upsert.calledOnce).to.be.true;
            expect(supabase.from('developments').upsert.calledOnce).to.be.true;
        });

        it('should handle listing_info document upload and upsert with structured metadata', async () => {
            const mockFile = {
                originalname: 'listing_info.pdf',
                mimetype: 'application/pdf',
                buffer: Buffer.from('PDF content for listing info. Name: Apartment A, Bedrooms: 3, Area: 120sqm, Price: 250000EUR, Status: available, State: finished')
            };
            const clientConfig = {
                clientId: 'test_client_id',
                ingestionPipeline: [],
                documentExtraction: {
                    listingName: { pattern: "Name: ([^,]+)" },
                    listingBaths: { pattern: "Bathrooms: (\\d+)" },
                }
            };
            const documentCategory = 'listing';
            const metadata = { listing_id: 'list_xyz', development_id: 'dev_abc' };

            let result = await ingestionService.processDocument({ clientConfig, file: mockFile, documentCategory, metadata }, {
                genAI: mockGenAI,
                pinecone: mockPinecone,
                pineconeIndex: mockPineconeIndex,
                embeddingModel: mockEmbeddingModel,
                extractText: mockExtractText, // Pass the mocked extractText
            });

            expect(result.success).to.be.true;
            expect(mockExtractText.calledOnce).to.be.true;
            expect(mockPineconeIndex.upsert.calledOnce).to.be.true;
            expect(supabase.from('listings').upsert.calledOnce).to.be.true;

            const listingUpsertArgs = supabase.from('listings').upsert.getCall(0).args[0];
            expect(listingUpsertArgs[0]).to.have.property('name', 'Apartment A');
            expect(listingUpsertArgs[0]).to.have.property('beds', 3);
        });

        it('should return error for unsupported file type', async () => {
            const mockFile = {
                originalname: 'unsupported.txt',
                mimetype: 'text/plain',
                buffer: Buffer.from('Plain text content')
            };
            const clientConfig = { clientId: 'test_client_id', ingestionPipeline: [] };
            const documentCategory = 'client';
            const metadata = {};

            let result = await ingestionService.processDocument({ clientConfig, file: mockFile, documentCategory, metadata }, {
                genAI: mockGenAI,
                pinecone: mockPinecone,
                pineconeIndex: mockPineconeIndex,
                embeddingModel: mockEmbeddingModel,
                extractText: mockExtractText, // Pass the mocked extractText
            });

            expect(result.success).to.be.false;
            expect(result.message).to.include('Failed to process document: Unsupported file type');
            expect(mockExtractText.calledOnce).to.be.true; // extractText should be called and throw
            expect(mockPineconeIndex.upsert.called).to.be.false;
        });
    });
});