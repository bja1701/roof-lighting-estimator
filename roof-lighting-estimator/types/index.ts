
export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoofNode extends LatLng {
  id: string;
}

export type LineType = 'eave' | 'ridge' | 'hip' | 'valley' | 'rake';

export interface RoofLine {
  id: string;
  startNodeId: string;
  endNodeId: string;
  type: LineType;
  pitch: string; // e.g., "6/12"
}

/**
 * Simplified response structure for Google Solar API BuildingInsights.
 * We only capture what is strictly necessary for this estimator initially.
 */
export interface SolarData {
  name: string;
  center: LatLng;
  solarPotential: {
    maxArrayPanelsCount: number;
    roofSegmentStats: Array<{
      pitchDegrees: number;
      azimuthDegrees: number;
      stats: {
        areaMeters2: number;
        sunshineQuantiles: number[];
      };
    }>;
  };
}

export interface EstimatorState {
  // Domain Data
  nodes: RoofNode[];
  lines: RoofLine[];
  
  // Settings / Pricing
  pricePerFt: number;
  controllerFee: number;
  includeController: boolean;
  
  // Geometry / Calculation
  selectedLineId: string | null;
  totalLength2D: number; // Feet
  totalLength3D: number; // Feet
  estimatedCost: number; // Dollars
  
  // Application State
  selectedTool: 'draw' | 'select';
  visualPitchAngle: number; // Degrees measured in Street View (Tool state)
  isSuperZoom: boolean;
  activeDrawNodeId: string | null; // Tracks the last node added/clicked in draw mode for continuous lines
  
  // Actions
  addNode: (lat: number, lng: number) => string;
  removeNode: (id: string) => void;
  updateNodePosition: (id: string, lat: number, lng: number) => void;
  addLine: (startNodeId: string, endNodeId: string, type?: LineType) => void;
  removeLine: (id: string) => void;
  
  // Selection & Pitch Actions
  selectLine: (id: string | null) => void;
  setActiveDrawNode: (id: string | null) => void;
  updateLinePitch: (id: string, pitch: string) => void;
  
  setSelectedTool: (tool: 'draw' | 'select') => void;
  setVisualPitchAngle: (angle: number) => void;
  toggleSuperZoom: () => void;
  setPricePerFt: (price: number) => void;
  toggleController: () => void;
  calculateTotals: () => void;
  reset: () => void;
}
