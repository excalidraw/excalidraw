# Component Methods and Business Rules

## ImageToMermaidConverter Methods

### analyzeImageWithLLM(imageData: ImageData): Promise<string>
**Purpose**: Analyze image using configured LLM service and generate mermaid code
**Business Rules**:
- Image must be valid and within size limits (max 10MB)
- LLM service must be configured and available
- Generated response must be validated as mermaid syntax
- Retry up to 3 times if generation fails
- Timeout after 30 seconds per attempt

**Input Validation**:
- Verify imageData.blob is valid
- Check file size against maxFileSize limit
- Validate image format is supported

**Output Specifications**:
- Returns valid mermaid diagram code as string
- Throws ConversionError if all attempts fail
- Includes metadata about generation attempt

**Error Handling**:
- NetworkError: LLM service unavailable
- ValidationError: Generated code is invalid mermaid
- RateLimitError: Service quota exceeded
- TimeoutError: Request exceeded time limit

### validateAndRefineMermaidCode(code: string): Promise<string>
**Purpose**: Validate generated mermaid code and refine if necessary
**Business Rules**:
- Code must pass mermaid syntax validation
- If invalid, attempt to fix common issues automatically
- If auto-fix fails, request LLM to refine the code
- Maximum 2 refinement attempts

**Input Validation**:
- Code must be non-empty string
- Code must contain mermaid diagram keywords

**Output Specifications**:
- Returns syntactically valid mermaid code
- Preserves original intent while fixing syntax issues

**Error Handling**:
- Throw ValidationError if code cannot be fixed
- Log refinement attempts for debugging

### convertToExcalidrawElements(mermaidCode: string): Promise<ConversionResult>
**Purpose**: Convert validated mermaid code to excalidraw elements
**Business Rules**:
- Use existing @excalidraw/mermaid-to-excalidraw package
- Maintain element positioning and styling
- Generate unique IDs for all elements

**Input Validation**:
- Mermaid code must be syntactically valid
- Code must represent supported diagram types

**Output Specifications**:
- Returns array of ExcalidrawElement objects
- Includes positioning and styling information
- Maintains relationships between connected elements

## ImageInputHandler Methods

### handleClipboardPaste(event: ClipboardEvent): Promise<ImageData | null>
**Purpose**: Extract image data from clipboard paste event
**Business Rules**:
- Only process events containing image data
- Support common image formats (PNG, JPEG, SVG, WebP, GIF)
- Convert to standardized ImageData format

**Input Validation**:
- Verify clipboard contains image data
- Check image format is supported
- Validate file size is within limits

**Output Specifications**:
- Returns ImageData object with blob and metadata
- Returns null if no valid image found

**Error Handling**:
- Log unsupported formats for user feedback
- Handle clipboard access permission errors

### handleFileUpload(files: FileList): Promise<ImageData[]>
**Purpose**: Process uploaded image files
**Business Rules**:
- Accept multiple files if supported
- Validate each file format and size
- Convert to ImageData format for processing

**Input Validation**:
- Each file must be valid image format
- File size must be within configured limits
- MIME type must match file extension

**Output Specifications**:
- Returns array of ImageData objects
- Maintains original file metadata

**Error Handling**:
- Skip invalid files with user notification
- Provide detailed error messages for rejected files

### handleDragDrop(event: DragEvent): Promise<ImageData[]>
**Purpose**: Process images from drag and drop operations
**Business Rules**:
- Extract image files from drag event
- Support both file drops and image URL drops
- Validate dropped content is image data

**Input Validation**:
- Verify drag event contains files or image URLs
- Validate file types and sizes
- Handle security restrictions on file access

**Output Specifications**:
- Returns array of ImageData objects
- Includes source information (file vs URL)

## LLMServiceManager Methods

### configureService(config: LLMServiceConfig): void
**Purpose**: Configure LLM service connection and authentication
**Business Rules**:
- Validate configuration parameters for selected provider
- Test connection if possible
- Store configuration securely

**Input Validation**:
- Provider must be supported ('openai', 'ollama', 'custom')
- API key format must be valid for provider
- Endpoint URL must be valid if provided

**Error Handling**:
- Throw ConfigurationError for invalid settings
- Provide specific guidance for configuration issues

### analyzeImage(imageData: ImageData, prompt?: string): Promise<string>
**Purpose**: Send image to LLM service for analysis and mermaid generation
**Business Rules**:
- Include standard prompt for diagram recognition
- Allow custom prompt override for specific use cases
- Handle service-specific image format requirements
- Implement exponential backoff for retries

**Input Validation**:
- ImageData must contain valid image blob
- Prompt must be within service character limits
- Image size must be within service limits

**Output Specifications**:
- Returns mermaid diagram code as string
- Includes confidence metadata if available

**Error Handling**:
- Handle rate limiting with appropriate delays
- Provide fallback options for service failures
- Log service responses for debugging

### validateMermaidSyntax(code: string): Promise<ValidationResult>
**Purpose**: Validate mermaid code syntax without rendering
**Business Rules**:
- Use mermaid parser to check syntax
- Identify specific syntax errors
- Suggest corrections for common mistakes

**Input Validation**:
- Code must be non-empty string
- Code should contain mermaid keywords

**Output Specifications**:
- Returns validation result with success/failure
- Includes specific error messages and line numbers
- Suggests corrections when possible

## ConversionPreviewPanel Methods

### renderMermaidPreview(code: string): void
**Purpose**: Display live preview of mermaid diagram
**Business Rules**:
- Update preview in real-time as code changes
- Handle syntax errors gracefully
- Show loading state during rendering

**Input Validation**:
- Code must be valid string (can be empty)
- Debounce rapid changes to avoid excessive rendering

**Output Specifications**:
- Renders mermaid diagram in preview area
- Shows error messages for invalid syntax
- Maintains scroll position during updates

### renderExcalidrawPreview(elements: ExcalidrawElement[]): void
**Purpose**: Display preview of converted excalidraw elements
**Business Rules**:
- Show elements as they would appear in main canvas
- Use same styling and positioning as final result
- Allow zoom and pan for large diagrams

**Input Validation**:
- Elements array must be valid ExcalidrawElement objects
- Handle empty arrays gracefully

**Output Specifications**:
- Renders elements in preview canvas
- Maintains aspect ratio and positioning
- Shows element count and diagram bounds

### handleCodeEdit(newCode: string): void
**Purpose**: Handle user edits to generated mermaid code
**Business Rules**:
- Validate syntax in real-time
- Preserve user changes during validation
- Update preview automatically

**Input Validation**:
- Code must be valid string
- Track changes for undo/redo functionality

**Output Specifications**:
- Updates internal code state
- Triggers preview re-rendering
- Maintains cursor position in editor

## Error Handling Business Rules

### Retry Logic
- Network errors: Retry up to 3 times with exponential backoff
- Rate limit errors: Wait for rate limit reset before retry
- Validation errors: Attempt automatic correction once
- Service errors: Try alternative service if configured

### User Feedback
- Show progress indicators for operations > 2 seconds
- Provide specific error messages with suggested actions
- Allow manual intervention when automatic processes fail
- Maintain operation history for debugging

### Graceful Degradation
- Continue with partial results when possible
- Offer manual editing when automatic generation fails
- Provide export options for intermediate results
- Allow users to save and resume conversion sessions