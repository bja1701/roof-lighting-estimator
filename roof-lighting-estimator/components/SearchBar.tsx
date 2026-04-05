import React, { useEffect, useRef } from 'react';
import { useEstimatorStore } from '../store/useEstimatorStore';

const SearchBar: React.FC = () => {
  const { setMapCenter, setStreetViewPosition, setEstimateSiteAddress, reset } = useEstimatorStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    const win = window as any;

    if (!win.google || !win.google.maps || !win.google.maps.places) {
      return;
    }

    if (inputRef.current) {
      autocompleteRef.current = new win.google.maps.places.Autocomplete(inputRef.current, {
        fields: ['geometry', 'formatted_address'],
        types: ['geocode', 'establishment'],
      });

      const listener = autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();

        if (place && place.geometry && place.geometry.location) {
          const location = place.geometry.location;
          const newLatLng = { lat: location.lat(), lng: location.lng() };

          setMapCenter(newLatLng);
          setStreetViewPosition(newLatLng);
          reset();
          setEstimateSiteAddress(place.formatted_address?.trim() || null);
        }
      });

      return () => {
        if (listener) {
          win.google.maps.event.removeListener(listener);
        }
        if (autocompleteRef.current) {
          win.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        }
      };
    }
  }, [setMapCenter, setStreetViewPosition, setEstimateSiteAddress, reset]);

  return (
    <div className="w-full max-w-lg relative z-[60]">
      <input
        ref={inputRef}
        type="text"
        placeholder="Enter address..."
        className="w-full rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-on-surface shadow-sm placeholder:text-on-surface-variant/80 transition-all focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-container/90 focus:ring-offset-2 focus:ring-offset-inverse-surface"
      />

      <style>{`
        .pac-container {
          background-color: #ffffff !important;
          border: 1px solid #e2e8f0;
          border-top: none;
          border-radius: 0 0 8px 8px;
          margin-top: 4px;
          box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.15);
          font-family: inherit;
          z-index: 9999 !important;
        }
        .pac-item {
          border-top: 1px solid #f1f5f9;
          padding: 10px 12px;
          color: #475569;
          cursor: pointer;
          transition: background-color 0.15s;
        }
        .pac-item:first-child {
          border-top: none;
        }
        .pac-item:hover {
          background-color: #f8fafc;
        }
        .pac-item-query {
          color: #0f172a;
          font-size: 14px;
        }
        .pac-icon {
          filter: none;
        }
      `}</style>
    </div>
  );
};

export default SearchBar;
