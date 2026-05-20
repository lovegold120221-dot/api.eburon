import React, { useEffect, useState } from 'react';
import { getAccessToken } from '../lib/firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';

declare const google: any;
declare const gapi: any;

export const GooglePicker = () => {
  const { client } = useLiveAPIContext();
  const [pickerApiLoaded, setPickerApiLoaded] = useState(false);

  useEffect(() => {
    // Load the picker API if not already loaded
    if (window.gapi) {
      gapi.load('picker', () => setPickerApiLoaded(true));
    }
  }, []);

  useEffect(() => {
    const handleOpenPicker = async () => {
      if (!pickerApiLoaded) {
        console.error('Picker API not loaded');
        // Let the model know that it failed
        client.sendRealtimeInput([{ mimeType: 'text/plain', data: 'Error: Google Picker API is not loaded yet.' }]);
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        console.error('No access token available for Picker');
        client.sendRealtimeInput([{ mimeType: 'text/plain', data: 'Error: Cannot open Google Picker. Please ask the user to sign in.' }]);
        return;
      }

      const picker = new google.picker.PickerBuilder()
        .addView(google.picker.ViewId.DOCS)
        .addView(google.picker.ViewId.FOLDERS)
        .setOAuthToken(token)
        .setDeveloperKey(firebaseConfig.apiKey)
        .setCallback((data: any) => {
          if (data.action === google.picker.Action.PICKED) {
            const documents = data.docs.map((doc: any) => ({
              id: doc.id,
              name: doc.name,
              url: doc.url,
              mimeType: doc.mimeType,
            }));
            
            // Send feedback to the AI assistant
            const messageData = `User picked ${documents.length} files from Google Picker:\n${documents.map((d: any) => `- [id: ${d.id}] ${d.name} (${d.mimeType})`).join('\n')}`;
            
            client.send([{ 
              text: messageData
            }]);
          } else if (data.action === google.picker.Action.CANCEL) {
            client.send([{ text: 'User cancelled the Google Picker without selecting any file.' }]);
          }
        })
        .build();

      picker.setVisible(true);
    };

    window.addEventListener('OPEN_GOOGLE_PICKER', handleOpenPicker);
    return () => {
      window.removeEventListener('OPEN_GOOGLE_PICKER', handleOpenPicker);
    };
  }, [pickerApiLoaded, client]);

  return null;
};
