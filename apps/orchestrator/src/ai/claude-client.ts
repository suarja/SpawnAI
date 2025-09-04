import Anthropic from '@anthropic-ai/sdk';
import { Logger } from 'winston';
import { GeneratedCode } from '../vm/e2b-manager';

export interface ClaudeConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CodeGenerationRequest {
  prompt: string;
  appType: 'webapp' | 'api' | 'script';
  additionalContext?: string;
}

export interface CodeGenerationResult {
  success: boolean;
  code?: GeneratedCode;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
  };
}

/**
 * Claude AI Client for SpawnAI
 * Generates code from natural language prompts using Anthropic's Claude API
 */
export class ClaudeClient {
  private client: Anthropic;
  private logger: Logger;
  private config: ClaudeConfig;

  constructor(config: ClaudeConfig, logger: Logger) {
    this.config = {
      model: 'claude-3-haiku-20240307', // Fast, cost-effective for code generation
      maxTokens: 4096,
      temperature: 0.1, // Low temperature for consistent code generation
      ...config
    };
    
    this.client = new Anthropic({
      apiKey: this.config.apiKey,
    });
    
    this.logger = logger;
  }

  /**
   * Generate code from natural language prompt
   */
  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    this.logger.info('Generating code with Claude', {
      appType: request.appType,
      promptLength: request.prompt.length
    });

    try {
      const systemPrompt = this.getSystemPrompt(request.appType);
      const userPrompt = this.buildUserPrompt(request);

      const message = await this.client.messages.create({
        model: this.config.model!,
        max_tokens: this.config.maxTokens!,
        temperature: this.config.temperature!,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userPrompt
        }]
      });

      // Extract code from Claude's response
      const code = this.parseClaudeResponse(message.content, request.appType);
      
      if (!code) {
        return {
          success: false,
          error: 'Failed to extract valid code from Claude response'
        };
      }

      // Calculate usage metrics
      const usage = {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cost: this.calculateCost(message.usage.input_tokens, message.usage.output_tokens)
      };

      this.logger.info('Code generated successfully', {
        appType: request.appType,
        fileCount: code.files.length,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimatedCost: usage.cost
      });

      return {
        success: true,
        code,
        usage
      };

    } catch (error) {
      this.logger.error('Claude code generation failed', {
        error: error instanceof Error ? error.message : error,
        appType: request.appType
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown generation error'
      };
    }
  }

  /**
   * Get system prompt based on app type
   */
  private getSystemPrompt(appType: 'webapp' | 'api' | 'script'): string {
    const basePrompt = `You are a code generator for SpawnAI, creating "ugly but functional" applications.

CRITICAL REQUIREMENTS:
1. Generate complete, working code that runs immediately
2. Use minimal dependencies (prefer vanilla/standard libraries)
3. Create self-contained applications
4. Output ONLY the code files, no explanations
5. Follow the exact JSON structure for your response

RESPONSE FORMAT:
You must respond with a JSON object containing:
{
  "type": "single-file" | "multi-file",
  "files": [
    {
      "path": "/app/filename.ext",
      "content": "complete file content here"
    }
  ],
  "startCommand": "command to start the app",
  "dependencies": ["list", "of", "packages"]
}`;

    switch (appType) {
      case 'webapp':
        return basePrompt + `

APP TYPE: WEBAPP
- Create a complete HTML application with embedded CSS and JavaScript
- Use vanilla HTML/CSS/JS or minimal frameworks (no complex build steps)
- Ensure the app runs on port 3000 with a simple HTTP server
- Make it functional over beautiful (SpawnAI's philosophy)
- Include basic interactivity appropriate to the request`;

      case 'api':
        return basePrompt + `

APP TYPE: API
- Create a REST API using Node.js and Express
- Include basic routes and error handling
- Ensure the API runs on port 3000
- Make it functional over polished (SpawnAI's philosophy)
- Include appropriate endpoints for the requested functionality`;

      case 'script':
        return basePrompt + `

APP TYPE: SCRIPT
- Create a Python or Node.js script that performs the requested task
- Generate output files or serve results via HTTP on port 3000
- Make it functional over elegant (SpawnAI's philosophy)
- Include basic error handling and logging`;

      default:
        throw new Error(`Unsupported app type: ${appType}`);
    }
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(request: CodeGenerationRequest): string {
    let prompt = `Create a ${request.appType} application: ${request.prompt}`;
    
    if (request.additionalContext) {
      prompt += `\n\nAdditional context: ${request.additionalContext}`;
    }

    prompt += `\n\nRemember: Generate ONLY the JSON response with complete, working code. No explanations or markdown formatting.`;

    return prompt;
  }

  /**
   * Parse Claude's response into GeneratedCode format
   */
  private parseClaudeResponse(content: any[], appType: string): GeneratedCode | null {
    try {
      // Extract text content from Claude's response format
      const textContent = content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');

      // Try to extract JSON from the response
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.error('No JSON found in Claude response', { textContent });
        return null;
      }

      const parsedCode = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsedCode.files || !Array.isArray(parsedCode.files) || parsedCode.files.length === 0) {
        this.logger.error('Invalid code structure from Claude', parsedCode);
        return null;
      }

      // Set defaults for missing fields
      const code: GeneratedCode = {
        type: parsedCode.type || (parsedCode.files.length === 1 ? 'single-file' : 'multi-file'),
        files: parsedCode.files,
        startCommand: parsedCode.startCommand || this.getDefaultStartCommand(parsedCode.files, appType),
        dependencies: parsedCode.dependencies || []
      };

      return code;

    } catch (error) {
      this.logger.error('Failed to parse Claude response', {
        error: error instanceof Error ? error.message : error,
        content: content
      });
      return null;
    }
  }

  /**
   * Get default start command based on files and app type
   */
  private getDefaultStartCommand(files: any[], appType: string): string {
    const hasHtml = files.some(f => f.path.includes('.html'));
    const hasJs = files.some(f => f.path.includes('.js') && f.path.includes('server'));
    const hasPy = files.some(f => f.path.includes('.py'));

    if (appType === 'webapp' && hasHtml) {
      return 'cd /app && python3 -m http.server 3000';
    }
    if (appType === 'api' && hasJs) {
      return 'cd /app && node server.js';
    }
    if (appType === 'script' && hasPy) {
      return 'cd /app && python3 script.py && python3 -m http.server 3000';
    }

    // Fallback
    return 'cd /app && python3 -m http.server 3000';
  }

  /**
   * Calculate estimated cost for Claude API usage
   * Based on Claude 3 Haiku pricing: $0.25/1M input tokens, $1.25/1M output tokens
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1000000) * 0.25;
    const outputCost = (outputTokens / 1000000) * 1.25;
    return inputCost + outputCost;
  }

  /**
   * Validate generated code for basic security and functionality
   */
  async validateCode(code: GeneratedCode): Promise<{ valid: boolean; issues?: string[] }> {
    const issues: string[] = [];

    // Check for dangerous patterns
    const dangerousPatterns = [
      /eval\s*\(/,
      /exec\s*\(/,
      /subprocess\.call/,
      /os\.system/,
      /rm\s+-rf/,
      /\.\.\/\.\.\//
    ];

    for (const file of code.files) {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(file.content)) {
          issues.push(`Potentially dangerous code pattern in ${file.path}`);
        }
      }
    }

    // Check for required structure
    if (code.files.length === 0) {
      issues.push('No files generated');
    }

    if (!code.startCommand) {
      issues.push('No start command specified');
    }

    return {
      valid: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined
    };
  }
}