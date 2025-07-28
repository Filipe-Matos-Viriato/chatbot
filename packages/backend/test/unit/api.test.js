const chai = require('chai');
const expect = chai.expect;
const request = require('supertest');
const express = require('express');
const sinon = require('sinon');

// Mock dependencies
const ingestionService = require('../../src/services/ingestion-service');
const developmentService = require('../../src/services/development-service');
const listingService = require('../../src/services/listing-service');
const clientConfigService = require('../../src/services/client-config-service');
const supabase = require('../../src/config/supabase');

// The Express app to be tested
let app;
const { createApp } = require('../../src/index');

describe('API Endpoints Unit Tests', function() {
    this.timeout(5000); // Increase timeout for all tests in this block
    let sandbox;
    let ingestionServiceStub; // Declare the stub variable here

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        // Stub all service methods that might be called by the API
        ingestionServiceStub = sandbox.stub(ingestionService, 'processDocument').resolves({ success: true, message: 'Document processed successfully' });
        sandbox.stub(developmentService, 'createDevelopment').resolves({ success: true, data: { id: 'dev123', name: 'Test Development', location: 'Test Location', amenities: ['Pool'] } });
        sandbox.stub(developmentService, 'getDevelopmentsByClientId').resolves({ success: true, data: [{ id: 'dev123', name: 'Test Development', client_id: 'test_client' }] });
        sandbox.stub(listingService, 'createListing').resolves({ success: true, data: { id: 'list123', name: 'Test Listing', listing_id: 'L1', client_id: 'test_client' } });
        sandbox.stub(listingService, 'getListingsByClientId').resolves({ success: true, data: [{ id: 'list123', name: 'Test Listing', listing_id: 'L1', client_id: 'test_client' }] });
        sandbox.stub(listingService, 'updateListing').resolves({ success: true, data: { id: 'list123', name: 'Updated Listing', listing_id: 'L1', client_id: 'test_client' } });
        const mockClientConfig = {
            client_id: 'test_client',
            clientName: 'Test Client',
            configuration: {
                ingestionPipeline: [{ name: 'template-chunker', settings: { chunkSize: 1000, chunkOverlap: 200 } }],
                documentExtraction: {
                    listingName: { pattern: "Name: ([^,]+)" },
                    listingBaths: { pattern: "Bedrooms: (\\d+)" }, // Corrected pattern for baths to match test data
                },
                systemInstruction: "You are a helpful assistant."
            }
        };
        const getClientConfigStub = sandbox.stub(clientConfigService, 'getClientConfig').resolves(mockClientConfig);
        sandbox.stub(supabase.from('clients'), 'select').returns({ eq: sinon.stub().returns({ single: sinon.stub().resolves({ data: mockClientConfig, error: null }) }) });
        
        // Custom middleware to attach clientConfig for tests
        const testClientConfigMiddleware = (req, res, next) => {
            const clientId = req.headers['x-client-id'];
            if (!clientId) {
                return res.status(400).json({ error: 'Client ID is required.' });
            }
            req.clientConfig = {
                clientId: clientId, // Set clientId from header
                clientName: 'Test Client',
                configuration: {
                    ingestionPipeline: [{ name: 'template-chunker', settings: { chunkSize: 1000, chunkOverlap: 200 } }],
                    documentExtraction: {
                        listingName: { pattern: "Name: ([^,]+)" },
                        listingBaths: { pattern: "Bedrooms: (\\d+)" },
                    },
                    systemInstruction: "You are a helpful assistant."
                }
            };
            next();
        };

        app = createApp({
            clientConfigService: {
                ...clientConfigService,
                getClientConfig: getClientConfigStub,
            },
            supabase: supabase,
            ingestionService: { processDocument: ingestionServiceStub } // Pass the stubbed service
        }, false, testClientConfigMiddleware); // Pass false to disable the default clientConfigMiddleware, and pass testMiddleware
    });

    afterEach(() => {
        sandbox.restore();
    });

