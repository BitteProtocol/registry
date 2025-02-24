import fetch from 'node-fetch';

export const BASE_URL = process.env.DEPLOYMENT_URL 
  ? process.env.DEPLOYMENT_URL
  : 'http://localhost:3000';

describe('Agents API Integration Tests', () => {

  beforeEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
  });

  it('should fetch agents successfully', async () => {
    const response = await fetch(`${BASE_URL}/api/agents`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);

    // If there are agents, verify their structure
    if (data.length > 0) {
      const agent = data[0];
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('description');
      expect(agent).toHaveProperty('pings');
      expect(typeof agent.pings).toBe('number');
    }
  });

  it('should filter agents by chainIds', async () => {
    const chainIds = ['0'];
    const response = await fetch(`${BASE_URL}/api/agents?chainIds=${chainIds.join(',')}`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should handle pagination with limit and offset', async () => {
    const limit = 5;
    const offset = 2;
    const response = await fetch(`${BASE_URL}/api/agents?limit=${limit}&offset=${offset}`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should handle verified only parameter', async () => {
    const response = await fetch(`${BASE_URL}/api/agents?verifiedOnly=true`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should filter by category', async () => {
    const response = await fetch(`${BASE_URL}/api/agents?category=DAO`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

}); 