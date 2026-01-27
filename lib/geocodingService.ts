/**
 * OpenStreetMap Reverse Geocoding Service
 * Converts GPS coordinates to human-readable Hebrew address
 * Uses Nominatim API (free, no API key required)
 */

export interface ReverseGeocodeResult {
  success: boolean
  address: string | null
  fullAddress?: string // Complete formatted address for legal documents
  city?: string
  street?: string
  houseNumber?: string
  suburb?: string
  pointOfInterest?: string // Nearby landmark or POI
  raw?: any
  error?: string
}

/**
 * Reverse geocode GPS coordinates to Hebrew address
 * Optimized for legal document readability
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Formatted Hebrew address suitable for legal letters
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  try {
    // Nominatim requires User-Agent header
    // Using addressdetails=1 to get more granular address components
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=he&addressdetails=1&namedetails=1`,
      {
        headers: {
          'User-Agent': 'CashBus/1.0 (Legal-Tech Platform)',
        },
      }
    )

    if (!response.ok) {
      return {
        success: false,
        address: null,
        error: `Nominatim API error: ${response.status}`,
      }
    }

    const data = await response.json()

    // Extract address components
    const address = data.address || {}
    const displayName = data.display_name || ''
    const nameDetails = data.namedetails || {}

    // Identify city/town (handle various Israeli locality types)
    const city = address.city || address.town || address.village ||
                 address.municipality || address.local_administrative_area

    // Identify neighborhood/area
    const neighborhood = address.suburb || address.neighbourhood ||
                         address.quarter || address.residential

    // Identify street - handle numbered roads (like "5711")
    let street = address.road || address.street || address.pedestrian

    // Check if street is just a number (like "5711") - this is usually a road number, not useful
    const isNumericStreet = street && /^\d+$/.test(street.trim())

    // Identify point of interest (school, bus station, etc.)
    const poi = address.amenity || address.building || address.leisure ||
                address.shop || address.tourism || address.public_transport ||
                nameDetails.name

    // Build comprehensive address for legal documents
    let formattedAddress = ''
    let fullAddress = ''

    // Strategy 1: Street + House Number (best case)
    if (street && !isNumericStreet && address.house_number) {
      formattedAddress = `רחוב ${street} ${address.house_number}`
      if (city) {
        formattedAddress += `, ${city}`
      }
    }
    // Strategy 2: Street only (good)
    else if (street && !isNumericStreet) {
      formattedAddress = `רחוב ${street}`
      if (city) {
        formattedAddress += `, ${city}`
      }
    }
    // Strategy 3: POI + City (for bus stops, schools, etc.)
    else if (poi && city) {
      formattedAddress = `ליד ${poi}, ${city}`
    }
    // Strategy 4: Neighborhood + City
    else if (neighborhood && city) {
      formattedAddress = `שכונת ${neighborhood}, ${city}`
    }
    // Strategy 5: City only
    else if (city) {
      // Try to add more context from display_name
      const displayParts = displayName.split(',').map((p: string) => p.trim())
      if (displayParts.length > 1 && displayParts[0] !== city) {
        formattedAddress = `אזור ${displayParts[0]}, ${city}`
      } else {
        formattedAddress = city
      }
    }
    // Strategy 6: Parse display_name intelligently
    else if (displayName) {
      const displayParts = displayName.split(',').map((p: string) => p.trim())
      // Filter out country, postcode, and generic terms
      const meaningfulParts = displayParts.filter((part: string) =>
        !['ישראל', 'Israel'].includes(part) &&
        !/^\d{5,}$/.test(part) // Filter postcodes
      ).slice(0, 3) // Take first 3 meaningful parts

      if (meaningfulParts.length > 0) {
        formattedAddress = meaningfulParts.join(', ')
      } else {
        formattedAddress = `מיקום GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
      }
    }
    // Fallback: Coordinates
    else {
      formattedAddress = `מיקום GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
    }

    // Build full address for legal documents (most complete version)
    const fullParts: string[] = []
    if (street && !isNumericStreet) {
      fullParts.push(address.house_number ? `רחוב ${street} ${address.house_number}` : `רחוב ${street}`)
    }
    if (neighborhood && !fullParts.some(p => p.includes(neighborhood))) {
      fullParts.push(`שכונת ${neighborhood}`)
    }
    if (city && !fullParts.some(p => p.includes(city))) {
      fullParts.push(city)
    }
    fullAddress = fullParts.length > 0 ? fullParts.join(', ') : formattedAddress

    return {
      success: true,
      address: formattedAddress,
      fullAddress: fullAddress,
      city: city,
      street: isNumericStreet ? undefined : street,
      houseNumber: address.house_number,
      suburb: neighborhood,
      pointOfInterest: poi,
      raw: data,
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error)
    return {
      success: false,
      address: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Format coordinates as fallback address
 */
export function formatCoordinatesAsFallback(lat: number, lng: number): string {
  return `מיקום GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
}
