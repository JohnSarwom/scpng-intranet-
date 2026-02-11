# AI Hub Features Documentation

## Overview
The AI Hub is an intelligent assistant interface that provides staff with access to AI-powered insights on SCPNG legislation and organizational knowledge.

## Key Features

### 1. Query Validation
The AI Hub includes smart query validation to improve user experience and prevent unnecessary API calls.

**How it works:**
- Detects common test queries like "test", "hello", "hi", "testing", "hey"
- Identifies overly short queries (less than 3 characters)
- Allows legitimate short acronyms like "CMA", "CDA", "SCA", "SA"
- Returns immediate clarifying responses instead of making API calls

**User Experience:**
- Test queries receive: *"Hello! I am ready to assist you. Please ask a specific question about the SCPNG Acts or intranet."*
- Short queries receive: *"I noticed your query is quite short. Could you please provide more context or ask a complete question so I can help you better?"*

**Implementation:** `src/pages/AIHub.tsx` - `handleSendChatMessage` function

---

### 2. Stop Generation Control
Users can stop AI responses at any time during generation or text animation.

**How it works:**
- The Send button transforms into a red Stop button when AI is generating
- Clicking Stop aborts the API request and halts text streaming
- Uses `AbortController` to cancel ongoing fetch requests
- Clears typing animation timeouts
- Immediately returns control to the user

**Visual Indicators:**
- **Normal state:** Blue Send button (paper plane icon)
- **Generating state:** Red Stop button (square icon)
- **Active during:** API request AND text typing animation

**Implementation Details:**
- `abortControllerRef`: Manages API request cancellation
- `typingTimeoutRef`: Manages text animation
- `isAiTyping`: Derived state tracking typing animation
- `handleStopGeneration`: Cleanup function for all generation states

**Code Location:** `src/pages/AIHub.tsx`

---

## AI Modes

The AI Hub supports multiple specialized modes:

1. **General Purpose AI** (disabled)
2. **SCPNG Document Analyst** (disabled)
3. **CMA 2015 Expert** - Capital Market Act 2015
4. **CDA 2015 Expert** - Central Depositories Act 2015
5. **SA 1997 Expert** - Securities Act 1997
6. **SCA 2015 Expert** - Securities Commission Act 2015
7. **All Acts Expert** - Combined knowledge of all acts

Each mode includes the full text of relevant legislation in its system prompt for accurate, citation-based responses.

---

## Configuration

### API Settings
- **Location:** Admin tab in AI Hub sidebar (System Admins only)
- **Priority Order:**
  1. `.env` file (`VITE_GEMINI_API_KEY`)
  2. SharePoint InternalAppSettings (`GeminiAPIKey`)
  3. Supabase `news_api_settings` table (legacy)

### Knowledge Base Toggle
- Enable/disable full act text in prompts
- Located in AI Configuration section
- Affects response accuracy and context length

---

## User Interface

### Chat Interface
- Real-time typing animation (25ms per character)
- Message history with user/AI distinction
- Follow-up question suggestions
- Copy message functionality
- Clear chat history option
- Full-screen mode toggle

### Question Library
- Pre-defined questions organized by AI mode
- Quick access to common queries
- Categorized by topic and complexity

---

## Technical Architecture

### State Management
- `chatMessages`: Array of ChatMessage objects
- `isSendingChatMessage`: API request in progress
- `isAiTyping`: Text animation in progress
- `abortControllerRef`: Request cancellation
- `typingTimeoutRef`: Animation control

### API Integration
- Direct integration with Google Gemini API
- Conversation history management
- System instruction injection
- Follow-up question parsing
- Error handling and user feedback

---

## Future Enhancements
- Knowledge base document upload
- SharePoint integration for organizational documents
- Advanced search across knowledge areas
- Custom AI mode creation
- Response rating and feedback system
