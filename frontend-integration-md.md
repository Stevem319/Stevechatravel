# Frontend Integration Guide

This document outlines how to integrate the Google Flights Scraper backend with your Next.js mobile app built on Firebase Studio App Builder.

## Backend API Integration

Add the following code to your Next.js frontend to connect with the Render.com backend:

### 1. Create an API Service

Create a file called `flightService.js` in your project:

```javascript
// services/flightService.js

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://your-render-app.onrender.com';

export async function searchFlights(flightParams) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/search-flights`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(flightParams),
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to search flights:', error);
    throw error;
  }
}

export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return await response.json();
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 'error', error: error.message };
  }
}
```

### 2. Create a Flight Search Component

```jsx
// components/FlightSearch.jsx

import { useState } from 'react';
import { searchFlights } from '../services/flightService';

export default function FlightSearch() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [adults, setAdults] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [flights, setFlights] = useState([]);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const params = {
        origin,
        destination,
        departureDate,
        adults
      };
      
      if (isRoundTrip && returnDate) {
        params.returnDate = returnDate;
      }
      
      const response = await searchFlights(params);
      
      if (response.success) {
        setFlights(response.data);
      } else {
        setError(response.error || 'Failed to fetch flights');
      }
    } catch (err) {
      setError('An error occurred while searching for flights');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flight-search">
      <h2>Search Flights</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="origin">Origin:</label>
          <input
            type="text"
            id="origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="e.g. LAX"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="destination">Destination:</label>
          <input
            type="text"
            id="destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. JFK"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="departureDate">Departure Date:</label>
          <input
            type="date"
            id="departureDate"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
            required
          />
        </div>
        
        <div className="form-check">
          <input
            type="checkbox"
            id="roundTrip"
            checked={isRoundTrip}
            onChange={(e) => setIsRoundTrip(e.target.checked)}
          />
          <label htmlFor="roundTrip">Round Trip</label>
        </div>
        
        {isRoundTrip && (
          <div className="form-group">
            <label htmlFor="returnDate">Return Date:</label>
            <input
              type="date"
              id="returnDate"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              required={isRoundTrip}
            />
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="adults">Adults:</label>
          <select
            id="adults"
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
        </div>
        
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Searching...' : 'Search Flights'}
        </button>
      </form>
      
      {error && <div className="error-message">{error}</div>}
      
      {flights.length > 0 && (
        <div className="flight-results">
          <h3>Flight Results</h3>
          <ul>
            {flights.map((flight, index) => (
              <li key={index} className="flight-card">
                <div className="flight-airline">{flight.airline}</div>
                <div className="flight-times">
                  <span>{flight.departureTime}</span> - <span>{flight.arrivalTime}</span>
                </div>
                <div className="flight-duration">{flight.duration}</div>
                <div className="flight-stops">{flight.stops}</div>
                <div className="flight-price">{flight.price}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

### 3. Update your Next.js Environment Variables

Create or update `.env.local` file in your Next.js project:

```
NEXT_PUBLIC_API_BASE_URL=https://your-render-app.onrender.com
```

Make sure to replace `your-render-app.onrender.com` with your actual Render.com deployment URL.

### 4. Update your Firebase App Builder Configuration

For Firebase Studio App Builder integration, you'll need to ensure your app's configuration allows external API calls.

In your Firebase project:

1. Go to the Firebase Console
2. Navigate to your project
3. Open App Builder settings
4. Add your Render.com backend URL to the allowed origins list
