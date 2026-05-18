
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, Marker, Polyline, OverlayView } from '@react-google-maps/api';
import { useEstimatorStore } from '../store/useEstimatorStore';
import { getColorForPitch, SELECTED_LINE_COLOR } from '../utils/pitchColors';

/** Perpendicular distance from point P to line segment AB, in pixels. */
function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Trackpad cursor position in canvas pixel space
interface CursorPos {
  x: number;
  y: number;
}

const containerStyle = {
  width: '100%',
  height: '100%',
};

// Map options (gesture/draggable are set dynamically per tool — see JSX)
const mapOptions = {
  mapTypeId: 'satellite',
  disableDefaultUI: true,
  tilt: 0,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  disableDoubleClickZoom: true,
};

// How far (canvas px) the cursor must be from a node to "lock" in edit mode
const EDIT_LOCK_RADIUS = 20;
// Sensitivity multiplier for trackpad-style cursor movement (1.0 = 1:1)
const CURSOR_SENSITIVITY = 1.0;
// Additional sensitivity reduction for edit mode — cursor moves at 30% of finger speed
const TRACKPAD_SENSITIVITY = 0.3;
// Max movement (px) + max duration (ms) for a tap to be considered a "click"
const TAP_MAX_MOVE = 8;
const TAP_MAX_MS = 200;

