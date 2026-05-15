# AI Hub

**Community 10** · 19 nodes · cohesion 0.13

## Nodes

- **fetchAiSettings()** (`src\pages\AIHub.tsx`) — degree 1
- **fetchUploadedFiles()** (`src\pages\AIHub.tsx`) — degree 1
- **getAiModes()** (`src\pages\AIHub.tsx`) — degree 1
- **handleClearChat()** (`src\pages\AIHub.tsx`) — degree 1
- **handleCopyMessage()** (`src\pages\AIHub.tsx`) — degree 1
- **handleFollowUpClick()** (`src\pages\AIHub.tsx`) — degree 2
- **handleKnowledgeUpload()** (`src\pages\AIHub.tsx`) — degree 1
- **handleLibraryQuestionSelect()** (`src\pages\AIHub.tsx`) — degree 1
- **handleSaveAiSettings()** (`src\pages\AIHub.tsx`) — degree 1
- **handleScroll()** (`src\pages\AIHub.tsx`) — degree 1
- **handleScrollToBottomClick()** (`src\pages\AIHub.tsx`) — degree 2
- **handleSendChatMessage()** (`src\pages\AIHub.tsx`) — degree 3
- **handleStopGeneration()** (`src\pages\AIHub.tsx`) — degree 2
- **handleTestAiConnection()** (`src\pages\AIHub.tsx`) — degree 1
- **if()** (`src\pages\AIHub.tsx`) — degree 1
- **openUploadModalForArea()** (`src\pages\AIHub.tsx`) — degree 1
- **scrollToBottom()** (`src\pages\AIHub.tsx`) — degree 3
- **typeNextChar()** (`src\pages\AIHub.tsx`) — degree 2
- **AIHub.tsx** (`src\pages\AIHub.tsx`) — degree 18

## Internal Edges

- AIHub.tsx --contains-> getAiModes() [EXTRACTED]
- AIHub.tsx --contains-> scrollToBottom() [EXTRACTED]
- AIHub.tsx --contains-> handleScrollToBottomClick() [EXTRACTED]
- AIHub.tsx --contains-> handleScroll() [EXTRACTED]
- AIHub.tsx --contains-> typeNextChar() [EXTRACTED]
- AIHub.tsx --contains-> fetchAiSettings() [EXTRACTED]
- AIHub.tsx --contains-> handleSaveAiSettings() [EXTRACTED]
- AIHub.tsx --contains-> handleTestAiConnection() [EXTRACTED]
- AIHub.tsx --contains-> handleStopGeneration() [EXTRACTED]
- AIHub.tsx --contains-> handleSendChatMessage() [EXTRACTED]
- AIHub.tsx --contains-> handleFollowUpClick() [EXTRACTED]
- AIHub.tsx --contains-> handleKnowledgeUpload() [EXTRACTED]
- AIHub.tsx --contains-> openUploadModalForArea() [EXTRACTED]
- AIHub.tsx --contains-> handleClearChat() [EXTRACTED]
- AIHub.tsx --contains-> handleCopyMessage() [EXTRACTED]
- AIHub.tsx --contains-> handleLibraryQuestionSelect() [EXTRACTED]
- AIHub.tsx --contains-> fetchUploadedFiles() [EXTRACTED]
- AIHub.tsx --contains-> if() [EXTRACTED]
- scrollToBottom() --calls-> handleScrollToBottomClick() [EXTRACTED]
- scrollToBottom() --calls-> typeNextChar() [EXTRACTED]
- handleStopGeneration() --calls-> handleSendChatMessage() [EXTRACTED]
- handleSendChatMessage() --calls-> handleFollowUpClick() [EXTRACTED]