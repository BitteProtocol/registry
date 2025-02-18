describe('API Integration Tests', () => {
  const baseUrl = process.env.DEPLOYMENT_URL || 'http://localhost:3000';

  describe('Agents API', () => {
    it('should successfully fetch agents', async () => {
      const response = await fetch(`${baseUrl}/api/agents?limit=5`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('id');
        expect(data[0]).toHaveProperty('name');
        expect(data[0]).toHaveProperty('pings');
      }
    });

    it('should handle query parameters correctly', async () => {
      const response = await fetch(`${baseUrl}/api/agents?limit=2&verifiedOnly=true`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Tools API', () => {
    it('should successfully fetch tools', async () => {
      const response = await fetch(`${baseUrl}/api/tools?limit=5`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('function');
        expect(data[0]).toHaveProperty('pings');
        expect(data[0]).toHaveProperty('isPrimitive');
      }
    });

    it('should handle query parameters correctly', async () => {
      const response = await fetch(`${baseUrl}/api/tools?verifiedOnly=true&chainId=1`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });
}); 