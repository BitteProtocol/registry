# Todo List

## Tool Usage Tracking
- [ ] Add Redis/KV store to track tool usage frequency
- [ ] Modify `/api/tools` endpoint to sort tools by usage count
- [ ] Update tool schema to include usage counter
- [ ] Add increment counter logic when tool is used

## Agent Creation Flow
- [ ] Create `/api/agents` POST endpoint to handle agent creation
- [ ] Replace setTimeout mock with actual API call in handleCreateAgent()
- [ ] Test if combining agents work