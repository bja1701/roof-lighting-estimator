import React, { useEffect, useRef } from 'react';
import { useEstimatorStore } from '../store/useEstimatorStore';

const SearchBar: React.FC = () => {
  // Pull both actions from the store
  const { setMapCenter, setStreetViewPosition, reset } = useEstimatorStore();
  const inputRef = useRef<HTMLInputElement>(null);
  // Using 'any' for the ref type because the 'google' namespace might not be available in the global type definitions.
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    // Cast window to any to access the google property which is injected by the Maps API script.
    const win = window as any;

    // Ensure Google Maps API is fully loaded via MapWrapper before running this.
    if (!win.google || !win.google.maps || !win.google.maps.places) {
      return;
    }

    if (inputRef.current) {
      // Initialize the standard Google Maps Autocomplete widget
      autocompleteRef.current = new win.google.maps.places.Autocomplete(inputRef.current, {
        fields: ['geometry', 'formatted_address'],
        types: ['geocode', 'establishment'], // Allow addresses and business locations
      });

      // Listen for the 'place_changed' event
      const listener = autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();

        if (place && place.geometry && place.geometry.location) {
          const location = place.geometry.location;
          const newLatLng = { lat: location.lat(), lng: location.lng() };
          
          // 1. Update Satellite View
          setMapCenter(newLatLng);

          // 2. Update Street View (Pull up to the searched address)
          // This decouples them afterwards; panning the map won't move Street View, 
          // but the initial search puts them in the same spot.
          setStreetViewPosition(newLatLng);
          
          // Reset the drawing state for the new location
          reset();
        }
      });

      // Cleanup
      return () => {
        if (listener) {
          win.google.maps.event.removeListener(listener);
        }
        if (autocompleteRef.current) {
          win.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        }
      };
    }
  }, [setMapCenter, setStreetViewPosition, reset]);

  return (
    <div className="w-full max-w-lg relative z-[60]">
      <input
        ref={inputRef}
        type="text"
        placeholder="Enter address..."
        className="
          w-full 
          bg-slate-800 
          border 
          border-slate-600 
          rounded-md 
          px-4 
          py-2 
          text-slate-200 
          placeholder-slate-500 
          focus:outline-none 
          focus:ring-2 
          focus:ring-blue-500 
          focus:border-transparent 
          shadow-sm
          transition-all
        "
      />
      
      {/* 
        Custom Styling for the Google Maps Autocomplete Dropdown (.pac-container).
        Google appends this to document.body, so we use a style tag to override it.
      */}
      <style>{`
        .pac-container {
          background-color: #1e293b !important; /* slate-800 */
          border: 1px solid #475569; /* slate-600 */
          border-top: none;
          border-radius: 0 0 8px 8px;
          margin-top: 4px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
          font-family: inherit;
          z-index: 9999 !important; /* Ensure it sits above everything */
        }
        .pac-item {
          border-top: 1px solid #334155; /* slate-700 */
          padding: 10px 12px;
          color: #94a3b8; /* slate-400 */
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .pac-item:first-child {
          border-top: none;
        }
        .pac-item:hover {
          background-color: #334155; /* slate-700 */
        }
        .pac-item-query {
          color: #e2e8f0; /* slate-200 */
          font-size: 14px;
        }
        .pac-icon {
          filter: invert(1) opacity(0.5); /* Make icons light for dark mode */
        }
        /* Adjust the 'Powered by Google' logo for dark mode */
        .pac-logo:after {
           filter: invert(1) grayscale(1) brightness(2);
        }
      `}</style>
    </div>
  );
};

export default SearchBar;