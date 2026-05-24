/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { FunctionCall } from '../state';
import { FunctionResponseScheduling } from '@google/genai';

export const voiceDevTools: FunctionCall[] = [
  {
    name: 'update_voice_persona',
    description: 'Updates Beatrice\'s internal persona settings like voice, language, persona name, or the core system prompt based on user feedback or requirements.',
    parameters: {
      type: 'OBJECT',
      properties: {
        personaName: { type: 'STRING', description: 'The new name for the AI persona.' },
        voice: { type: 'STRING', description: 'The new voice ID to use (e.g., "Puck", "Charon", "Kore").' },
        language: { type: 'STRING', description: 'The primary language for conversation.' },
        systemPrompt: { type: 'STRING', description: 'The updated behavioral instructions/persona background.' }
      }
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'manage_function_tool',
    description: 'Adds, removes, or updates the definition of other function tools that Beatrice can use. Use this to expand Beatrice\'s capabilities dynamically.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', enum: ['add', 'remove', 'update'], description: 'The operation to perform on the tool library.' },
        toolDefinition: { 
          type: 'OBJECT', 
          description: 'The full FunctionCall definition object (name, description, parameters).' 
        },
        toolName: { type: 'STRING', description: 'The name of the tool to remove or update.' }
      },
      required: ['action']
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'voice_command_optimizer',
    description: 'Analyzes recent user transcripts and audio inputs to identify patterns and suggest optimized voice commands or "shortcuts" to trigger complex workflows.',
    parameters: {
      type: 'OBJECT',
      properties: {
        analysis_depth: { type: 'STRING', enum: ['quick', 'detailed'], description: 'How deep to analyze the history.' }
      }
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'test_voice_response',
    description: 'Triggers a specific voice response or affect (e.g., laughter, sigh, whisper) to test the high-fidelity human vocal engine.',
    parameters: {
      type: 'OBJECT',
      properties: {
        affect: { type: 'STRING', description: 'The vocal affect to test (e.g., "giggle", "sigh", "throat_clear", "mumble").' },
        text: { type: 'STRING', description: 'The sample text to speak with that affect.' }
      },
      required: ['affect']
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  }
];