describe('POST /v1/documents/upload', () => {

        it('should upload a client info document successfully', async () => {
            const res = await request(app)
                .post('/v1/documents/upload')
                .set('x-client-id', 'test_client')
                .field('document_category', 'client')
                .attach('files', Buffer.from('test content'), 'test.pdf');
 
            expect(res.statusCode).to.equal(202);
            expect(res.body).to.have.property('message', 'Files received and are being processed.');
            expect(ingestionService.processDocument.calledOnce).to.be.true;
            const callArgs = ingestionService.processDocument.getCall(0).args[0];
            expect(callArgs.documentCategory).to.equal('client');
            expect(callArgs.metadata.client_id).to.equal('test_client');
            expect(callArgs.file.originalname).to.equal('test.pdf');
        });

        it('should upload a development document successfully', async () => {
            const res = await request(app)
                .post('/v1/documents/upload')
                .set('x-client-id', 'test_client')
                .field('document_category', 'development')
                .field('development_id', 'dev_abc')
                .attach('files', Buffer.from('development content'), 'dev.docx');

            expect(res.statusCode).to.equal(202);
            expect(res.body).to.have.property('message', 'Files received and are being processed.');
            expect(ingestionService.processDocument.calledOnce).to.be.true;
            const callArgs = ingestionService.processDocument.getCall(0).args[0];
            expect(callArgs.documentCategory).to.equal('development');
            expect(callArgs.metadata.client_id).to.equal('test_client');
            expect(callArgs.metadata.development_id).to.equal('dev_abc');
            expect(callArgs.file.originalname).to.equal('dev.docx');
        });

        it('should upload a listing document successfully', async () => {
            const res = await request(app)
                .post('/v1/documents/upload')
                .set('x-client-id', 'test_client')
                .field('document_category', 'listing')
                .field('listing_id', 'list_xyz')
                .field('development_id', 'dev_abc')
                .attach('files', Buffer.from('listing content'), 'list.pdf');

            expect(res.statusCode).to.equal(202);
            expect(res.body).to.have.property('message', 'Files received and are being processed.');
            expect(ingestionService.processDocument.calledOnce).to.be.true;
            const callArgs = ingestionService.processDocument.getCall(0).args[0];
            expect(callArgs.documentCategory).to.equal('listing');
            expect(callArgs.metadata.client_id).to.equal('test_client');
            expect(callArgs.metadata.listing_id).to.equal('list_xyz');
            expect(callArgs.metadata.development_id).to.equal('dev_abc');
            expect(callArgs.file.originalname).to.equal('list.pdf');
        });

        it('should return 400 if no files are uploaded', async () => {
            const res = await request(app)
                .post('/v1/documents/upload')
                .set('x-client-id', 'test_client')
                .field('document_category', 'client');

            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('error', 'No files uploaded');
            expect(ingestionService.processDocument.called).to.be.false;
        });

        it('should return 400 if document_category is missing', async () => {
            const res = await request(app)
                .post('/v1/documents/upload')
                .set('x-client-id', 'test_client')
                .attach('files', Buffer.from('test content'), 'test.pdf');

            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('error', 'document_category (client, development, or listing) is required');
            expect(ingestionService.processDocument.called).to.be.false;
        });

        it('should return 400 if document_category is invalid', async () => {
            const res = await request(app)
                .post('/v1/documents/upload')
                .set('x-client-id', 'test_client')
                .field('document_category', 'invalid_type')
                .attach('files', Buffer.from('test content'), 'test.pdf');

            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('error', 'document_category (client, development, or listing) is required');
            expect(ingestionService.processDocument.called).to.be.false;
        });

        it('should return 400 if listing_id is missing for listing document', async () => {
            const res = await request(app)
                .post('/v1/documents/upload')
                .set('x-client-id', 'test_client')
                .field('document_category', 'listing')
                .attach('files', Buffer.from('listing content'), 'list.pdf');

            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('error', 'listing_id is required for listing documents');
            expect(ingestionService.processDocument.called).to.be.false;
        });

        it('should return 400 if development_id is missing for development document', async () => {
            const res = await request(app)
                .post('/v1/documents/upload')
                .set('x-client-id', 'test_client')
                .field('document_category', 'development')
                .attach('files', Buffer.from('development content'), 'dev.docx');

            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('error', 'development_id is required for development documents');
            expect(ingestionService.processDocument.called).to.be.false;
        });

        it('should return 400 if client-id header is missing', async () => {
            const res = await request(app)
                .post('/v1/documents/upload')
                .field('document_category', 'client_info')
                .attach('files', Buffer.from('test content'), 'test.pdf');

            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('error', 'Client ID is required.');
        });
});

    describe('POST /v1/developments', () => {
        it('should create a new development successfully', async () => {
            const res = await request(app)
                .post('/v1/developments')
                .set('x-client-id', 'test_client')
                .send({ name: 'Test Development', location: 'Test Location', amenities: ['Pool'] });
 
            expect(res.statusCode).to.equal(201);
            expect(res.body.data).to.have.property('id');
            expect(res.body.data).to.have.property('id', 'dev123');
            expect(developmentService.createDevelopment.calledOnce).to.be.true;
            expect(developmentService.createDevelopment.calledWithMatch({
                name: 'Test Development',
                location: 'Test Location',
                amenities: ['Pool'],
                client_id: 'test_client'
            })).to.be.true;
        });

        it('should return 400 if name is missing when creating a development', async () => {
            const res = await request(app)
                .post('/v1/developments')
                .set('x-client-id', 'test_client')
                .send({ location: 'Test Location', amenities: ['Pool'] });

            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('error', 'Name, location, and amenities are required for development creation.');
            expect(developmentService.createDevelopment.called).to.be.false;
        });

        it('should return 400 if location is missing when creating a development', async () => {
            const res = await request(app)
                .post('/v1/developments')
                .set('x-client-id', 'test_client')
                .send({ name: 'Test Development', amenities: ['Pool'] });

            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('error', 'Name, location, and amenities are required for development creation.');
            expect(developmentService.createDevelopment.called).to.be.false;
        });

        it('should return 400 if amenities are missing when creating a development', async () => {
            const res = await request(app)
                .post('/v1/developments')
                .set('x-client-id', 'test_client')
                .send({ name: 'Test Development', location: 'Test Location' });

            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('error', 'Name, location, and amenities are required for development creation.');
            expect(developmentService.createDevelopment.called).to.be.false;
        });

        it('should return 400 if client-id header is missing', async () => {
            const res = await request(app)
                .post('/v1/developments')
                .send({ name: 'Test Development', description: 'A new development' });

            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('error', 'Client ID is required.');
        });
    });

    describe('GET /v1/clients/:clientId/developments', () => {
        it('should get developments by client ID successfully', async () => {
            const res = await request(app)
                .get('/v1/clients/test_client/developments')
                .set('x-client-id', 'test_client');
 
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('success', true);
            expect(res.body.data).to.be.an('array').and.have.lengthOf(1);
            expect(res.body.data[0]).to.have.property('id', 'dev123');
            expect(developmentService.getDevelopmentsByClientId.calledOnce).to.be.true;
            expect(developmentService.getDevelopmentsByClientId.calledWith('test_client')).to.be.true;
        });

        it('should return empty array if no developments found for client ID', async () => {
            developmentService.getDevelopmentsByClientId.resolves({ success: true, data: [] });
            const res = await request(app)
                .get('/v1/clients/test_client/developments')
                .set('x-client-id', 'test_client');

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('success', true);
            expect(res.body.data).to.be.an('array').and.be.empty;
            expect(developmentService.getDevelopmentsByClientId.calledOnce).to.be.true;
        });

        it('should return 403 if client-id in header does not match route param', async () => {
            const res = await request(app)
                .get('/v1/clients/another_client/developments')
                .set('x-client-id', 'test_client');

            expect(res.statusCode).to.equal(403);
            expect(res.body).to.have.property('error', 'Unauthorized access to client developments.');
            expect(developmentService.getDevelopmentsByClientId.called).to.be.false;
        });

        it('should return 400 if client-id header is missing', async () => {
            const res = await request(app)
                .get('/v1/clients/test_client/developments');

            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('error', 'Client ID is required.');
        });
    });

    describe('POST /v1/listings', () => {
        it('should create a new listing successfully', async () => {
            const res = await request(app)
                .post('/v1/listings')
                .set('x-client-id', 'test_client')
                .send({
                    listing_id: 'L1',
                    name: 'Test Listing',
                    num_bedrooms: 3,
                    total_area_sqm: 120,
                    price_eur: 250000,
                    listing_status: 'available',
                    current_state: 'finished',
                    development_id: 'dev123'
                });
 
            expect(res.statusCode).to.equal(200); // 200 for update, 201 for create
            expect(res.body.data).to.have.property('id');
            expect(res.body.data).to.have.property('id', 'list123');
            expect(listingService.updateListing.calledOnce).to.be.true;
            expect(listingService.updateListing.calledWithMatch('L1', {
                name: 'Test Listing',
                num_bedrooms: 3,
                total_area_sqm: 120,
                price_eur: 250000,
                listing_status: 'available',
                current_state: 'finished',
                client_id: 'test_client',
                development_id: 'dev123'
            })).to.be.true;
        });

        it('should create a new listing successfully if listing_id is not provided', async () => {
            const res = await request(app)
                .post('/v1/listings')
                .set('x-client-id', 'test_client')
                .send({
                    name: 'New Listing',
                    num_bedrooms: 2,
                    total_area_sqm: 80,
                    price_eur: 150000,
                    listing_status: 'available',
                    current_state: 'project'
                });

            expect(res.statusCode).to.equal(201);
            expect(res.body.data).to.have.property('id');
            expect(res.body.data).to.have.property('id', 'list123');
            expect(listingService.createListing.calledOnce).to.be.true;
            expect(listingService.createListing.calledWithMatch({
                name: 'New Listing',
                num_bedrooms: 2,
                total_area_sqm: 80,
                price_eur: 150000,
                listing_status: 'available',
                current_state: 'project',
                client_id: 'test_client',
                development_id: null
            })).to.be.true;
        });

        it('should return 400 if required fields are missing for a new listing', async () => {
            const res = await request(app)
                .post('/v1/listings')
                .set('x-client-id', 'test_client')
                .send({ name: 'Incomplete Listing' }); // Missing many required fields

            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('error', 'Missing required fields for new listing.');
            expect(listingService.createListing.called).to.be.false;
            expect(listingService.updateListing.called).to.be.false;
        });

        it('should return 400 if client-id header is missing', async () => {
            const res = await request(app)
                .post('/v1/listings')
                .send({ name: 'Test Listing', listing_id: 'L1', development_id: 'dev123' });

            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('error', 'Client ID is required.');
        });
    });

    describe('GET /v1/clients/:clientId/listings', () => {
        it('should get listings by client ID successfully', async () => {
            const res = await request(app)
                .get('/v1/clients/test_client/listings')
                .set('x-client-id', 'test_client');
 
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('success', true);
            expect(res.body.data).to.be.an('array').and.have.lengthOf(1);
            expect(res.body.data[0]).to.have.property('id', 'list123');
            expect(listingService.getListingsByClientId.calledOnce).to.be.true;
            expect(listingService.getListingsByClientId.calledWith('test_client')).to.be.true;
        });

        it('should return empty array if no listings found for client ID', async () => {
            listingService.getListingsByClientId.resolves({ success: true, data: [] });
            const res = await request(app)
                .get('/v1/clients/test_client/listings')
                .set('x-client-id', 'test_client');

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('success', true);
            expect(res.body.data).to.be.an('array').and.be.empty;
            expect(listingService.getListingsByClientId.calledOnce).to.be.true;
        });

        it('should return 403 if client-id in header does not match route param', async () => {
            const res = await request(app)
                .get('/v1/clients/another_client/listings')
                .set('x-client-id', 'test_client');

            expect(res.statusCode).to.equal(403);
            expect(res.body).to.have.property('error', 'Unauthorized access to client listings.');
            expect(listingService.getListingsByClientId.called).to.be.false;
        });

        it('should return 400 if client-id header is missing', async () => {
            const res = await request(app)
                .get('/v1/clients/test_client/listings');

            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('error', 'Client ID is required.');
        });
    });
});