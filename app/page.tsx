"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Plane, RotateCcw, Compass } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

export default function HolidaySimulator() {
  const [destination, setDestination] = useState("")
  const [currentLocation, setCurrentLocation] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [visitedPlaces, setVisitedPlaces] = useState<string[]>([])
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const streetViewRef = useRef<HTMLDivElement>(null)
  const panoramaRef = useRef<any>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const autocompleteService = useRef<any>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")
      return
    }

    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry,places`
    script.async = true
    script.defer = true

    script.onload = () => {
      if (window.google) {
        setMapsLoaded(true)
        autocompleteService.current = new window.google.maps.places.AutocompleteService()
      }
    }

    document.head.appendChild(script)
    return () => {
      document.head.removeChild(script)
    }
  }, [])

  const debouncedSearch = useCallback(
    debounce((query: string) => {
      if (query.length > 2 && mapsLoaded) {
        exploreDestination(query)
      }
    }, 1000),
    [mapsLoaded],
  )

  function debounce(func: Function, wait: number) {
    let timeout: NodeJS.Timeout
    return function executedFunction(...args: any[]) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  const getSuggestions = (input: string) => {
    if (!autocompleteService.current || input.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    autocompleteService.current.getPlacePredictions(
      {
        input,
        types: ["(cities)"],
      },
      (predictions: any, status: any) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions.slice(0, 5))
          setShowSuggestions(true)
        } else {
          setSuggestions([])
          setShowSuggestions(false)
        }
      },
    )
  }

  const handleDestinationChange = (value: string) => {
    setDestination(value)
    getSuggestions(value)
    debouncedSearch(value)
  }

  const selectSuggestion = (suggestion: any) => {
    setDestination(suggestion.description)
    setShowSuggestions(false)
    exploreDestination(suggestion.description)
  }

  const exploreDestination = async (place?: string) => {
    const searchPlace = place || destination
    if (!searchPlace.trim() || !mapsLoaded) return

    setIsLoading(true)

    try {
      const geocoder = new window.google.maps.Geocoder()

      geocoder.geocode({ address: searchPlace }, (results: any, status: any) => {
        if (status === "OK" && results[0]) {
          const location = results[0].geometry.location
          const formattedAddress = results[0].formatted_address

          setCurrentLocation(formattedAddress)
          setVisitedPlaces((prev) => [...prev, formattedAddress])
          setGameStarted(true)

          // Initialize Street View
          if (streetViewRef.current) {
            const streetViewService = new window.google.maps.StreetViewService()

            streetViewService.getPanorama(
              {
                location: location,
                radius: 50,
              },
              (data: any, status: any) => {
                if (status === "OK") {
                  panoramaRef.current = new window.google.maps.StreetViewPanorama(streetViewRef.current, {
                    position: location,
                    pov: { heading: 34, pitch: 10 },
                    zoom: 1,
                    addressControl: false,
                    linksControl: true,
                    panControl: true,
                    enableCloseButton: false,
                  })
                } else {
                  // Fallback to map view if street view not available
                  const map = new window.google.maps.Map(streetViewRef.current, {
                    center: location,
                    zoom: 15,
                    mapTypeId: "satellite",
                  })

                  new window.google.maps.Marker({
                    position: location,
                    map: map,
                    title: formattedAddress,
                  })
                }
              },
            )
          }
        }
        setIsLoading(false)
      })
    } catch (error) {
      console.error("Error geocoding:", error)
      setIsLoading(false)
    }
  }

  const resetGame = () => {
    setGameStarted(false)
    setDestination("")
    setCurrentLocation("")
    setVisitedPlaces([])
    panoramaRef.current = null
  }

  const exploreRandomLocation = () => {
    const randomDestinations = [
      "Santorini, Greece",
      "Kyoto, Japan",
      "Banff National Park, Canada",
      "Machu Picchu, Peru",
      "Maldives",
      "Swiss Alps, Switzerland",
      "Bora Bora, French Polynesia",
      "Iceland Northern Lights",
      "Tuscany, Italy",
      "Great Barrier Reef, Australia",
    ]

    const randomDest = randomDestinations[Math.floor(Math.random() * randomDestinations.length)]
    setDestination(randomDest)
    setTimeout(() => exploreDestination(), 100)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-center text-red-600">
          Missing Google Maps API key. Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in the Vercel dashboard or your{" "}
          <code>.env.local</code> file and reload.
        </p>
      </div>
    )
  }

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Plane className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Holiday Hopper
            </CardTitle>
            <CardDescription>Enter any destination and virtually explore it through Street View!</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  placeholder="Where would you like to go? (e.g., Paris, Tokyo, Bali)"
                  value={destination}
                  onChange={(e) => handleDestinationChange(e.target.value)}
                  disabled={!mapsLoaded}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto"
                  >
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.place_id}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => selectSuggestion(suggestion)}
                      >
                        <div className="font-medium">{suggestion.structured_formatting.main_text}</div>
                        <div className="text-gray-500 text-xs">{suggestion.structured_formatting.secondary_text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {!mapsLoaded && <p className="text-sm text-muted-foreground">Loading maps...</p>}
            </div>

            <Button
              onClick={exploreDestination}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              disabled={!destination.trim() || isLoading || !mapsLoaded}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exploring...
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 mr-2" />
                  Start Virtual Holiday
                </>
              )}
            </Button>

            <Button
              onClick={exploreRandomLocation}
              variant="outline"
              className="w-full bg-transparent"
              disabled={isLoading || !mapsLoaded}
            >
              <Compass className="h-4 w-4 mr-2" />
              Surprise Me!
            </Button>

            {visitedPlaces.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Previously Visited:</p>
                <div className="flex flex-wrap gap-1">
                  {visitedPlaces.slice(-3).map((place, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {place.split(",")[0]}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Plane className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Holiday Hopper</h1>
                <p className="text-sm text-muted-foreground flex items-center">
                  <MapPin className="h-3 w-3 mr-1" />
                  {currentLocation}
                </p>
              </div>
            </div>

            {/* Center Search Box */}
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <Input
                  placeholder="Explore another destination..."
                  value={destination}
                  onChange={(e) => handleDestinationChange(e.target.value)}
                  className="w-full"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto"
                  >
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.place_id}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => selectSuggestion(suggestion)}
                      >
                        <div className="font-medium">{suggestion.structured_formatting.main_text}</div>
                        <div className="text-gray-500 text-xs">{suggestion.structured_formatting.secondary_text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button onClick={exploreRandomLocation} variant="outline" size="sm" disabled={isLoading}>
                <Compass className="h-4 w-4 mr-1" />
                Surprise Me
              </Button>
              <Badge variant="outline">
                {visitedPlaces.length} place{visitedPlaces.length !== 1 ? "s" : ""} visited
              </Badge>
              <Button onClick={resetGame} variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 mr-1" />
                New Trip
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Street View Container */}
      <div className="relative">
        <div ref={streetViewRef} className="w-full h-[calc(100vh-80px)]" style={{ minHeight: "500px" }} />

        {/* Game Info */}
        <div className="absolute bottom-4 right-4">
          <Card className="p-3">
            <div className="text-sm space-y-1">
              <p className="font-medium">🎮 Game Stats</p>
              <p>Places visited: {visitedPlaces.length}</p>
              <p>Current: {currentLocation.split(",")[0]}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
