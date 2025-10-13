// Mocha setup for ESM; can stub env if needed
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Import chai for assertions
import { expect, assert } from 'chai';
global.expect = expect;
global.assert = assert;

// Set up test environment variables
process.env.OPENAI_API_KEY = 'test-key';
process.env.PINECONE_API_KEY = 'test-pinecone-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';


