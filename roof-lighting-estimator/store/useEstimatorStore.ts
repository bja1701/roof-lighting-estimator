
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { EstimatorState, LineType, LatLng } from '../types/index';
import { calculateDistance, getMultiplierFromPitch } from '../utils/geometry';

interface ExtendedEstimatorState extends EstimatorState {
  // Decoupled Positions
  satelliteCenter: LatLng;
  streetViewPosition: LatLng;
  /** Human-readable site address from Places search (used when saving a quote → job card / Street View). */
  estimateSiteAddress: string | null;

  // Actions
  setMapCenter: (location: LatLng) => void; // Updates Satellite Only (used by Search)
  setStreetViewPosition: (location: LatLng) => void;
  setEstimateSiteAddress: (address: string | null) => void;
  syncStreetViewToSatellite: () => void;
  loadProfilePricing: (pricePerFt: number, controllerFee: number, includeController: boolean) => void;
  restoreCanvas: (canvasState: any) => void;
}

export const useEstimatorStore = create<ExtendedEstimatorState>((set, get) => ({
  // Initial State
  nodes: [],
  lines: [],
  
  // Navigation State
  // Default: 1568 E 550 S, Springville, UT
  satelliteCenter: { lat: 40.157588, lng: -111.575344 }, 
  streetViewPosition: { lat: 40.157588, lng: -111.575344 },
  estimateSiteAddress: null,

  // Pricing / Domain
  pricePerFt: 25.0,
  controllerFee: 300.0,
  includeController: true,
  
  selectedLineId: null,

  totalLength2D: 0,
  totalLength3D: 0,
  estimatedCost: 0,
  selectedTool: 'select', // Default to Select Mode
  visualPitchAngle: 26.6, // Default to ~6/12 visual
  isSuperZoom: false,
  activeDrawNodeId: null,

  // --- Navigation Actions ---

  setMapCenter: (location) => {
    set({ satelliteCenter: location });
  },

  setStreetViewPosition: (location) => {
    set({ streetViewPosition: location });
  },

  setEstimateSiteAddress: (address) => set({ estimateSiteAddress: address }),

  syncStreetViewToSatellite: () => {
    const { satelliteCenter } = get();
    set({ streetViewPosition: { ...satelliteCenter } });
  },

  // --- Domain Actions ---

  addNode: (lat, lng) => {
    const id = uuidv4();
    set((state) => ({
      nodes: [...state.nodes, { id, lat, lng }],
    }));
    get().calculateTotals();
    return id;
  },

  updateNodePosition: (id, lat, lng) => {
    set((state) => ({
      nodes: state.nodes.map((n) => n.id === id ? { ...n, lat, lng } : n),
    }));
    get().calculateTotals();
  },

  removeNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      lines: state.lines.filter((l) => l.startNodeId !== id && l.endNodeId !== id),
      selectedLineId: state.selectedLineId ? null : state.selectedLineId, // Deselect if needed
      activeDrawNodeId: state.activeDrawNodeId === id ? null : state.activeDrawNodeId
    }));
    get().calculateTotals();
  },

  addLine: (startNodeId, endNodeId, type = 'eave') => {
    const existing = get().lines.find(
      (l) =>
        (l.startNodeId === startNodeId && l.endNodeId === endNodeId) ||
        (l.startNodeId === endNodeId && l.endNodeId === startNodeId)
    );

    if (existing) return;

    // Default Pitch Logic:
    // Eaves are typically flat (0/12) for calculation purposes (multiplier 1).
    // Rakes/Ridges usually follow the roof slope (default 6/12).
    const defaultPitch = type === 'eave' ? "0/12" : "6/12";

    const id = uuidv4();
    set((state) => ({
      lines: [...state.lines, { id, startNodeId, endNodeId, type, pitch: defaultPitch }],
      selectedLineId: id, // Auto-select new line
    }));
    get().calculateTotals();
  },

  removeLine: (id) => {
    set((state) => ({
      lines: state.lines.filter((l) => l.id !== id),
      selectedLineId: state.selectedLineId === id ? null : state.selectedLineId,
    }));
    get().calculateTotals();
  },

  selectLine: (id) => {
    set({ selectedLineId: id });
  },

  setActiveDrawNode: (id) => {
    set({ activeDrawNodeId: id });
  },

  updateLinePitch: (id, pitch) => {
    console.log(`[Store] updateLinePitch triggered for Line ${id} -> ${pitch}`);
    set((state) => ({
      lines: state.lines.map((line) =>
        line.id === id ? { ...line, pitch: pitch } : line
      )
    }));
    // Force recalculation immediately after state update
    get().calculateTotals();
  },

  setSelectedTool: (tool) => set({ selectedTool: tool }),

  setVisualPitchAngle: (angle: number) => {
    set({ visualPitchAngle: angle });
  },
  
  toggleSuperZoom: () => set((state) => ({ isSuperZoom: !state.isSuperZoom })),

  setPitch: (pitch: string) => {
    // Legacy support
  },

  loadProfilePricing: (pricePerFt, controllerFee, includeController) => {
    set({ pricePerFt, controllerFee, includeController });
    get().calculateTotals();
  },

  restoreCanvas: (canvasState) => {
    if (!canvasState) return;
    set({
      nodes: canvasState.nodes ?? [],
      lines: canvasState.lines ?? [],
      pricePerFt: canvasState.pricePerFt ?? get().pricePerFt,
      controllerFee: canvasState.controllerFee ?? get().controllerFee,
      includeController: canvasState.includeController ?? get().includeController,
      satelliteCenter: canvasState.satelliteCenter ?? get().satelliteCenter,
      estimateSiteAddress:
        canvasState.estimateSiteAddress !== undefined
          ? canvasState.estimateSiteAddress
          : get().estimateSiteAddress,
      selectedLineId: null,
      activeDrawNodeId: null,
    });
    get().calculateTotals();
  },

  setPricePerFt: (price) => {
    set({ pricePerFt: price });
    get().calculateTotals();
  },

  toggleController: () => {
    set((state) => ({ includeController: !state.includeController }));
    get().calculateTotals();
  },

  reset: () => {
    set({
      nodes: [],
      lines: [],
      selectedLineId: null,
      totalLength2D: 0,
      totalLength3D: 0,
      estimatedCost: 0,
      activeDrawNodeId: null
    });
  },

  calculateTotals: () => {
    const { nodes, lines, pricePerFt, includeController, controllerFee } = get();

    let total2D = 0;
    let total3D = 0;

    lines.forEach((line) => {
      const startNode = nodes.find((n) => n.id === line.startNodeId);
      const endNode = nodes.find((n) => n.id === line.endNodeId);

      if (startNode && endNode) {
        const dist = calculateDistance(startNode, endNode);
        total2D += dist;

        // Pitch Multiplier Logic
        let multiplier = 1.0;
        
        if (line.type === 'eave') {
          // Eaves run along the horizontal plane, so multiplier is 1.0
          multiplier = 1.0;
        } else {
          // Rakes, Valleys, Hips, Ridges affected by pitch
          multiplier = getMultiplierFromPitch(line.pitch || "6/12");
        }
        
        total3D += dist * multiplier;
      }
    });

    let cost = total3D * pricePerFt;
    if (includeController) {
      cost += controllerFee;
    }

    set({
      totalLength2D: parseFloat(total2D.toFixed(2)),
      totalLength3D: parseFloat(total3D.toFixed(2)),
      estimatedCost: parseFloat(cost.toFixed(2)),
    });
  },
}));
