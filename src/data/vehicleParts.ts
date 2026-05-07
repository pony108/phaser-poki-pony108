export interface VehiclePartRect {
  x: number
  y: number
  width: number
  height: number
}

export interface VehiclePartDefinition {
  key: string
  label: string
  rects: VehiclePartRect[]
}

function rect(x: number, y: number, width: number, height: number): VehiclePartRect {
  return { x, y, width, height }
}

function carParts(width: number, height: number): VehiclePartDefinition[] {
  return [
    { key: 'hood', label: 'Hood', rects: [rect(width * 0.24, height * 0.08, width * 0.52, height * 0.18)] },
    { key: 'windows', label: 'Windows', rects: [rect(width * 0.26, height * 0.28, width * 0.48, height * 0.18)] },
    { key: 'doors', label: 'Doors', rects: [rect(width * 0.2, height * 0.46, width * 0.6, height * 0.24)] },
    { key: 'trunk', label: 'Trunk', rects: [rect(width * 0.26, height * 0.72, width * 0.48, height * 0.17)] },
    {
      key: 'wheels',
      label: 'Wheels',
      rects: [
        rect(width * 0.03, height * 0.25, width * 0.18, height * 0.18),
        rect(width * 0.79, height * 0.25, width * 0.18, height * 0.18),
        rect(width * 0.03, height * 0.64, width * 0.18, height * 0.18),
        rect(width * 0.79, height * 0.64, width * 0.18, height * 0.18)
      ]
    }
  ]
}

function truckParts(width: number, height: number): VehiclePartDefinition[] {
  return [
    { key: 'cab', label: 'Cab', rects: [rect(width * 0.22, height * 0.08, width * 0.56, height * 0.24)] },
    { key: 'bed', label: 'Bed', rects: [rect(width * 0.16, height * 0.38, width * 0.68, height * 0.34)] },
    { key: 'tailgate', label: 'Tailgate', rects: [rect(width * 0.2, height * 0.76, width * 0.6, height * 0.12)] },
    {
      key: 'wheels',
      label: 'Wheels',
      rects: [
        rect(width * 0.02, height * 0.28, width * 0.2, height * 0.18),
        rect(width * 0.78, height * 0.28, width * 0.2, height * 0.18),
        rect(width * 0.02, height * 0.68, width * 0.2, height * 0.18),
        rect(width * 0.78, height * 0.68, width * 0.2, height * 0.18)
      ]
    }
  ]
}

export function getVehicleParts(vehicleType: number, width: number, height: number): VehiclePartDefinition[] {
  if (vehicleType === 2 || vehicleType === 3 || vehicleType === 5 || vehicleType === 6) {
    return truckParts(width, height)
  }

  return carParts(width, height)
}
