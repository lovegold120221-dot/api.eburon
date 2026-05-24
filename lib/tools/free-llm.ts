/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { FunctionCall } from '../state';
import { FunctionResponseScheduling } from '@google/genai';

export const freeLlmTools: FunctionCall[] = [
  {
    name: 'list_free_models',
    description: 'Lists all available free models provided by the FreeLLMAPI proxy (e.g., Llama 3.3, DeepSeek, Qwen).',
    parameters: {
      type: 'OBJECT',
      properties: {
        provider: { type: 'STRING', description: 'Optional filter by provider (e.g., "Groq", "SambaNova").' }
      }
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'query_free_llm',
    description: 'Sends a prompt to an alternative free LLM model via the FreeLLMAPI proxy. Use this when you need insights from models other than Gemini, like Llama 3.3 or DeepSeek V3.',
    parameters: {
      type: 'OBJECT',
      properties: {
        model: { type: 'STRING', description: 'The model ID to use (e.g., "llama-3.3-70b", "deepseek-v3", or "auto").' },
        prompt: { type: 'STRING', description: 'The text prompt to send to the model.' },
        system_instruction: { type: 'STRING', description: 'Optional system instructions for the alternative model.' }
      },
      required: ['prompt']
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'compare_llm_responses',
    description: 'Sends the same prompt to multiple free models and compares their outputs. Useful for cross-verifying facts or creative styles.',
    parameters: {
      type: 'OBJECT',
      properties: {
        models: { 
          type: 'ARRAY', 
          items: { type: 'STRING' },
          description: 'List of model IDs to compare (e.g., ["llama-3.3-70b", "gemini-2.0-flash"]).' 
        },
        prompt: { type: 'STRING', description: 'The prompt to compare.' }
      },
      required: ['models', 'prompt']
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  }
];
