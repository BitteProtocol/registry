import fetch from 'node-fetch';
import { BASE_URL } from './agents.test';


describe('Tools API Integration Tests', () => {
  it('should fetch tools successfully', async () => {
    const response = await fetch(`${BASE_URL}/api/tools`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    
    // If there are tools, verify their structure
    if (data.length > 0) {
      const tool = data[0];
      expect(tool).toHaveProperty('function');
      expect(tool).toHaveProperty('isPrimitive');
      expect(tool).toHaveProperty('pings');
      expect(typeof tool.pings).toBe('number');
    }
  });

  it('should filter tools by function name', async () => {
    const functionName = 'test-function';
    const response = await fetch(`${BASE_URL}/api/tools?function=${functionName}`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should handle verified only parameter', async () => {
    const response = await fetch(`${BASE_URL}/api/tools?verifiedOnly=true`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should handle pagination with offset', async () => {
    const offset = 2;
    const response = await fetch(`${BASE_URL}/api/tools?offset=${offset}`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should filter by chainId', async () => {
    const chainId = 'test-chain';
    const response = await fetch(`${BASE_URL}/api/tools?chainId=${chainId}`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });
}); 