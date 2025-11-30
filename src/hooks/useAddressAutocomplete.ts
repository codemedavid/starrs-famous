import { useState, useEffect, useRef, useCallback } from 'react';
import { AddressSuggestion } from '../types';

/**
 * Custom hook for address autocomplete using Nominatim API (OpenStreetMap)
 * 
 * Features:
 * - Debounced search to limit API calls
 * - Restricted to Philippines addresses only
 * - Handles rate limiting (1 request per second)
 * - Graceful error handling
 * 
 * Nominatim Usage Policy:
 * - Maximum 1 request per second
 * - Must include User-Agent header
 * - Free to use, no API key required
 */
export const useAddressAutocomplete = (query: string) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestTimeRef = useRef<number>(0);

  const searchAddresses = useCallback(async (searchQuery: string) => {
    // Clear previous suggestions if query is empty
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Cancel previous request if still in flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Rate limiting: ensure at least 1 second between requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTimeRef.current;
    if (timeSinceLastRequest < 1000) {
      const waitTime = 1000 - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    try {
      // Build Nominatim API URL with enhanced parameters for detailed search
      // Using 'q' parameter allows searching for addresses, landmarks, villages, etc.
      // The query can include: street names, house numbers, barangays, villages, landmarks, POIs
      const params = new URLSearchParams({
        q: `${searchQuery}, Philippines`, // Explicitly add Philippines for better results
        countrycodes: 'ph', // Restrict to Philippines only
        format: 'json',
        limit: '10', // Increased limit for more results
        addressdetails: '1', // Get detailed address components
        extratags: '1', // Get additional tags like amenities, shops, landmarks
        namedetails: '1', // Get named details
        dedupe: '1' // Deduplicate results
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'Starrs-Famous-Shakes/1.0', // Required by Nominatim
            'Accept': 'application/json'
          },
          signal: abortController.signal
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      // Transform Nominatim response to our AddressSuggestion format
      // Include all detailed address components including villages, barangays, landmarks
      const formattedSuggestions: AddressSuggestion[] = data.map((item: any) => ({
        display_name: item.display_name,
        place_id: item.place_id,
        lat: item.lat,
        lon: item.lon,
        type: item.type,
        importance: item.importance,
        address: {
          road: item.address?.road,
          house_number: item.address?.house_number,
          suburb: item.address?.suburb,
          village: item.address?.village,
          barangay: item.address?.barangay || item.address?.suburb, // Barangay is often in suburb field
          city: item.address?.city,
          town: item.address?.town,
          municipality: item.address?.municipality,
          state: item.address?.state,
          province: item.address?.province || item.address?.state,
          postcode: item.address?.postcode,
          country: item.address?.country,
          neighbourhood: item.address?.neighbourhood,
          quarter: item.address?.quarter,
          // Landmarks and POIs
          amenity: item.address?.amenity, // e.g., restaurant, school, hospital
          shop: item.address?.shop, // e.g., supermarket, mall
          tourism: item.address?.tourism // e.g., hotel, attraction
        }
      }));

      // Sort by importance (higher importance = more relevant) and then by type
      // Prioritize addresses with house numbers, then roads, then landmarks
      formattedSuggestions.sort((a, b) => {
        // First sort by importance if available
        if (a.importance && b.importance) {
          return b.importance - a.importance;
        }
        // Prioritize addresses with house numbers
        const aHasHouseNumber = !!a.address.house_number;
        const bHasHouseNumber = !!b.address.house_number;
        if (aHasHouseNumber !== bHasHouseNumber) {
          return aHasHouseNumber ? -1 : 1;
        }
        // Then prioritize addresses with road names
        const aHasRoad = !!a.address.road;
        const bHasRoad = !!b.address.road;
        if (aHasRoad !== bHasRoad) {
          return aHasRoad ? -1 : 1;
        }
        return 0;
      });

      setSuggestions(formattedSuggestions);
      lastRequestTimeRef.current = Date.now();
    } catch (err) {
      // Don't set error if request was aborted (user is typing)
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      console.error('Error fetching address suggestions:', err);
      setError('Failed to fetch address suggestions. Please try again or enter address manually.');
      setSuggestions([]);
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Clear previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't search if query is too short (less than 3 characters)
    if (query.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    // Debounce the search (400ms delay)
    debounceTimerRef.current = setTimeout(() => {
      searchAddresses(query);
    }, 400);

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, searchAddresses]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    suggestions,
    loading,
    error,
    clearSuggestions: () => setSuggestions([])
  };
};

