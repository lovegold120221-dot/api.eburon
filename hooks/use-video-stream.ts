import { useState, useEffect, useRef } from 'react';

export function useVideoStream() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isScreenShareActive, setIsScreenShareActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startWebcam = async () => {
    setError(null);
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Production HTTPS & Secure Context validation
      if (window.location.protocol === 'https:' && !window.isSecureContext) {
        throw new Error("Visual streaming requires a secure HTTPS browser connection.");
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam APIs are unavailable on this browser/environment. Ensure you are on HTTPS.");
      }

      const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(newStream);
      setIsWebcamActive(true);
      setIsScreenShareActive(false);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err: any) {
      console.error("Error accessing webcam", err);
      setError(err?.message || "Failed to access webcam. Please check browser camera permissions.");
    }
  };

  const startScreenShare = async () => {
    setError(null);
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      // Production HTTPS & Secure Context validation
      if (window.location.protocol === 'https:' && !window.isSecureContext) {
        throw new Error("Screen sharing requires a secure HTTPS browser connection.");
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Display capture APIs are unavailable on this browser/environment. Ensure you are on HTTPS.");
      }

      const newStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setStream(newStream);
      setIsScreenShareActive(true);
      setIsWebcamActive(false);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      // Handle stream end by user using browser control bar
      newStream.getVideoTracks()[0].onended = () => {
        stopStream();
      };
    } catch (err: any) {
      console.error("Error accessing screen share", err);
      setError(err?.message || "Failed to access screen share. Please grant display permissions.");
    }
  };

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsWebcamActive(false);
    setIsScreenShareActive(false);
    setError(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  return {
    stream,
    videoRef,
    isWebcamActive,
    isScreenShareActive,
    error,
    startWebcam,
    startScreenShare,
    stopStream
  };
}
