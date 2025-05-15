# Google Flights Scraper Backend

This is a backend service for scraping Google Flights data that can be deployed to Render.com.

## Features

- RESTful API for searching flights from Google Flights
- Puppeteer-based scraping with stealth mode to avoid detection
- Caching mechanism to reduce scraping frequency and improve performance
- Rate limiting to prevent abuse
- Request validation
- CORS support
- Security headers

## API Endpoints

### Search Flights

```
POST /api/search-flights
```

**Request Body:**

```json
{
  "origin": "LAX",
  "destination": "JFK",
  "departureDate": "2025-06-15",
  "returnDate": "2025-06-22",  // Optional for one-way trips
  "adults": 1,                  // Optional, default: 1
  "children": 0,                // Optional, default: 0
  "infants": 0,                 // Optional, default: 0
  "cabin": "economy"            // Optional, default: economy
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "price": "$299",
      "airline": "United",
      "duration": "5h 30m",
      "departureTime": "7:00 AM",
      "arrivalTime": "3:30 PM",
      "stops": "Nonstop",
      "link": "https://www.google.com/..."
    },
    // More flight results...
  ],
  "isCached": false
}
```

### Health Check

```
GET /health
```

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn

## Environment Variables

Create a `.env` file with the following variables:

```
PORT=3000
NODE_ENV=production
```

## Deployment to Render.com

1. Create a new Web Service on Render.com
2. Connect your GitHub repository
3. Use the following settings:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Add Environment Variables** (from your .env file)

## Local Development

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file
4. Start the server:
   ```
   npm start
   ```

## Frontend Integration

To integrate with your Next.js mobile app, make API calls to the deployed backend:

```javascript
// Example API call
const searchFlights = async (params) => {
  const response = await fetch('https://your-render-app.onrender.com/api/search-flights', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  
  return await response.json();
};
```

## Limitations

- Google Flights may change their website structure, requiring updates to the scraper
- IP-based rate limiting might be applied by Google
- This scraper is for educational purposes only and should be used responsibly
