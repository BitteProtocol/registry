import { jest } from '@jest/globals';

// Set default timeout for all tests (useful for integration tests that make real HTTP calls)
jest.setTimeout(30000);

// Set up environment variables for testing
process.env.DEPLOYMENT_URL = process.env.DEPLOYMENT_URL || '';

// Add global fetch
global.fetch = fetch as unknown as typeof global.fetch;
