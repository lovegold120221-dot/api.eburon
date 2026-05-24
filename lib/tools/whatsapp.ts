import { FunctionCall } from '../state';
import { FunctionResponseScheduling } from '@google/genai';

export const whatsappTools: FunctionCall[] = [
  {
    name: 'send_whatsapp_message',
    description: 'Sends an official WhatsApp message to a specific phone number using Eburon\'s Meta for Developers WhatsApp Cloud API. Ensure you have confirmed the user\'s intent and the phone number before sending.',
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
  },
  {
    name: 'search_whatsapp_contacts',
    description: 'Retrieves the list of contacts synced from the user\'s connected WhatsApp account. Use this to lookup the phone number of a friend or contact by name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Optional query string to search for a contact by name or number.'
        }
      },
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'read_whatsapp_chats',
    description: 'Retrieves the recent chats and their latest messages from the user\'s connected WhatsApp account. If a specific chat "jid" is provided, it retrieves the recent message history for that chat.',
    parameters: {
      type: 'OBJECT',
      properties: {
        jid: {
          type: 'STRING',
          description: 'Optional. The WhatsApp JID (e.g. 15551234567@s.whatsapp.net) to get the message history for a specific chat.'
        }
      },
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  }
];

