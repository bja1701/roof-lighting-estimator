import React, { ReactNode } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

// ---------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------
// Google Maps API Key is loaded from environment variable
// Set VITE_GOOGLE_MAPS_API_KEY in your .env file
const LIBRARIES: ("places" | "geometry" | "drawing")[] = ["places", "geometry", "drawing"];

interface MapWrapperProps {
  children: ReactNode;
}

const MapWrapper: React.FC<MapWrapperProps> = ({ children }) => {
  // Load API key from environment variable
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
    version: "weekly", // CRITICAL: Ensure we get the version that supports importLibrary and Web Components
  });

  // Only show the missing key UI if the string is empty. 
  // We trust the user provided a valid key otherwise.
  if (!apiKey) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900 text-amber-400 p-8 text-center">
        <div className="max-w-md border border-amber-500/30 bg-amber-500/10 p-6 rounded-lg">
          <h3 className="text-xl font-bold mb-4">API Key Missing</h3>
          <p className="mb-4 text-slate-300">
            To use this application, you need to add your Google Maps API Key.
          </p>
          <p className="text-sm font-mono bg-slate-800 p-2 rounded text-slate-400 mb-4">
            Open <strong>components/MapWrapper.tsx</strong> and update the 
            <span className="text-amber-400"> GOOGLE_MAPS_API_KEY</span> constant.
          </p>
          <a 
            href="https://developers.google.com/maps/documentation/javascript/get-api-key" 
            target="_blank" 
            rel="noreferrer"
            className="text-blue-400 hover:underline text-sm"
          >
            Get an API Key &rarr;
          </a>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900 text-red-400 p-4 text-center">
        <div className="max-w-md bg-slate-800 p-6 rounded-lg border border-red-500/30 shadow-xl">
          <h3 className="text-xl font-bold mb-2 text-red-400">Google Maps Load Error</h3>
          <p className="mb-4 text-slate-300">{loadError.message}</p>
          <div className="bg-black/50 p-3 rounded text-left mb-4">
            <p className="text-xs text-slate-500 mb-1">Attempted Key:</p>
            <code className="text-xs font-mono text-yellow-500 break-all">{apiKey}</code>
          </div>
          <p className="text-sm text-slate-400">
            This usually means the API key is invalid, or the "Maps JavaScript API" is not enabled in your Google Cloud Console.
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900 text-blue-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="animate-pulse">Loading Google Maps Engine...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default MapWrapper;