const SatelliteCanvas: React.FC = () => {
  const {
    nodes,
    lines,
    satelliteCenter,
    addNode,
    addLine,
    selectedTool,
    removeLine,
    selectedLineId,
    selectLine,
    isSuperZoom,
    activeDrawNodeId,
    setActiveDrawNode,
    updateNodePosition,
    pushUndo,
  } = useEstimatorStore();

  const [showHelper, setShowHelper] = useState(false);

  // Overlay projection for pixel ↔ LatLng conversion
  const [overlayProjection, setOverlayProjection] = useState<any>(null);
  const mapRef = useRef<any>(null);

  // Touch drag state — for repositioning a node in select mode (direct touch)
  const capturedNodeId = useRef<string | null>(null);

  // Wrapper ref for native (non-passive) touch listeners
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Cached bounding rect — refreshed at touchstart from the map div
  const rectRef = useRef<DOMRect | null>(null);

  // --- Trackpad cursor state (draw + edit modes) ---
  const cursorPosRef = useRef<CursorPos>({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState<CursorPos>({ x: 0, y: 0 });
  const cursorInitializedRef = useRef(false);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const touchMovedRef = useRef(0);

  // --- Edit mode state ---
  const nearestEditNodeRef = useRef<string | null>(null);
  const [nearestEditNode, setNearestEditNode] = useState<string | null>(null);
  const grabbedNodeRef = useRef<string | null>(null);
  const [grabbedNode, setGrabbedNode] = useState<string | null>(null);

  // Native double-tap tracking for line selection in select mode (gestureHandling:'greedy' swallows onDblClick on mobile)
  const lastSelectTapRef = useRef<{ x: number; y: number; t: number } | null>(null);

  // Detect touch device at mount
  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

  // Track whether the last interaction was a touch-end commit (suppress ghost click)
  const touchCommittedRef = useRef(false);

  // --- Tool Helper Fade Logic ---
  useEffect(() => {
    setShowHelper(true);
    const timer = setTimeout(() => setShowHelper(false), 1500);
    return () => clearTimeout(timer);
  }, [selectedTool]);

  // Initialize cursor to canvas center when entering draw or edit mode
  useEffect(() => {
    if (selectedTool === 'draw' || selectedTool === 'edit') {
      if (!cursorInitializedRef.current && wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        const center = { x: rect.width / 2, y: rect.height / 2 };
        cursorPosRef.current = center;
        setCursorPos(center);
        cursorInitializedRef.current = true;
      }
    } else {
      cursorInitializedRef.current = false;
    }
  }, [selectedTool]);

  /**
   * Convert a canvas pixel position to LatLng using the overlay projection.
   */
  const canvasPxToLatLng = useCallback((x: number, y: number) => {
    if (!overlayProjection) return null;
    const win = window as any;
    if (!win.google || !win.google.maps) return null;
    const scaleFactor = isSuperZoom ? 2 : 1;
    const point = new win.google.maps.Point(x / scaleFactor, y / scaleFactor);
    return overlayProjection.fromContainerPixelToLatLng(point);
  }, [overlayProjection, isSuperZoom]);

  /**
   * Find the canvas pixel position of a node (LatLng → canvas px).
   */
  const nodeToCanvasPx = useCallback((lat: number, lng: number) => {
    if (!overlayProjection) return null;
    const win = window as any;
    if (!win.google || !win.google.maps) return null;
    const px = overlayProjection.fromLatLngToContainerPixel(
      new win.google.maps.LatLng(lat, lng)
    );
    if (!px) return null;
    const scaleFactor = isSuperZoom ? 2 : 1;
    return { x: px.x * scaleFactor, y: px.y * scaleFactor };
  }, [overlayProjection, isSuperZoom]);

  /**
   * Find the closest node to a canvas pixel position, within a given radius.
   */
  const findNearestNode = useCallback((cx: number, cy: number, radius: number): string | null => {
    let closest: string | null = null;
    let closestDist = radius;
    for (const node of nodes) {
      const px = nodeToCanvasPx(node.lat, node.lng);
      if (!px) continue;
      const dist = Math.hypot(px.x - cx, px.y - cy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = node.id;
      }
    }
    return closest;
  }, [nodes, nodeToCanvasPx]);

  /**
   * Update nearestEditNode based on cursor position (edit mode only).
   */
  const updateEditProximity = useCallback((cx: number, cy: number) => {
    if (selectedTool !== 'edit') return;
    const nearest = findNearestNode(cx, cy, EDIT_LOCK_RADIUS);
    nearestEditNodeRef.current = nearest;
    setNearestEditNode(nearest);
  }, [selectedTool, findNearestNode]);

  /**
   * MASTER CLICK HANDLER (Wrapper DIV) — Mouse-only.
   */
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (touchCommittedRef.current) {
      touchCommittedRef.current = false;
      return;
    }
    if (isSuperZoom) return;

    if (selectedTool === 'select') {
      selectLine(null);
      setActiveDrawNode(null);
      return;
    }

    if (selectedTool === 'draw') {
      if (!overlayProjection || !mapRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const latLng = canvasPxToLatLng(x, y);
      if (latLng) {
        pushUndo();
        const newNodeId = addNode(latLng.lat(), latLng.lng());
        if (activeDrawNodeId) addLine(activeDrawNodeId, newNodeId, 'eave');
        setActiveDrawNode(newNodeId);
      }
    }
  };

  /**
   * LINE INTERACTION HANDLERS
   * Desktop: onDblClick on Polyline works fine (mouse events unaffected by gestureHandling).
   * Mobile: double-tap is detected natively in handleTouchEnd via pixel hit-test,
   * because gestureHandling:'greedy' intercepts the second tap before it reaches onDblClick.
   */
  const handleLineClick = (e: any, _lineId: string) => {
    if (isSuperZoom) return;
    // Stop propagation so handleCanvasClick doesn't also fire (which would deselect)
    if (selectedTool === 'select' && e.domEvent) e.domEvent.stopPropagation();
  };

  const handleLineDblClick = (e: any, lineId: string) => {
    // Desktop double-click path (works because mouse events respect disableDoubleClickZoom)
    if (selectedTool === 'select') {
      selectLine(lineId);
      if (e.domEvent) e.domEvent.stopPropagation();
    }
  };

  const handleNodeDragEnd = (e: any, nodeId: string) => {
    if (e.latLng) {
      pushUndo();
      updateNodePosition(nodeId, e.latLng.lat(), e.latLng.lng());
    }
  };

  const handleNodeClick = (e: any, nodeId: string) => {
    if (e.stop) e.stop();
    if (isSuperZoom) return;
    if (selectedTool === 'draw') {
      if (activeDrawNodeId && activeDrawNodeId !== nodeId) {
        addLine(activeDrawNodeId, nodeId, 'eave');
        setActiveDrawNode(nodeId);
      } else {
        setActiveDrawNode(nodeId);
      }
    }
  };

  // --- Native Touch Handlers ---

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const mapDiv = (mapRef.current as any)?.getDiv?.() as HTMLElement | undefined;
    rectRef.current = mapDiv?.getBoundingClientRect()
      ?? wrapperRef.current?.getBoundingClientRect()
      ?? null;

    if (isSuperZoom) return;
    if (e.touches.length > 1) return;
    if (!overlayProjection) return;

    const touch = e.touches[0];
    if (!rectRef.current) return;

    // Record touch start for tap detection
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
    touchMovedRef.current = 0;

    // --- Trackpad cursor mode (draw or edit) ---
    if (selectedTool === 'draw' || selectedTool === 'edit') {
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      e.preventDefault();
      return;
    }

    // --- Select mode: direct node drag ---
    if (selectedTool === 'select') {
      const rect = rectRef.current;
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      const win = window as any;
      if (!win.google || !win.google.maps) return;

      let closestId: string | null = null;
      let closestDist = Infinity;
      for (const node of nodes) {
        const nodePoint = overlayProjection.fromLatLngToContainerPixel(
          new win.google.maps.LatLng(node.lat, node.lng)
        );
        if (!nodePoint) continue;
        const dist = Math.hypot(nodePoint.x - x, nodePoint.y - y);
        if (dist < 36 && dist < closestDist) {
          closestDist = dist;
          closestId = node.id;
        }
      }

      if (closestId) {
        capturedNodeId.current = closestId;
        pushUndo();
        e.preventDefault();
      }
    }
  }, [isSuperZoom, overlayProjection, nodes, pushUndo, selectedTool]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isSuperZoom) return;
    if (e.touches.length > 1) return;

    const touch = e.touches[0];

    // Track movement for tap detection
    if (touchStartRef.current) {
      touchMovedRef.current = Math.hypot(
        touch.clientX - touchStartRef.current.x,
        touch.clientY - touchStartRef.current.y
      );
    }

    // --- Trackpad cursor mode ---
    if ((selectedTool === 'draw' || selectedTool === 'edit') && lastTouchRef.current) {
      e.preventDefault();
      const sensitivityMultiplier = selectedTool === 'edit' ? TRACKPAD_SENSITIVITY : CURSOR_SENSITIVITY;
      const dx = (touch.clientX - lastTouchRef.current.x) * sensitivityMultiplier;
      const dy = (touch.clientY - lastTouchRef.current.y) * sensitivityMultiplier;
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };

      const el = wrapperRef.current;
      const w = el?.clientWidth ?? 0;
      const h = el?.clientHeight ?? 0;
      const newPos = {
        x: Math.max(0, Math.min(w, cursorPosRef.current.x + dx)),
        y: Math.max(0, Math.min(h, cursorPosRef.current.y + dy)),
      };
      cursorPosRef.current = newPos;
      setCursorPos({ ...newPos });

      // In edit mode with a grabbed node: move the node live
      if (selectedTool === 'edit' && grabbedNodeRef.current) {
        const latLng = canvasPxToLatLng(newPos.x, newPos.y);
        if (latLng) {
          updateNodePosition(grabbedNodeRef.current, latLng.lat(), latLng.lng());
        }
      } else if (selectedTool === 'edit') {
        updateEditProximity(newPos.x, newPos.y);
      }
      return;
    }

    // --- Select mode: node drag ---
    if (!rectRef.current) return;
    const rect = rectRef.current;
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (capturedNodeId.current && overlayProjection) {
      e.preventDefault();
      const latLng = canvasPxToLatLng(x, y);
      if (latLng) {
        updateNodePosition(capturedNodeId.current, latLng.lat(), latLng.lng());
      }
    }
  }, [isSuperZoom, overlayProjection, selectedTool, updateNodePosition, canvasPxToLatLng, updateEditProximity]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, [handleTouchStart, handleTouchMove]);

  const handleTouchEnd = useCallback((_e: React.TouchEvent<HTMLDivElement>) => {
    const isTap =
      touchStartRef.current !== null &&
      touchMovedRef.current < TAP_MAX_MOVE &&
      Date.now() - touchStartRef.current.t < TAP_MAX_MS;

    // --- Select mode: native double-tap hit-test for line selection ---
    // gestureHandling:'greedy' intercepts double-tap for map zoom, so we detect it here
    // using native touch coordinates rather than relying on Polyline's onDblClick.
    if (selectedTool === 'select' && isTap && touchStartRef.current && rectRef.current) {
      const tapX = touchStartRef.current.x - rectRef.current.left;
      const tapY = touchStartRef.current.y - rectRef.current.top;
      const now = Date.now();
      const last = lastSelectTapRef.current;
      const isDoubleTap = last !== null &&
        (now - last.t) < 400 &&
        Math.hypot(tapX - last.x, tapY - last.y) < 44;

      if (isDoubleTap) {
        // Hit-test: find the line segment closest to the tap
        const win = window as any;
        if (overlayProjection && win.google?.maps) {
          const { lines: storeLines, nodes: storeNodes } = useEstimatorStore.getState();
          let closestId: string | null = null;
          let closestDist = 22; // px — generous for finger-sized targets
          for (const line of storeLines) {
            const s = storeNodes.find(n => n.id === line.startNodeId);
            const e2 = storeNodes.find(n => n.id === line.endNodeId);
            if (!s || !e2) continue;
            const p1 = overlayProjection.fromLatLngToContainerPixel(
              new win.google.maps.LatLng(s.lat, s.lng)
            );
            const p2 = overlayProjection.fromLatLngToContainerPixel(
              new win.google.maps.LatLng(e2.lat, e2.lng)
            );
            if (!p1 || !p2) continue;
            const dist = pointToSegmentDist(tapX, tapY, p1.x, p1.y, p2.x, p2.y);
            if (dist < closestDist) { closestDist = dist; closestId = line.id; }
          }
          if (closestId) {
            selectLine(closestId);
            touchCommittedRef.current = true;
          }
        }
        lastSelectTapRef.current = null;
      } else {
        // Single tap: deselect and record for potential double-tap
        selectLine(null);
        lastSelectTapRef.current = { x: tapX, y: tapY, t: now };
        touchCommittedRef.current = true;
      }
    }

    // --- Draw mode tap: place node at cursor ---
    if (selectedTool === 'draw' && isTap && overlayProjection) {
      const { x, y } = cursorPosRef.current;
      const latLng = canvasPxToLatLng(x, y);
      if (latLng) {
        pushUndo();
        const newNodeId = addNode(latLng.lat(), latLng.lng());
        if (activeDrawNodeId) addLine(activeDrawNodeId, newNodeId, 'eave');
        setActiveDrawNode(newNodeId);
        touchCommittedRef.current = true;
      }
    }

    // --- Edit mode tap: grab/release node ---
    if (selectedTool === 'edit' && isTap) {
      if (grabbedNodeRef.current) {
        grabbedNodeRef.current = null;
        setGrabbedNode(null);
        touchCommittedRef.current = true;
      } else if (nearestEditNodeRef.current) {
        pushUndo();
        grabbedNodeRef.current = nearestEditNodeRef.current;
        setGrabbedNode(nearestEditNodeRef.current);
        touchCommittedRef.current = true;
      }
    }

    // Reset select-mode drag
    capturedNodeId.current = null;
    lastTouchRef.current = null;
    touchStartRef.current = null;
  }, [selectedTool, overlayProjection, canvasPxToLatLng, pushUndo, addNode, activeDrawNodeId, addLine, setActiveDrawNode]);

  // Always use the job address center — never chase the last placed node.
  const activeCenter = satelliteCenter;

  // Cursor style for the wrapper div
  let cursorClass = '';
  if (isSuperZoom) {
    cursorClass = 'cursor-zoom-out';
  } else if (selectedTool === 'draw') {
    cursorClass = 'cursor-crosshair';
  } else {
    cursorClass = 'cursor-default';
  }

  // Whether to show the trackpad cursor overlay
  const showTrackpadCursor = (selectedTool === 'draw' || selectedTool === 'edit') && isTouchDevice;

  // Cursor visual state
  const cursorLocked = selectedTool === 'edit' && nearestEditNode !== null;
  const cursorGrabbed = selectedTool === 'edit' && grabbedNode !== null;

  return (
    <div className="relative w-full h-full overflow-hidden group" style={{ background: 'rgba(15,25,40,0.98)' }}>

      {/* Transform Wrapper */}
      <div
        ref={wrapperRef}
        className={`w-full h-full transition-transform duration-300 origin-center ${
          isSuperZoom ? 'scale-[2]' : 'scale-100'
        } ${cursorClass}`}
        onClick={handleCanvasClick}
        onTouchEnd={handleTouchEnd}
      >
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={activeCenter}
          zoom={20}
          options={{
            ...mapOptions,
            gestureHandling: (selectedTool === 'draw' || selectedTool === 'edit') ? 'none' : 'greedy',
            draggable: selectedTool !== 'draw' && selectedTool !== 'edit',
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
            const isClickable = selectedTool !== 'draw';

            return (
              <Polyline
                key={line.id}
                path={[start, end]}
                onClick={(e) => handleLineClick(e, line.id)}
                onDblClick={(e) => handleLineDblClick(e, line.id)}
                options={{
                  strokeColor,
                  strokeOpacity: 1.0,
                  strokeWeight: isSelected ? 6 : 4,
                  zIndex: isSelected ? 100 : 1,
                  clickable: isClickable,
                }}
              />
            );
          })}

          {/* Render Nodes */}
          {nodes.map((node) => (
            <Marker
              key={node.id}
              position={node}
              onClick={(e) => handleNodeClick(e, node.id)}
              draggable={selectedTool === 'select'}
              onDragEnd={(e) => handleNodeDragEnd(e, node.id)}
              icon={{
                path: (window as any).google?.maps?.SymbolPath?.CIRCLE || 0,
                fillColor: activeDrawNodeId === node.id ? '#fb923c' : '#f97316',
                fillOpacity: 1,
                strokeColor: '#7c2d12',
                strokeWeight: 2,
                // BUG 3 fix: scale 4 on touch (was 8) — precise without losing 36px tap target.
                scale: isTouchDevice
                  ? 4
                  : selectedTool === 'draw' ? 3 : 2,
              }}
              clickable={selectedTool === 'draw' || selectedTool === 'select'}
              cursor={selectedTool === 'draw' ? 'crosshair' : 'grab'}
            />
          ))}
        </GoogleMap>
      </div>

      {/* Trackpad cursor overlay — draw + edit modes, touch only */}
      {showTrackpadCursor && (
        <div
          className="absolute pointer-events-none z-50"
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Outer ring */}
          <div
            style={{
              position: 'absolute',
              width: 16,
              height: 16,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: `1.5px solid ${cursorGrabbed ? '#f97316' : cursorLocked ? '#fb923c' : 'rgba(255,255,255,0.9)'}`,
              boxShadow: '0 0 4px rgba(0,0,0,0.7)',
            }}
          />
          {/* Center dot */}
          <div
            style={{
              position: 'absolute',
              width: cursorLocked || cursorGrabbed ? 5 : 3,
              height: cursorLocked || cursorGrabbed ? 5 : 3,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: cursorGrabbed ? '#f97316' : cursorLocked ? '#fb923c' : 'rgba(255,255,255,0.95)',
            }}
          />
          {/* Horizontal arm */}
          <div
            style={{
              position: 'absolute',
              width: 20,
              height: 1,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: cursorGrabbed ? '#f97316' : 'rgba(255,255,255,0.7)',
              boxShadow: '0 0 2px rgba(0,0,0,0.6)',
            }}
          />
          {/* Vertical arm */}
          <div
            style={{
              position: 'absolute',
              width: 1,
              height: 20,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: cursorGrabbed ? '#f97316' : 'rgba(255,255,255,0.7)',
              boxShadow: '0 0 2px rgba(0,0,0,0.6)',
            }}
          />
        </div>
      )}

      {/* Centered Helper Notification */}
      <div
        className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none transition-opacity duration-500 ease-out ${
          showHelper ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {selectedTool === 'select' && (
          <div
            className="text-lg font-bold px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
            style={{
              background: 'rgba(15,25,40,0.92)',
              border: '1px solid rgba(217,111,10,0.35)',
              color: 'var(--color-accent)',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path><path d="M13 13l6 6"></path></svg>
            <span>Double-click lines to select</span>
          </div>
        )}
        {selectedTool === 'draw' && (
          <div
            className="text-lg font-bold px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
            style={{
              background: 'rgba(15,25,40,0.92)',
              border: '1px solid rgba(58,99,73,0.42)',
              color: '#d9e8de',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>
            <span>Slide to aim — tap to place</span>
          </div>
        )}
        {selectedTool === 'edit' && (
          <div
            className="text-lg font-bold px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
            style={{
              background: 'rgba(15,25,40,0.92)',
              border: '1px solid rgba(14,165,233,0.42)',
              color: '#7dd3fc',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
            <span>Slide to aim — tap node to move</span>
          </div>
        )}
      </div>

    </div>
  );
};

export default SatelliteCanvas;
