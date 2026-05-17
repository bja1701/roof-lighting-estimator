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
      <div className="flex items-center justify-center h-full p-8 text-center" style={{ background: 'rgba(15,25,40,0.96)', color: 'var(--color-accent)' }}>
        <div className="max-w-md p-6 rounded-lg" style={{ border: '1px solid rgba(217,111,10,0.3)', background: 'rgba(217,111,10,0.1)' }}>
          <h3 className="text-xl font-bold mb-4">API Key Missing</h3>
          <p className="mb-4" style={{ color: 'rgba(255,255,255,0.74)' }}>
            To use this application, you need to add your Google Maps API Key.
          </p>
          <p className="text-sm font-mono p-2 rounded mb-4" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.56)' }}>
            Set <span style={{ color: 'var(--color-accent)' }}>VITE_GOOGLE_MAPS_API_KEY</span> in your environment.
          </p>
          <a 
            href="https://developers.google.com/maps/documentation/javascript/get-api-key" 
            target="_blank" 
            rel="noreferrer"
            className="hover:underline text-sm"
            style={{ color: 'var(--color-accent)' }}
          >
            Get an API Key &rarr;
          </a>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full p-4 text-center" style={{ background: 'rgba(15,25,40,0.96)', color: 'var(--color-destructive)' }}>
        <div className="max-w-md p-6 rounded-lg shadow-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,64,64,0.3)' }}>
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--color-destructive)' }}>Google Maps Load Error</h3>
          <p className="mb-4" style={{ color: 'rgba(255,255,255,0.74)' }}>{loadError.message}</p>
          <div className="p-3 rounded text-left mb-4" style={{ background: 'rgba(15,25,40,0.72)' }}>
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Attempted Key:</p>
            <code className="text-xs font-mono break-all" style={{ color: 'var(--color-accent)' }}>{apiKey}</code>
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.56)' }}>
            This usually means the API key is invalid, or the "Maps JavaScript API" is not enabled in your Google Cloud Console.
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: 'rgba(15,25,40,0.96)', color: 'var(--color-accent)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(217,111,10,0.3)', borderTopColor: 'transparent' }} />
          <span className="animate-pulse">Loading Google Maps Engine...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default MapWrapper;