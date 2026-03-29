
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, Marker, Polyline, OverlayView } from '@react-google-maps/api';
import { useEstimatorStore } from '../store/useEstimatorStore';
import { getColorForPitch, SELECTED_LINE_COLOR } from '../utils/pitchColors';

const containerStyle = {
  width: '100%',
  height: '100%',
};

// Map options
const mapOptions = {
  mapTypeId: 'satellite',
  disableDefaultUI: true,
  tilt: 0,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  gestureHandling: 'greedy',
  disableDoubleClickZoom: true, // IMPORTANT: Disable DblClick Zoom for interaction
  draggable: true,
};

const SatelliteCanvas: React.FC = () => {
  const { 
    nodes, 
    lines, 
    satelliteCenter, 
    addNode, 
    removeNode,
    addLine,
    selectedTool,
    removeLine,
    selectedLineId,
    selectLine,
    isSuperZoom,
    activeDrawNodeId,
    setActiveDrawNode,
    updateNodePosition
  } = useEstimatorStore();

  const [showHelper, setShowHelper] = useState(false);
  
  // We need the overlay projection to convert pixels (from the div click) to LatLng
  const [overlayProjection, setOverlayProjection] = useState<any>(null);
  const mapRef = useRef<any>(null);

  // --- Tool Helper Fade Logic ---
  useEffect(() => {
    setShowHelper(true);
    const timer = setTimeout(() => {
      setShowHelper(false);
    }, 1500); // Display for 1.5 seconds
    return () => clearTimeout(timer);
  }, [selectedTool]);

  /**
   * MASTER CLICK HANDLER (Wrapper DIV)
   * This handles clicks on the map background.
   * - Draw Mode: Adds Node
   * - Select Mode: Deselects Line
   */
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 1. If Zoomed, disable interaction
    if (isSuperZoom) return;

    // 2. Select Mode Logic: Clicking empty space clears selection
    if (selectedTool === 'select') {
        selectLine(null);
        setActiveDrawNode(null);
        return;
    }

    // 3. Draw Mode Logic: Add Node
    if (selectedTool === 'draw') {
        // If we don't have the projection or map, we can't do math.
        if (!overlayProjection || !mapRef.current) return;

        // Get click coordinates relative to the map container
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Apply the Scale Correction
        const scaleFactor = isSuperZoom ? 2 : 1;
        const correctedX = x / scaleFactor;
        const correctedY = y / scaleFactor;

        // Convert to LatLng
        const win = window as any;
        if (!win.google || !win.google.maps) return;

        const point = new win.google.maps.Point(correctedX, correctedY);
        const latLng = overlayProjection.fromContainerPixelToLatLng(point);

        if (latLng) {
            const newNodeId = addNode(latLng.lat(), latLng.lng());
            
            // Auto-connect if we have a previous node
            if (activeDrawNodeId) {
                addLine(activeDrawNodeId, newNodeId, 'eave');
            }
            setActiveDrawNode(newNodeId);
        }
    }
  };

  /**
   * LINE INTERACTION HANDLERS
   */
  
  // Single Click on Line
  const handleLineClick = (e: any, lineId: string) => {
    if (isSuperZoom) return;

    // Select Mode: Single click does nothing BUT blocks the map click (which would deselect)
    if (selectedTool === 'select') {
        if (e.domEvent) e.domEvent.stopPropagation();
        return;
    }

    // Draw Mode: Pass through (handled by clickable={false} prop below)
  };

  // Double Click on Line
  const handleLineDblClick = (e: any, lineId: string) => {
    if (selectedTool === 'select') {
        selectLine(lineId);
        // Stop bubbling so the map doesn't zoom (already disabled) or deselect
        if (e.domEvent) e.domEvent.stopPropagation();
    }
  };

  // Node Drag End (for repositioning in Select Mode)
  const handleNodeDragEnd = (e: any, nodeId: string) => {
    if (e.latLng) {
      updateNodePosition(nodeId, e.latLng.lat(), e.latLng.lng());
    }
  };

  // Node Click (for connecting lines in Draw Mode)
  const handleNodeClick = (e: any, nodeId: string) => {
    if (e.stop) e.stop(); 
    if (isSuperZoom) return;

    // Only allow linking in Draw mode
    if (selectedTool === 'draw') {
        if (activeDrawNodeId && activeDrawNodeId !== nodeId) {
            addLine(activeDrawNodeId, nodeId, 'eave');
            setActiveDrawNode(nodeId);
        } else {
            setActiveDrawNode(nodeId);
        }
    }
  };


  const activeCenter = nodes.length > 0 ? nodes[nodes.length - 1] : satelliteCenter;

  // Determine Cursor Style
  let cursorClass = '';
  if (isSuperZoom) {
    cursorClass = 'cursor-zoom-out';
  } else if (selectedTool === 'draw') {
    cursorClass = 'cursor-crosshair';
  } else {
    cursorClass = 'cursor-default';
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden group">
      
      {/* 
         The Transform Wrapper 
      */}
      <div 
        className={`w-full h-full transition-transform duration-300 origin-center ${
            isSuperZoom ? 'scale-[2]' : 'scale-100'
        } ${cursorClass}`}
        onClick={handleCanvasClick}
      >
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={activeCenter}
          zoom={20}
          options={{
            ...mapOptions,
            draggableCursor: isSuperZoom ? 'not-allowed' : (selectedTool === 'draw' ? 'crosshair' : 'default'), 
          }}
          onLoad={(map) => { mapRef.current = map; }}
        >
          {/* Projection Helper */}
          <OverlayView
            position={activeCenter}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            onLoad={(overlay) => setOverlayProjection(overlay.getProjection())}
          >
            <div />
          </OverlayView>

          {/* Render Lines */}
          {lines.map((line) => {
            const start = nodes.find(n => n.id === line.startNodeId);
            const end = nodes.find(n => n.id === line.endNodeId);
            if (!start || !end) return null;

            const isSelected = selectedLineId === line.id;
            const strokeColor = isSelected ? SELECTED_LINE_COLOR : getColorForPitch(line.pitch);
            
            // Interaction Props based on Tool
            const isClickable = selectedTool !== 'draw'; // In Draw mode, lines are ghosts

            return (
              <Polyline
                key={line.id}
                path={[start, end]}
                onClick={(e) => handleLineClick(e, line.id)}
                onDblClick={(e) => handleLineDblClick(e, line.id)}
                options={{
                  strokeColor: strokeColor,
                  strokeOpacity: 1.0,
                  strokeWeight: isSelected ? 6 : 4,
                  zIndex: isSelected ? 100 : 1,
                  clickable: isClickable, 
                }}
              />
            );
          })}

          {/* Render Nodes */}
          {/* Only render nodes in Draw mode or if needed for debugging/visuals. 
              Usually useful to see them to connect lines. */}
          {nodes.map((node) => (
            <Marker
              key={node.id}
              position={node}
              onClick={(e) => handleNodeClick(e, node.id)}
              draggable={selectedTool === 'select'} // Drag to reposition in select mode
              onDragEnd={(e) => handleNodeDragEnd(e, node.id)}
              icon={{
                path: (window as any).google?.maps?.SymbolPath?.CIRCLE || 0,
                fillColor: activeDrawNodeId === node.id ? '#3b82f6' : '#ffffff',
                fillOpacity: 1,
                strokeColor: '#000000',
                strokeWeight: 1,
                scale: selectedTool === 'draw' ? 3 : 2, // Make nodes slightly bigger in draw mode
              }}
              clickable={selectedTool === 'draw' || selectedTool === 'select'}
              cursor={selectedTool === 'draw' ? 'crosshair' : 'grab'}
            />
          ))}
        </GoogleMap>
      </div>
      
      {/* Centered Helper Notification */}
      <div 
        className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none transition-opacity duration-500 ease-out ${
          showHelper ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {selectedTool === 'select' && (
          <div className="bg-black/70 backdrop-blur-md text-amber-400 text-lg font-bold px-6 py-3 rounded-2xl border border-amber-500/50 shadow-2xl flex items-center gap-3">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path><path d="M13 13l6 6"></path></svg>
             <span>Double-click lines to select</span>
          </div>
        )}
        {selectedTool === 'draw' && (
           <div className="bg-black/70 backdrop-blur-md text-blue-400 text-lg font-bold px-6 py-3 rounded-2xl border border-blue-500/50 shadow-2xl flex items-center gap-3">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>
             <span>Click map to add points</span>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default SatelliteCanvas;
