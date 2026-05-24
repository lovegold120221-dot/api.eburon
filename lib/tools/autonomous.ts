/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { FunctionCall } from '../state';
import { FunctionResponseScheduling } from '@google/genai';

export const autonomousSystemTools: FunctionCall[] = [
  {
    name: 'plan_autonomous_task',
    description: 'Creates a structured multi-step plan for a complex request. This follows the agents-cli "scaffold" pattern to define the trajectory before execution.',
    parameters: {
      type: 'OBJECT',
      properties: {
        task_goal: { type: 'STRING', description: 'The overall goal to achieve.' },
        steps: { 
          type: 'ARRAY', 
          items: { type: 'STRING' },
          description: 'A list of discrete steps to reach the goal.' 
        }
      },
      required: ['task_goal', 'steps']
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'execute_task_step',
    description: 'Executes a single step from an autonomous plan. Reports the result and updates the trajectory state.',
    parameters: {
      type: 'OBJECT',
      properties: {
        step_id: { type: 'STRING', description: 'The ID or index of the step to execute.' },
        action_details: { type: 'STRING', description: 'Detailed instructions or tool calls for this specific step.' }
      },
      required: ['step_id', 'action_details']
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'evaluate_trajectory',
    description: 'Uses an "LLM-as-judge" pattern to evaluate the progress of an autonomous task. Determines if the trajectory is on track or needs correction.',
    parameters: {
      type: 'OBJECT',
      properties: {
        criteria: { type: 'STRING', description: 'The success criteria to evaluate against.' },
        observations: { type: 'STRING', description: 'What has been observed/achieved so far.' }
      },
      required: ['criteria', 'observations']
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'deploy_agent_skill',
    description: 'Packages a set of instructions and tools into a persistent "skill" that Beatrice can use in future sessions, similar to agents-cli deploy.',
    parameters: {
      type: 'OBJECT',
      properties: {
        skill_name: { type: 'STRING', description: 'The unique name for the new skill.' },
        instructions: { type: 'STRING', description: 'The core behavioral instructions for the skill.' },
        tools: { 
          type: 'ARRAY', 
          items: { type: 'STRING' },
          description: 'List of tool names this skill uses.' 
        }
      },
      required: ['skill_name', 'instructions']
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  }
];
