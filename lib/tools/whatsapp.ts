import { FunctionCall } from '../state';
import { FunctionResponseScheduling } from '@google/genai';

export const whatsappTools: FunctionCall[] = [
  {
    name: 'send_whatsapp_message',
    description: 'Sends a WhatsApp message to a specific phone number using the Meta for Developers WhatsApp Cloud API.',
    parameters: {
      type: 'OBJECT',
      properties: {
        phone: {
          type: 'STRING',
          description: 'The phone number of the recipient in international format (e.g., "15550199999").',
        },
        text: {
          type: 'STRING',
          description: 'The content of the message to send.',
        },
      },
      required: ['phone', 'text'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'connect_whatsapp',
    description: 'Launches the WhatsApp linkage and configuration interface on screen, guiding the user through connecting their WhatsApp Business portfolio or scanning the QR code pairing process.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  }
];
