/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { FunctionResponseScheduling } from '@google/genai';
import { FunctionCall, workspaceTools } from './state';
import { personalAssistantTools } from './tools/personal-assistant';
import { whatsappTools } from './tools/whatsapp';
import { voiceDevTools } from './tools/voice-dev';
import { autonomousSystemTools } from './tools/autonomous';
import { freeLlmTools } from './tools/free-llm';

export const AVAILABLE_TOOLS: FunctionCall[] = [
  ...personalAssistantTools,
  ...workspaceTools,
  ...whatsappTools,
  ...voiceDevTools,
  ...autonomousSystemTools,
  ...freeLlmTools
];
