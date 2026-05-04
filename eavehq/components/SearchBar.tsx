import type React from 'react';
import { useEffect, useRef } from 'react';
import { useEstimatorStore } from '../store/useEstimatorStore';

const SearchBar: React.FC = () => {
	const { setMapCenter, setStreetViewPosition, setEstimateSiteAddress, reset } =
		useEstimatorStore();
	const inputRef = useRef<HTMLInputElement>(null);
	const autocompleteRef = useRef<any>(null);

	useEffect(() => {
		const win = window as any;
		if (!win.google?.maps?.places) return;

		if (inputRef.current) {
			autocompleteRef.current = new win.google.maps.places.Autocomplete(
				inputRef.current,
				{
					fields: ['geometry', 'formatted_address'],
					types: ['geocode', 'establishment'],
				}
			);

			const listener = autocompleteRef.current.addListener(
				'place_changed',
				() => {
					const place = autocompleteRef.current?.getPlace();
					if (place?.geometry?.location) {
						const location = place.geometry.location;
						const newLatLng = { lat: location.lat(), lng: location.lng() };
						setMapCenter(newLatLng);
						setStreetViewPosition(newLatLng);
						reset();
						setEstimateSiteAddress(place.formatted_address?.trim() || null);
					}
				}
			);

			return () => {
				if (listener) win.google.maps.event.removeListener(listener);
				if (autocompleteRef.current)
					win.google.maps.event.clearInstanceListeners(autocompleteRef.current);
			};
		}
	}, [setMapCenter, setStreetViewPosition, setEstimateSiteAddress, reset]);

	return (
		<div className="w-full max-w-lg relative z-[60]">
			<input
				ref={inputRef}
				type="text"
				placeholder="Enter address..."
				className="w-full rounded-lg px-4 py-2 text-sm transition-all focus:outline-none"
				style={{
					background: 'rgba(255,255,255,0.1)',
					border: '1px solid rgba(255,255,255,0.18)',
					color: '#fff',
					caretColor: '#fff',
				}}
				onFocus={(e) => {
					e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
					e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)';
				}}
				onBlur={(e) => {
					e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
					e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
				}}
			/>

			<style>{`
        .pac-container {
          background-color: #ffffff !important;
          border: 1px solid var(--color-border);
          border-top: none;
          border-radius: 0 0 var(--radius-md) var(--radius-md);
          margin-top: 4px;
          box-shadow: var(--shadow-dropdown);
          font-family: var(--font-body);
          z-index: 9999 !important;
        }
        .pac-item {
          border-top: 1px solid var(--color-border);
          padding: 10px 12px;
          color: var(--color-slate);
          cursor: pointer;
          transition: background-color 0.15s;
        }
        .pac-item:first-child { border-top: none; }
        .pac-item:hover { background-color: var(--color-surface); }
        .pac-item-query { color: var(--color-ink); font-size: 14px; }
        .pac-icon { filter: none; }
      `}</style>
		</div>
	);
};

export default SearchBar;
